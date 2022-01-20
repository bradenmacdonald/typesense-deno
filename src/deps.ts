// Keep it simple: don't use any dependencies outside of the Deno standard library
export * as log from "https://deno.land/std@0.122.0/log/mod.ts";
export { encode as base64Encode } from "https://deno.land/std@0.122.0/encoding/base64.ts";

export async function sha256hmac(
  secretKey: Uint8Array | string,
  data: Uint8Array | string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyObject = await crypto.subtle.importKey(
    "raw", // raw format of the key - should be Uint8Array
    secretKey instanceof Uint8Array ? secretKey : enc.encode(secretKey),
    { name: "HMAC", hash: { name: "SHA-256" } }, // algorithm
    false, // export = false
    ["sign", "verify"], // what this key can do
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyObject,
    data instanceof Uint8Array ? data : enc.encode(data),
  );
  return new Uint8Array(signature);
}
