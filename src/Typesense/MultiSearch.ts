import ApiCall from './ApiCall.ts'
import Configuration from './Configuration.ts'
import RequestWithCache from './RequestWithCache.ts'
import { DocumentSchema, SearchParams, SearchResponse } from './Documents.ts'

const RESOURCEPATH = '/multi_search'

export interface MultiSearchRequestSchema<T> extends SearchParams<T> {
  collection?: string
}

export interface MultiSearchRequestsSchema<T> {
  searches: MultiSearchRequestSchema<T>[]
}

export interface MultiSearchResponse<T> {
  results: SearchResponse<T>[]
}

export default class MultiSearch<T extends DocumentSchema = {}> {
  private requestWithCache: RequestWithCache

  constructor(
    private apiCall: ApiCall,
    private configuration: Configuration,
    private useTextContentType: boolean = false
  ) {
    this.requestWithCache = new RequestWithCache()
  }

  perform(
    searchRequests: MultiSearchRequestsSchema<T>,
    commonParams: Partial<MultiSearchRequestSchema<T>> = {},
    {
      cacheSearchResultsForSeconds = this.configuration.cacheSearchResultsForSeconds
    }: { cacheSearchResultsForSeconds?: number } = {}
  ): Promise<MultiSearchResponse<T>> {
    let additionalHeaders: Record<string, string> = {}
    if (this.useTextContentType) {
      additionalHeaders['content-type'] = 'text/plain'
    }

    let additionalQueryParams: Record<string, string|boolean> = {}
    if (this.configuration.useServerSideSearchCache === true) {
      additionalQueryParams['usecache'] = true
    }
    const queryParams = Object.assign({}, commonParams, additionalQueryParams)

    return this.requestWithCache.perform(
      this.apiCall,
      this.apiCall.post,
      [RESOURCEPATH, searchRequests, queryParams, additionalHeaders],
      { cacheResponseForSeconds: cacheSearchResultsForSeconds }
    )
  }
}
