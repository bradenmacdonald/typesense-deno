import ApiCall from './ApiCall.ts'
import Collections from './Collections.ts'
import Overrides, { OverrideCreateSchema } from './Overrides.ts'

export interface OverrideSchema extends OverrideCreateSchema {
  id: string
}

export interface OverrideDeleteSchema {
  id: string
}

export default class Override {
  constructor(private collectionName: string, private overrideId: string, private apiCall: ApiCall) {}

  async retrieve(): Promise<OverrideSchema> {
    return await this.apiCall.get<OverrideSchema>(this.endpointPath())
  }

  async delete(): Promise<OverrideDeleteSchema> {
    return await this.apiCall.delete<OverrideDeleteSchema>(this.endpointPath())
  }

  private endpointPath(): string {
    return `${Collections.RESOURCEPATH}/${this.collectionName}${Overrides.RESOURCEPATH}/${this.overrideId}`
  }
}
