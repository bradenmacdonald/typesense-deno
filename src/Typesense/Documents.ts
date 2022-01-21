import ApiCall from './ApiCall.ts'
import Configuration from './Configuration.ts'
import { ImportError } from './Errors/index.ts'
import { SearchOnlyDocuments } from './SearchOnlyDocuments.ts'

// Todo: use generic to extract filter_by values
export interface DeleteQuery {
  filter_by: string
  batch_size?: number
}

export interface DeleteResponse {
  num_deleted: number
}

interface ImportResponseSuccess {
  success: true
}

export interface ImportResponseFail {
  success: false
  error: string
  document: DocumentSchema
  code: number
}

export type ImportResponse = ImportResponseSuccess | ImportResponseFail

export interface DocumentSchema extends Record<string, any> {}

export interface SearchParams<T extends DocumentSchema> {
  // From https://typesense.org/docs/latest/api/documents.html#arguments
  q: string
  query_by: string
  query_by_weights?: string
  prefix?: boolean // default: true
  filter_by?: string
  sort_by?: string // default: text match desc
  facet_by?: string
  max_facet_values?: number
  facet_query?: string
  page?: number // default: 1
  per_page?: number // default: 10, max 250
  group_by?: keyof T
  group_limit?: number // default:
  include_fields?: string
  exclude_fields?: string
  highlight_fields?: string // default: all queried fields
  highlight_full_fields?: string // default: all fields
  highlight_affix_num_tokens?: number // default: 4
  highlight_start_tag?: string // default: <mark>
  highlight_end_tag?: string // default: </mark>
  snippet_threshold?: number // default: 30
  num_typos?: string // default: 2
  min_len_1typo?: number
  min_len_2typo?: number
  exhaustive_search?: boolean
  drop_tokens_threshold?: number // default: 10
  typo_tokens_threshold?: number // default: 100
  pinned_hits?: string
  hidden_hits?: string
  limit_hits?: number // default: no limit
  pre_segmented_query?: boolean
  enable_overrides?: boolean
  prioritize_exact_match?: boolean // default: true
  search_cutoff_ms?: number
  use_cache?: boolean
}

export interface SearchResponseHit<T extends DocumentSchema> {
  highlights?: [
    {
      field: keyof T
      snippet?: string
      value?: string
      snippets?: string[]
      indices?: string[]
      matched_tokens: string[]
    }
  ]
  document: T
  text_match: number
}

export interface SearchResponseFacetCountSchema<T extends DocumentSchema> {
  counts: [
    {
      count: number
      highlighted: string
      value: string
    }
  ]
  field_name: keyof T
  stats: {
    avg?: number
    max?: number
    min?: number
    sum?: number
  }
}

// Todo: we could infer whether this is a grouped response by adding the search params as a generic
export interface SearchResponse<T extends DocumentSchema> {
  facet_counts?: SearchResponseFacetCountSchema<T>[]
  found: number
  out_of: number
  page: number
  request_params: SearchParams<T>
  search_time_ms: number
  hits?: SearchResponseHit<T>[]
  grouped_hits?: {
    group_key: string[]
    hits: SearchResponseHit<T>[]
  }[]
}

export type DocumentWriteParameters = {
  dirty_values?: 'coerce_or_reject' | 'coerce_or_drop' | 'drop' | 'reject'
  action?: 'create' | 'update' | 'upsert'
}

export type DocumentsExportParameters = {
  filter_by?: string
  include_fields?: string
  exclude_fields?: string
}

export interface SearchableDocuments<T> {
  search(searchParameters: SearchParams<T>, options: SearchOptions): Promise<SearchResponse<T>>
}

export interface WriteableDocuments<T> {
  create(document: T, options: DocumentWriteParameters): Promise<T>
  upsert(document: T, options: DocumentWriteParameters): Promise<T>
  update(document: T, options: DocumentWriteParameters): Promise<T>
  delete(idOrQuery: string | DeleteQuery): Promise<DeleteResponse> | Promise<T>
  import(documents: T[] | string, options: DocumentWriteParameters): Promise<string | ImportResponse[]>
  export(options: DocumentsExportParameters): Promise<string>
}

export interface SearchOptions {
  cacheSearchResultsForSeconds?: number
  abortSignal?: AbortSignal
}

