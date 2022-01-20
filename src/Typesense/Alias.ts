import Aliases, { CollectionAliasSchema } from './Aliases.ts'
import ApiCall from './ApiCall.ts'

export default class Alias {
  constructor(private name: string, private apiCall: ApiCall) {}

  async retrieve(): Promise<CollectionAliasSchema> {
    return await this.apiCall.get<CollectionAliasSchema>(this.endpointPath())
  }

  async delete(): Promise<CollectionAliasSchema> {
    return await this.apiCall.delete<CollectionAliasSchema>(this.endpointPath())
  }

  private endpointPath(): string {
    return `${Aliases.RESOURCEPATH}/${this.name}`
  }
}
