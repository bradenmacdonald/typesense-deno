import TypesenseError from './TypesenseError.ts'
import { ImportResponseFail } from '../Documents.ts'

export default class ImportError extends TypesenseError {
  importResults: ImportResponseFail
  constructor(message: string, importResults: any) {
    super()
    this.importResults = importResults
  }
}
