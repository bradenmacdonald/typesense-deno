import ApiCall from './ApiCall.ts'
import Collections from './Collections.ts'
import Documents, { DocumentSchema, DocumentWriteParameters } from './Documents.ts'

export class Document<T extends DocumentSchema = {}> {
  constructor(private collectionName: string, private documentId: string, private apiCall: ApiCall) {}

  async retrieve(): Promise<T> {
    return await this.apiCall.get<T>(this.endpointPath())
  }

  async delete(): Promise<T> {
    return await this.apiCall.delete<T>(this.endpointPath())
  }

  async update(partialDocument: Partial<T>, options: DocumentWriteParameters = {}): Promise<T> {
    return await this.apiCall.patch<T>(this.endpointPath(), partialDocument, options)
  }

  private endpointPath(): string {
    return `${Collections.RESOURCEPATH}/${this.collectionName}${Documents.RESOURCEPATH}/${this.documentId}`
  }
}
