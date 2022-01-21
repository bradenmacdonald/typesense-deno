import ApiCall from './ApiCall.ts'

const RESOURCEPATH = '/debug'

export interface DebugResponseSchema {
  state: number
  version: string
}

export default class Debug {
  constructor(private apiCall: ApiCall) {}

  async retrieve(): Promise<DebugResponseSchema> {
    return await this.apiCall.get<DebugResponseSchema>(RESOURCEPATH)
  }
}
