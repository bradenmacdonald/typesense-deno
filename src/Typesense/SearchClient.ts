import Configuration, { ConfigurationOptions } from './Configuration.ts'
import ApiCall from './ApiCall.ts'
import MultiSearch from './MultiSearch.ts'
import { DocumentSchema } from './Documents.ts'
import { SearchOnlyCollection } from './SearchOnlyCollection.ts'

export default class SearchClient {
  public readonly multiSearch: MultiSearch
  private readonly configuration: Configuration
  private readonly apiCall: ApiCall
  private readonly individualCollections: Record<string, SearchOnlyCollection>

  constructor(options: ConfigurationOptions) {
    const shouldSendApiKeyAsQueryParam = (options['apiKey'] || '').length < 2000
    if (shouldSendApiKeyAsQueryParam) {
      options['sendApiKeyAsQueryParam'] = true
    }

    this.configuration = new Configuration(options)
    this.apiCall = new ApiCall(this.configuration)
    this.multiSearch = new MultiSearch(this.apiCall, this.configuration, true)
    this.individualCollections = {}
  }

  collections<TDocumentSchema extends DocumentSchema = {}>(
    collectionName: string
  ): SearchOnlyCollection<TDocumentSchema> | SearchOnlyCollection {
    if (!collectionName) {
      throw new Error(
        'Typesense.SearchClient only supports search operations, so the collectionName that needs to ' +
          'be searched must be specified. Use Typesense.Client if you need to access the collection object.'
      )
    } else {
      if (this.individualCollections[collectionName] === undefined) {
        this.individualCollections[collectionName] = new SearchOnlyCollection(
          collectionName,
          this.apiCall,
          this.configuration
        )
      }
      return this.individualCollections[collectionName]
    }
  }
}
