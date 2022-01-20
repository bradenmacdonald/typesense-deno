import {
  HTTPError,
  ObjectAlreadyExists,
  ObjectNotFound,
  ObjectUnprocessable,
  RequestMalformed,
  RequestUnauthorized,
  ServerError
} from './Errors/index.ts'
import TypesenseError from './Errors/TypesenseError.ts'
import Configuration, { NodeConfiguration } from './Configuration.ts'

const APIKEYHEADERNAME = 'X-TYPESENSE-API-KEY'
const HEALTHY = true
const UNHEALTHY = false

interface Node extends NodeConfiguration {
  isHealthy: boolean
  index: string | number
  lastAccessTimestamp: number
}

export default class ApiCall {
  private readonly apiKey: string
  private readonly nodes: Node[]
  private readonly nearestNode: Node
  private readonly connectionTimeoutSeconds: number
  private readonly healthcheckIntervalSeconds: number
  private readonly retryIntervalSeconds: number
  private readonly sendApiKeyAsQueryParam: boolean
  private readonly numRetriesPerRequest: number
  private readonly additionalUserHeaders: Record<string, string>

  private readonly logger: any
  private currentNodeIndex: number

  constructor(private configuration: Configuration) {
    this.apiKey = this.configuration.apiKey
    this.nodes = JSON.parse(JSON.stringify(this.configuration.nodes)) // Make a copy, since we'll be adding additional metadata to the nodes
    this.nearestNode = JSON.parse(JSON.stringify(this.configuration.nearestNode))
    this.connectionTimeoutSeconds = this.configuration.connectionTimeoutSeconds
    this.healthcheckIntervalSeconds = this.configuration.healthcheckIntervalSeconds
    this.numRetriesPerRequest = this.configuration.numRetries
    this.retryIntervalSeconds = this.configuration.retryIntervalSeconds
    this.sendApiKeyAsQueryParam = this.configuration.sendApiKeyAsQueryParam
    this.additionalUserHeaders = this.configuration.additionalHeaders

    this.logger = this.configuration.logger

    this.initializeMetadataForNodes()
    this.currentNodeIndex = -1
  }

  get<T extends any>(
    endpoint: string,
    queryParameters: Record<string, string> = {},
    {
      abortSignal,
    }: { abortSignal?: AbortSignal;  } = {}
  ): Promise<T> {
    return this.performRequest<T>('GET', endpoint, { queryParameters, abortSignal })
  }

  delete<T extends any>(endpoint: string, queryParameters: Record<string, string> = {}): Promise<T> {
    return this.performRequest<T>('DELETE', endpoint, { queryParameters })
  }

  post<T extends any>(
    endpoint: string,
    bodyParameters: any = {},
    queryParameters: Record<string, string> = {},
    additionalHeaders?: Headers
  ): Promise<T> {
    return this.performRequest<T>('POST', endpoint, { queryParameters, bodyParameters, additionalHeaders })
  }

  put<T extends any>(endpoint: string, bodyParameters: any = {}, queryParameters: Record<string, string> = {}): Promise<T> {
    return this.performRequest<T>('PUT', endpoint, { queryParameters, bodyParameters })
  }

  patch<T extends any>(endpoint: string, bodyParameters: any = {}, queryParameters: Record<string, string> = {}): Promise<T> {
    return this.performRequest<T>('PATCH', endpoint, { queryParameters, bodyParameters })
  }