export default class Documents<T extends DocumentSchema = {}>
  extends SearchOnlyDocuments<T>
  implements WriteableDocuments<T>
{
  constructor(collectionName: string, apiCall: ApiCall, configuration: Configuration) {
    super(collectionName, apiCall, configuration)
  }

  async create(document: T, options: DocumentWriteParameters = {}): Promise<T> {
    if (!document) throw new Error('No document provided')
    return await this.apiCall.post<T>(this.endpointPath(), document, options)
  }

  upsert(document: T, options: DocumentWriteParameters = {}): Promise<T> {
    if (!document) throw new Error('No document provided')
    return this.apiCall.post<T>(this.endpointPath(), document, Object.assign({}, options, { action: 'upsert' }))
  }

  update(document: T, options: DocumentWriteParameters = {}): Promise<T> {
    if (!document) throw new Error('No document provided')
    return this.apiCall.post<T>(this.endpointPath(), document, Object.assign({}, options, { action: 'update' }))
  }

  // delete(idOrQuery: DeleteQuery): Promise<DeleteResponse>
  // delete(idOrQuery: string): Promise<T>
  // delete(idOrQuery: string | DeleteQuery = {} as DeleteQuery): Promise<DeleteResponse> | Promise<T> {
  delete(query: DeleteQuery): Promise<DeleteResponse> {
    const queryParams: Record<string, string> = {filter_by: query.filter_by};
    if (query.batch_size) {
      queryParams.batch_size = String(query.batch_size);
    }
    return this.apiCall.delete<DeleteResponse>(this.endpointPath(), queryParams);
  }

  async createMany(documents: T[], options: DocumentWriteParameters = {}) {
    this.configuration.logger.warn(
      'createMany is deprecated and will be removed in a future version. Use import instead, which now takes both an array of documents or a JSONL string of documents'
    )
    return this.import(documents, options)
  }

  /**
   * Import a set of documents in a batch.
   * @param {string|Array} documents - Can be a JSONL string of documents or an array of document objects.
   * @param options
   * @return {string|Array} Returns a JSONL string if the input was a JSONL string, otherwise it returns an array of results.
   */
  async import(documents: string, options?: DocumentWriteParameters): Promise<string>
  async import(documents: T[], options?: DocumentWriteParameters): Promise<ImportResponse[]>
  async import(documents: T[] | string, options: DocumentWriteParameters = {}): Promise<string | ImportResponse[]> {
    let documentsInJSONLFormat
    if (Array.isArray(documents)) {
      try {
        documentsInJSONLFormat = documents.map((document) => JSON.stringify(document)).join('\n')
      } catch (error) {
        // if rangeerror, throw custom error message
        if (RangeError instanceof error && error?.includes('Too many properties to enumerate')) {
          throw new Error(`${error}
          It looks like you have reached a Node.js limit that restricts the number of keys in an Object: https://stackoverflow.com/questions/9282869/are-there-limits-to-the-number-of-properties-in-a-javascript-object

          Please try reducing the number of keys in your document, or using CURL to import your data.
          `)
        }

        // else, throw the non-range error anyways
        throw new Error(error)
      }
    } else {
      documentsInJSONLFormat = documents
    }

    const resultsInJSONLFormat = await this.apiCall.performRequest<string>('POST', this.endpointPath('import'), {
      queryParameters: options,
      bodyParameters: documentsInJSONLFormat,
      additionalHeaders: new Headers({ 'Content-Type': 'text/plain' }),
    })

    if (Array.isArray(documents)) {
      const resultsInJSONFormat = resultsInJSONLFormat.split('\n').map((r) => JSON.parse(r)) as ImportResponse[]
      const failedItems = resultsInJSONFormat.filter((r) => r.success === false)
      if (failedItems.length > 0) {
        throw new ImportError(
          `${resultsInJSONFormat.length - failedItems.length} documents imported successfully, ${
            failedItems.length
          } documents failed during import. Use \`error.importResults\` from the raised exception to get a detailed error reason for each document.`,
          resultsInJSONFormat
        )
      } else {
        return resultsInJSONFormat
      }
    } else {
      return resultsInJSONLFormat as string
    }
  }

  /**
   * Returns a JSONL string for all the documents in this collection
   */
  async export(options: DocumentsExportParameters = {}): Promise<string> {
    return this.apiCall.get<string>(this.endpointPath('export'), options)
  }

  // /**
  //  * Returns a NodeJS readable stream of JSONL for all the documents in this collection.
  //  */
  // async exportStream(options: DocumentsExportParameters = {}): Promise<ReadStream> {
  //   return this.apiCall.get<ReadStream>(this.endpointPath('export'), options, { responseType: 'stream' })
  // }
}
