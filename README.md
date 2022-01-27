# TypeSense-deno

This is a fork of [`typesense-js`](https://github.com/typesense/typesense-js),
with parts of it changed to be compatible with [Deno](https://deno.land/).

It's based on typesense-js 1.1.3, and has mostly the same API. Refer to the
[TypeSense documentation](https://typesense.org/docs/api/) for details.

Not implemented:
* `exportStream`
* `delete(id: string)` (but `delete(query: DeleteQuery)` is implemented)

## Usage example

In `typesense-client.ts`:
```
import { Client, Errors, SearchClient } from "https://raw.githubusercontent.com/bradenmacdonald/typesense-deno/v1.1.3-deno/mod.ts";

// Use a promise to initialize the client as needed, rather than at import time.
let clientPromise: Promise<Client> | undefined;

export function getTypeSenseClient(): Promise<Client> {
    if (clientPromise === undefined) {
        clientPromise = new Promise((resolve) => {
            const client = new Client({
                nodes: [{
                    host: "localhost",
                    port: "8108",
                    protocol: "http",
                }],
                apiKey: "setme",
                connectionTimeoutSeconds: 2,
            });
            resolve(client);
        });
    }
    return clientPromise;
}
```

In your other files:
```
import { getTypeSenseClient } from "./typesense-client.ts";
const client = await getTypeSenseClient();
client.collections().create({ ... });
```