  async performRequest<T extends any>(
    requestType: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE',
    endpoint: string,
    options: {
      queryParameters?: Record<string, string>,
      bodyParameters?: any,
      additionalHeaders?: Headers,
      abortSignal?: AbortSignal,
    }
  ): Promise<T> {
    this.configuration.validate()

    const requestNumber = Date.now()
    let lastException
    this.logger.debug(`Request #${requestNumber}: Performing ${requestType.toUpperCase()} request: ${endpoint}`)
    for (let numTries = 1; numTries <= this.numRetriesPerRequest + 1; numTries++) {
      let node = this.getNextNode(requestNumber)
      this.logger.debug(
        `Request #${requestNumber}: Attempting ${requestType.toUpperCase()} request Try #${numTries} to Node ${
          node.index
        }`
      )

      // Create an abort controller to timeout the request, if the user didn't provide their own:
      let abortSignal = options.abortSignal;
      if (abortSignal && abortSignal.aborted) {
        return Promise.reject(new Error('Request aborted by caller.'))
      }
      let defaultTimeoutTimer;
      if (abortSignal === undefined) {
        const controller = new AbortController();
        abortSignal = controller.signal;
        defaultTimeoutTimer = setTimeout(() => controller.abort(), this.connectionTimeoutSeconds * 1000);
      }

      // Build the request
      const headers = this.defaultHeaders();
      if (options.additionalHeaders) {
        for (const [key, value] of options.additionalHeaders.entries()) {
          headers.set(key, value);
        }
      }
      for (const [key, value] of Object.entries(this.additionalUserHeaders)) {
        headers.set(key, value);
      }
      let body: BodyInit|undefined;
      if (typeof options.bodyParameters === 'string' && options.bodyParameters.length !== 0) {
        body = options.bodyParameters;
      } else if (typeof options.bodyParameters === 'object' && Object.keys(options.bodyParameters).length !== 0) {
        body = JSON.stringify(options.bodyParameters);
      }
      const requestOptions: Parameters<typeof fetch>[1] = {
        method: requestType,
        headers,
        body,
        signal: abortSignal,
      }

      // Parameters and request data:
      const queryParameters = new URLSearchParams(options.queryParameters);

      if (this.sendApiKeyAsQueryParam) {
        queryParameters.set('x-typesense-api-key', this.apiKey);
      }

      try {
        let url = this.uriFor(endpoint, node);
        const queryString = queryParameters.toString();
        if (queryString) {
          url += "?" + queryString;
        }

        // Do the request:
        const response: Response = await fetch(url, requestOptions);
        if (defaultTimeoutTimer) {
          clearTimeout(defaultTimeoutTimer);
        }

        // Process the response:
        const responseJson = response.headers.get("Content-Type")?.startsWith("application/json") ? await response.json() : undefined;

        if (response.status >= 1 && response.status <= 499) {
          // Treat any status code > 0 and < 500 to be an indication that node is healthy
          // We exclude 0 since some clients return 0 when request fails
          this.setNodeHealthcheck(node, HEALTHY)
        }
        this.logger.debug(
          `Request #${requestNumber}: Request to Node ${node.index} was made. Response Code was ${response.status}.`
        )

        if (response.status >= 200 && response.status < 300) {
          // If response is 2xx return a resolved promise
          return Promise.resolve(responseJson ?? await response.text());
        } else if (response.status < 500) {
          // Next, if response is anything but 5xx, don't retry, return a custom error
          return Promise.reject(this.customErrorForResponse(response, responseJson?.message))
        } else {
          // Retry all other HTTP errors (HTTPStatus > 500)
          // This will get caught by the catch block below
          throw this.customErrorForResponse(response, responseJson?.message)
        }
      } catch (error) {
        // This block handles retries for HTTPStatus > 500 and network layer issues like connection timeouts
        this.setNodeHealthcheck(node, UNHEALTHY)
        lastException = error
        this.logger.warn(
          `Request #${requestNumber}: Request to Node ${node.index} failed due to "${error.code} ${error.message}${
            error.response == null ? '' : ' - ' + JSON.stringify(error.response?.data)
          }"`
        )
        // this.logger.debug(error.stack)
        this.logger.warn(
          `Request #${requestNumber}: Sleeping for ${this.retryIntervalSeconds}s and then retrying request...`
        )
        await this.timer(this.retryIntervalSeconds)
      }
    }
    this.logger.debug(`Request #${requestNumber}: No retries left. Raising last error`)
    return Promise.reject(lastException)
  }

