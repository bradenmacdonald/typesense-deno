import ApiCall from './ApiCall.ts'
import { KeyCreateSchema, KeySchema } from './Key.ts'
import { SearchParams } from './Documents.ts'
import { base64Encode, sha256hmac } from "../deps.ts";

const RESOURCEPATH = '/keys'

export interface KeysRetrieveSchema {
  keys: KeySchema[]
}

export interface GenerateScopedSearchKeyParams extends Partial<SearchParams<any>> {
  expires_at?: number
  cache_ttl?: number
}

export default class Keys {
  constructor(private apiCall: ApiCall) {
    this.apiCall = apiCall
  }

  async create(params: KeyCreateSchema): Promise<KeySchema> {
    return await this.apiCall.post<KeySchema>(Keys.RESOURCEPATH, params)
  }

  retrieve(): Promise<KeysRetrieveSchema> {
    return this.apiCall.get<KeysRetrieveSchema>(RESOURCEPATH)
  }

  async generateScopedSearchKey(searchKey: string, parameters: GenerateScopedSearchKeyParams): Promise<string> {
    // Note: only a key generated with the `documents:search` action will be
    // accepted by the server, when usined with the search endpoint.
    const paramsJSON = JSON.stringify(parameters)
    const digest = base64Encode(await sha256hmac(searchKey, paramsJSON));
    const keyPrefix = searchKey.substr(0, 4)
    const rawScopedKey = `${digest}${keyPrefix}${paramsJSON}`

    return base64Encode(rawScopedKey);
  }

  static get RESOURCEPATH() {
    return RESOURCEPATH
  }
}
