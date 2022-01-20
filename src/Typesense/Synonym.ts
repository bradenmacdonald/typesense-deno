import ApiCall from './ApiCall.ts'
import Collections from './Collections.ts'
import Synonyms, { SynonymCreateSchema } from './Synonyms.ts'

export interface SynonymSchema extends SynonymCreateSchema {
  id: string
}

export interface SynonymDeleteSchema {
  id: string
}

export default class Synonym {
  constructor(private collectionName: string, private synonymId: string, private apiCall: ApiCall) {}

  async retrieve(): Promise<SynonymSchema> {
    return await this.apiCall.get<SynonymSchema>(this.endpointPath())
  }

  async delete(): Promise<SynonymDeleteSchema> {
    return await this.apiCall.delete<SynonymDeleteSchema>(this.endpointPath())
  }

  private endpointPath(): string {
    return `${Collections.RESOURCEPATH}/${this.collectionName}${Synonyms.RESOURCEPATH}/${this.synonymId}`
  }
}
