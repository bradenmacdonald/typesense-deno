# TypeSense-deno

This is a fork of [`typesense-js`](https://github.com/typesense/typesense-js),
with parts of it changed to be compatible with [Deno](https://deno.land/).

It's based on typesense-js 1.1.3, and has mostly the same API. Refer to the
[TypeSense documentation](https://typesense.org/docs/api/) for details.

Not implemented:
* `exportStream`
* `delete(id: string)` (but `delete(query: DeleteQuery)` is implemented)
