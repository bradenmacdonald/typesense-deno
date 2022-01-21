import RequestWithCache from './RequestWithCache.ts'
import ApiCall from './ApiCall.ts'
import Configuration from './Configuration.ts'
import Collections from './Collections.ts'
import type { SearchableDocuments, SearchOptions, SearchParams, SearchResponse } from './Documents.ts'

const RESOURCEPATH = '/documents'

export class SearchOnlyDocuments<T> implements SearchableDocuments<T> {
  protected requestWithCache: RequestWithCache = new RequestWithCache()

  constructor(protected collectionName: string, protected apiCall: ApiCall, protected configuration: Configuration) {}

  async search(
    searchParameters: SearchParams<T>,
    {
      cacheSearchResultsForSeconds = this.configuration.cacheSearchResultsForSeconds,
      abortSignal = undefined
    }: SearchOptions = {}
  ): Promise<SearchResponse<T>> {
    const additionalQueryParams: Record<string, string|boolean> = {}
    if (this.configuration.useServerSideSearchCache === true) {
      additionalQueryParams['usecache'] = true
    }
    const queryParams = Object.assign({}, searchParameters, additionalQueryParams)

    return await this.requestWithCache.perform(
      this.apiCall,
      this.apiCall.get,
      [this.endpointPath('search'), queryParams, { abortSignal }],
      {
        cacheResponseForSeconds: cacheSearchResultsForSeconds
      }
    )
  }

  protected endpointPath(operation?: string) {
    return `${Collections.RESOURCEPATH}/${this.collectionName}${RESOURCEPATH}${
      operation === undefined ? '' : '/' + operation
    }`
  }

  static get RESOURCEPATH() {
    return RESOURCEPATH
  }
}
