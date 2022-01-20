import ApiCall from './ApiCall.ts'
import Collections from './Collections.ts'
import { OverrideSchema } from './Override.ts'

const RESOURCEPATH = '/overrides'

export interface OverrideCreateSchema {
  rule: {
    query: string
    match: 'exact' | 'contains'
  }
  filter_by?: string
  remove_matched_tokens?: boolean
  includes?: [
    {
      id: string
      position: number
    }
  ]
  excludes?: [{ id: string }]
}

export interface OverridesRetrieveSchema {
  overrides: OverrideSchema[]
}

export default class Overrides {
  constructor(private collectionName: string, private apiCall: ApiCall) {}

  async upsert(overrideId: string, params: OverrideCreateSchema): Promise<OverrideSchema> {
    return await this.apiCall.put<OverrideSchema>(this.endpointPath(overrideId), params)
  }

  async retrieve(): Promise<OverridesRetrieveSchema> {
    return await this.apiCall.get<OverridesRetrieveSchema>(this.endpointPath())
  }

  private endpointPath(operation?: string): string {
    return `${Collections.RESOURCEPATH}/${this.collectionName}${Overrides.RESOURCEPATH}${
      operation === undefined ? '' : '/' + operation
    }`
  }

  static get RESOURCEPATH(): string {
    return RESOURCEPATH
  }
}
