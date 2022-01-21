const defaultCacheResponseForSeconds = 2 * 60
const defaultMaxSize = 100

export default class RequestWithCache {
  private responseCache: Map<string, any> = new Map<string, any>()

  // Todo: should probably be passed a callback instead, or an apiCall instance. Types are messy this way
  async perform<T extends any>(
    requestContext: any,
    requestFunction: (...params: any) => unknown,
    requestFunctionArguments: any[],
    cacheOptions: CacheOptions
  ): Promise<T> {
    const { cacheResponseForSeconds = defaultCacheResponseForSeconds, maxSize = defaultMaxSize } = cacheOptions
    const isCacheDisabled = cacheResponseForSeconds <= 0 || maxSize <= 0

    if (isCacheDisabled) {
      return requestFunction.call(requestContext, ...requestFunctionArguments) as T
    }

    const requestFunctionArgumentsJSON = JSON.stringify(requestFunctionArguments)
    const cacheEntry = this.responseCache.get(requestFunctionArgumentsJSON)
    const now = Date.now()

    if (cacheEntry) {
      const isEntryValid = now - cacheEntry.requestTimestamp < cacheResponseForSeconds * 1000
      if (isEntryValid) {
        this.responseCache.delete(requestFunctionArgumentsJSON)
        this.responseCache.set(requestFunctionArgumentsJSON, cacheEntry)
        return Promise.resolve(cacheEntry.response)
      } else {
        this.responseCache.delete(requestFunctionArgumentsJSON)
      }
    }
    const response = await requestFunction.call(requestContext, ...requestFunctionArguments)
    this.responseCache.set(requestFunctionArgumentsJSON, {
      requestTimestamp: now,
      response
    })
    const isCacheOverMaxSize = this.responseCache.size > maxSize
    if (isCacheOverMaxSize) {
      const oldestEntry = this.responseCache.keys().next().value
      this.responseCache.delete(oldestEntry)
    }
    return response as T
  }
}

interface CacheOptions {
  cacheResponseForSeconds?: number
  maxSize?: number
}
