# folio-client

TypeScript/JavaScript client for the [Folio](https://github.com/alegerber/folio) serverless PDF API.

## Installation

```bash
npm install folio-client
```

## Usage

```ts
import { FolioClient } from "folio-client";

const folio = new FolioClient({
  baseUrl: "http://localhost:8080",
  // apiKey is only required when the server has API_KEY configured
  apiKey: "your-api-key-minimum-32-characters",
});
```

### Generate a PDF

Store the result in S3 and receive a presigned download URL:

```ts
const { data } = await folio.generate({
  html: "<html><body><h1>Hello, Folio</h1></body></html>",
  css: "h1 { color: navy }",
  paper: { size: "A4", orientation: "portrait" },
  options: {
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    printBackground: true,
  },
});

console.log(data.url);  // presigned S3 URL
console.log(data.id);   // UUID for subsequent operations
```

Provide exactly one of `html` or `url` — the types enforce it (supplying both, or
neither, is a compile error).

Stream the raw PDF bytes (`ReadableStream<Uint8Array>`); buffer with `collect` if you
want all the bytes in memory:

```ts
import { collect } from "folio-client";

const stream = await folio.generateStream({ html: "<h1>Hello</h1>" });
// pipe `stream` to a file/HTTP response, or buffer it:
const bytes = await collect(stream);  // Uint8Array
```

Render a remote URL instead of inline HTML — with optional cookies and headers for authenticated pages:

```ts
const { data } = await folio.generate({
  url: "https://example.com/invoice/42",
  cookies: [{ name: "session", value: "…", domain: "example.com" }],
  extraHeaders: { Authorization: "Bearer …" },
});
```

### Retrieve / delete a stored PDF

```ts
const { data } = await folio.get(id);   // { url } — a fresh presigned URL
await folio.delete(id);                  // 204 No Content
```

### Merge PDFs

Combine 2–20 stored PDFs into one:

```ts
const { data } = await folio.merge({ ids: [id1, id2, id3] });
```

### Split a PDF

Extract a page range (requires Ghostscript on the server):

```ts
const { data } = await folio.split({ id, pages: "1-3" });
```

### Compress a PDF

```ts
const { data } = await folio.compress({ id });
```

### Convert to PDF/A

Conformance levels: `"1b"`, `"2b"` (default), `"3b"`:

```ts
const { data } = await folio.pdfA({ id, conformance: "2b" });
```

### Screenshot

Render HTML or a URL to an image (PNG/JPEG/WebP) — store it and get a URL, or stream the raw bytes:

```ts
const { data } = await folio.screenshot({
  url: "https://example.com",
  viewport: { width: 1280, height: 720 },
  format: "png",
  fullPage: true,
});
console.log(data.url);  // presigned S3 URL

const stream = await folio.screenshotStream({ html: "<h1>Hi</h1>" });
// stream is a ReadableStream<Uint8Array>
```

### Health check

`/health` is public — the client never sends the API key to it, even when one is configured.

```ts
const { status } = await folio.health();  // { status: "ok" }
```

## API reference

### `new FolioClient(options)`

| Option | Type | Description |
|--------|------|-------------|
| `baseUrl` | `string` | Base URL of your Folio instance |
| `apiKey` | `string?` | Sent as `X-Api-Key`; required only when the server has `API_KEY` set |
| `timeout` | `number?` | Request timeout in ms (default: `30_000`) |
| `retry` | `RetryOptions \| false?` | Retry policy for `429`/`503` + transient network errors (default: 2 retries, exponential backoff + jitter, honors `Retry-After`). `false` disables |

### Methods

The store-to-S3 methods (`generate`, `merge`, `split`, `compress`, `pdfA`) return `Promise<FolioResponse<StoredPdf>>` (`{ id, url }`). `get(id)` returns `FolioResponse<StoredUrl>` (`{ url }`), `screenshot` returns `FolioResponse<StoredImage>`, `delete` resolves to `void`, and `health()` returns `{ status }`. Each producing method has a `*Stream` counterpart returning `Promise<ReadableStream<Uint8Array>>` for the raw bytes — buffer one with `collect(stream)`.

| Method | Endpoint | Returns |
|--------|----------|---------|
| `generate(body)` / `generateStream(body)` | `POST /pdf/generate` | `FolioResponse<StoredPdf>` / `ReadableStream` |
| `get(id)` | `GET /pdf/:id` | `FolioResponse<StoredUrl>` |
| `delete(id)` | `DELETE /pdf/:id` | `void` |
| `merge(body)` / `mergeStream(body)` | `POST /pdf/merge` | `FolioResponse<StoredPdf>` / `ReadableStream` |
| `split(body)` / `splitStream(body)` | `POST /pdf/split` | `FolioResponse<StoredPdf>` / `ReadableStream` |
| `compress(body)` / `compressStream(body)` | `POST /pdf/compress` | `FolioResponse<StoredPdf>` / `ReadableStream` |
| `pdfA(body)` / `pdfAStream(body)` | `POST /pdf/pdfa` | `FolioResponse<StoredPdf>` / `ReadableStream` |
| `screenshot(body)` / `screenshotStream(body)` | `POST /screenshot` | `FolioResponse<StoredImage>` / `ReadableStream` |
| `health()` | `GET /health` | `{ status }` |

### Errors

Every failure throws a `FolioError` or one of its subclasses, so a single
`instanceof FolioError` catches them all:

```ts
import { FolioError, FolioTimeoutError, FolioNetworkError } from "folio-client";

try {
  await folio.get("nonexistent-id");
} catch (err) {
  if (err instanceof FolioTimeoutError) {
    // request exceeded `timeout` (statusCode 0)
  } else if (err instanceof FolioNetworkError) {
    // DNS / connection / TLS failure before any HTTP status (cause on err.body)
  } else if (err instanceof FolioError) {
    console.error(err.statusCode, err.body);  // non-2xx HTTP response
  }
}
```

### Cancellation

Every method accepts a trailing `options.signal` to cancel from the caller side
(combined with the client timeout). A caller-initiated abort surfaces as the
native `AbortError`; only the timeout becomes a `FolioTimeoutError`.

```ts
const controller = new AbortController();
const promise = folio.generate(
  { url: "https://slow.example" },
  { signal: controller.signal }
);
controller.abort();  // promise rejects with AbortError
```

### Retries

Transient failures (`429`/`503` and network errors) are retried automatically with
exponential backoff + jitter; a `Retry-After` header is honored. Timeouts are never
retried. Configure on the client or per call, or disable with `retry: false`:

```ts
const folio = new FolioClient({
  baseUrl,
  retry: { maxRetries: 3, retryOn: [429, 503, 504], baseDelayMs: 300 },
});

// override or disable for a single call (e.g. where a duplicate would matter):
await folio.merge({ ids }, { retry: false });
```

> Note: a network-error retry is at-least-once — if a request was processed but the
> response was lost, the retry can create a duplicate. Pass `retry: false` on calls
> where that matters.

## Running Folio locally

```bash
git clone https://github.com/alegerber/folio
cd folio
cp .env.example .env
docker compose up
```

The API is then available at `http://localhost:8080`.

## Development

```bash
npm run build      # compile to dist/
npm test           # run tests
npm run typecheck  # type-check without emitting
```

## License

MIT
