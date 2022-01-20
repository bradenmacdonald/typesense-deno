import ApiCall from './ApiCall.ts'

const RESOURCEPATH = '/health'

export interface HealthResponse {
  status: string
}

export default class Health {
  constructor(private apiCall: ApiCall) {}

  async retrieve(): Promise<HealthResponse> {
    return await this.apiCall.get<HealthResponse>(RESOURCEPATH)
  }
}