  // Attempts to find the next healthy node, looping through the list of nodes once.
  //   But if no healthy nodes are found, it will just return the next node, even if it's unhealthy
  //     so we can try the request for good measure, in case that node has become healthy since
  getNextNode(requestNumber: number = 0): Node {
    // Check if nearestNode is set and is healthy, if so return it
    if (this.nearestNode != null) {
      this.logger.debug(
        `Request #${requestNumber}: Nodes Health: Node ${this.nearestNode.index} is ${
          this.nearestNode.isHealthy === true ? 'Healthy' : 'Unhealthy'
        }`
      )
      if (this.nearestNode.isHealthy === true || this.nodeDueForHealthcheck(this.nearestNode, requestNumber)) {
        this.logger.debug(`Request #${requestNumber}: Updated current node to Node ${this.nearestNode.index}`)
        return this.nearestNode
      }
      this.logger.debug(`Request #${requestNumber}: Falling back to individual nodes`)
    }

    // Fallback to nodes as usual
    this.logger.debug(
      `Request #${requestNumber}: Nodes Health: ${this.nodes
        .map((node) => `Node ${node.index} is ${node.isHealthy === true ? 'Healthy' : 'Unhealthy'}`)
        .join(' || ')}`
    )
    let candidateNode: Node|undefined
    for (let i = 0; i <= this.nodes.length; i++) {
      this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length
      candidateNode = this.nodes[this.currentNodeIndex]
      if (candidateNode.isHealthy === true || this.nodeDueForHealthcheck(candidateNode, requestNumber)) {
        this.logger.debug(`Request #${requestNumber}: Updated current node to Node ${candidateNode.index}`)
        return candidateNode
      }
    }
    if (candidateNode === undefined) {
      throw new Error("Internal Error - candidateNode not set");  // This is only to satisfy TypeScript
    }

    // None of the nodes are marked healthy, but some of them could have become healthy since last health check.
    //  So we will just return the next node.
    this.logger.debug(
      `Request #${requestNumber}: No healthy nodes were found. Returning the next node, Node ${candidateNode.index}`
    )
    return candidateNode
  }

  nodeDueForHealthcheck(node: Node, requestNumber: number = 0): boolean {
    const isDueForHealthcheck = Date.now() - node.lastAccessTimestamp > this.healthcheckIntervalSeconds * 1000
    if (isDueForHealthcheck) {
      this.logger.debug(
        `Request #${requestNumber}: Node ${node.index} has exceeded healtcheckIntervalSeconds of ${this.healthcheckIntervalSeconds}. Adding it back into rotation.`
      )
    }
    return isDueForHealthcheck
  }

  initializeMetadataForNodes(): void {
    if (this.nearestNode != null) {
      this.nearestNode.index = 'nearestNode'
      this.setNodeHealthcheck(this.nearestNode, HEALTHY)
    }

    this.nodes.forEach((node, i) => {
      node.index = i
      this.setNodeHealthcheck(node, HEALTHY)
    })
  }

  setNodeHealthcheck(node: Node, isHealthy: boolean): void {
    node.isHealthy = isHealthy
    node.lastAccessTimestamp = Date.now()
  }

  uriFor(endpoint: string, node: Node): string {
    if (node.url != null) {
      return `${node.url}${endpoint}`
    }
    return `${node.protocol}://${node.host}:${node.port}${node.path}${endpoint}`
  }

  defaultHeaders(): Headers {
    const defaultHeaders = new Headers();
    if (!this.sendApiKeyAsQueryParam) {
      defaultHeaders.set(APIKEYHEADERNAME, this.apiKey);
    }
    defaultHeaders.set('Content-Type', 'application/json');
    return defaultHeaders;
  }

  async timer(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  }

  customErrorForResponse(response: Response, messageFromServer: string): TypesenseError {
    let errorMessage = `Request failed with HTTP code ${response.status}`
    if (typeof messageFromServer === 'string' && messageFromServer.trim() !== '') {
      errorMessage += ` | Server said: ${messageFromServer}`
    }

    let error = new TypesenseError(errorMessage)

    if (response.status === 400) {
      error = new RequestMalformed(errorMessage)
    } else if (response.status === 401) {
      error = new RequestUnauthorized(errorMessage)
    } else if (response.status === 404) {
      error = new ObjectNotFound(errorMessage)
    } else if (response.status === 409) {
      error = new ObjectAlreadyExists(errorMessage)
    } else if (response.status === 422) {
      error = new ObjectUnprocessable(errorMessage)
    } else if (response.status >= 500 && response.status <= 599) {
      error = new ServerError(errorMessage)
    } else {
      error = new HTTPError(errorMessage)
    }

    error.httpStatus = response.status

    return error
  }
}
