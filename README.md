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

Stream the PDF bytes directly instead:

```ts
const bytes = await folio.generate({ html: "<h1>Hello</h1>", stream: true });
// bytes is a Uint8Array
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

### Health check

`/health` is public — it never requires the API key, even when one is configured.

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

### Methods

The PDF-producing methods (`generate`, `merge`, `split`, `compress`, `pdfA`) return `Promise<FolioResponse<StoredPdf>>` (`{ id, url }`), or `Promise<Uint8Array>` when `stream: true`. `get(id)` returns `FolioResponse<StoredUrl>` (`{ url }`), `screenshot` returns `FolioResponse<StoredImage>` (or bytes when streaming), `delete` resolves to `void`, and `health()` returns `{ status }`. TypeScript infers the correct return type automatically.

| Method | Endpoint |
|--------|----------|
| `generate(body)` | `POST /pdf/generate` |
| `get(id)` | `GET /pdf/:id` |
| `delete(id)` | `DELETE /pdf/:id` |
| `merge(body)` | `POST /pdf/merge` |
| `split(body)` | `POST /pdf/split` |
| `compress(body)` | `POST /pdf/compress` |
| `pdfA(body)` | `POST /pdf/pdfa` |
| `health()` | `GET /health` |

### `FolioError`

Thrown on non-2xx responses.

```ts
import { FolioError } from "folio-client";

try {
  await folio.get("nonexistent-id");
} catch (err) {
  if (err instanceof FolioError) {
    console.error(err.statusCode, err.body);
  }
}
```

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
