import ApiCall from './ApiCall.ts'
import { CollectionFieldSchema, CollectionSchema } from './Collection.ts'

export interface CollectionCreateSchema {
  name: string
  default_sorting_field?: string
  fields: CollectionFieldSchema[]
  symbols_to_index?: string[]
  token_separators?: string[]
}

const RESOURCEPATH = '/collections'

export default class Collections {
  constructor(private apiCall: ApiCall) {}

  async create(schema: CollectionCreateSchema): Promise<CollectionSchema> {
    return await this.apiCall.post<CollectionSchema>(RESOURCEPATH, schema)
  }

  async retrieve(): Promise<CollectionSchema[]> {
    return await this.apiCall.get<CollectionSchema[]>(RESOURCEPATH)
  }

  static get RESOURCEPATH() {
    return RESOURCEPATH
  }
}
