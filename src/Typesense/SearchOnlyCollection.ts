import { DocumentSchema, SearchableDocuments } from './Documents.ts'
import ApiCall from './ApiCall.ts'
import { SearchOnlyDocuments } from './SearchOnlyDocuments.ts'

export class SearchOnlyCollection<T extends DocumentSchema = {}> {
  private readonly _documents: SearchableDocuments<T>

  constructor(private readonly name: string, private readonly apiCall: ApiCall, private readonly configuration: any) {
    this._documents = new SearchOnlyDocuments(this.name, this.apiCall, this.configuration)
  }

  documents(): SearchableDocuments<T> {
    return this._documents
  }
}
