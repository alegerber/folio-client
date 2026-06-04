# Changelog

All notable changes to `folio-client` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-06-04

Kept a **patch** release despite the breaking API/type changes below: the package
has no public consumers, so the breaking surface affects no one (a 2.0.0 bump would
also break the convention that the client version tracks the Folio server).

### Added
- Streaming methods `generateStream` / `mergeStream` / `splitStream` /
  `compressStream` / `pdfAStream` / `screenshotStream` — return
  `ReadableStream<Uint8Array>` for true streaming of the raw bytes.
- `collect(stream)` helper to buffer a `ReadableStream<Uint8Array>` into a `Uint8Array`.
- Configurable retry/backoff via `FolioClientOptions.retry` and per-call
  `options.retry`: retries `429`/`503` and transient network errors with exponential
  backoff + jitter and `Retry-After` support (default `maxRetries: 2`). Timeouts are
  never retried. Exported `RetryOptions`.
- `FolioTimeoutError` and `FolioNetworkError` (extend `FolioError`, `statusCode === 0`)
  so timeouts and network failures are distinguishable from HTTP errors via `instanceof`.
- Per-call `options.signal` (`AbortSignal`) on every method.
- `engines: { node: ">=18" }`, package metadata (`repository`, `bugs`, `homepage`,
  `author`), `sideEffects: false`, and `publint` + `@arethetypeswrong/cli` in CI.

### Changed (BREAKING — source-breaking for TS consumers; no public consumers exist)
- `html`/`url` are now a discriminated union on `GenerateRequest` /
  `ScreenshotRequest`: supplying **both** — or **neither** — is a compile error.
- Removed the `stream` request field and the `stream`-discriminated overloads. Use the
  `*Stream()` methods (with `collect()` to buffer) instead of `{ stream: true }`.

### Fixed
- Non-JSON or empty error bodies surface as `FolioError` instead of a raw
  `TypeError`/`SyntaxError` — the response body is read exactly once.
- The request timeout covers the response **body download** for buffered calls;
  streaming calls bound only the connect + headers phase so a long body is not cut off.
- `package.json` `exports`/`main`/`module` resolve correctly for both ESM `import`
  and CJS `require` (previously pointed at a non-existent `.mjs`).
- `X-Api-Key` is no longer sent to the public `/health` endpoint.
- `baseUrl` trailing-slash normalization no longer uses a polynomial regex.

## [1.2.0] - 2026-06-03

Types brought in line with the current Folio server contract; version aligned
with the Folio server (1.2.0). **Runtime behaviour is unchanged** — these are
type corrections. The exported-type changes below can be source-breaking for
TypeScript consumers; kept as a minor because the package is unpublished, so no
release was pinned to it.

### Changed (type corrections — may be source-breaking for TS consumers)
- `paper.size` is now the `PaperSize` enum (`A4 | A3 | Letter | Legal | Tabloid`)
  instead of `string`, matching the server's enum validation.
- `StoredPdf` is now `{ id, url }` — removed `createdAt` (previously declared
  `required` but never returned by the server, so consumers always read
  `undefined`) and `size`.
- `get(id)` now returns `FolioResponse<StoredUrl>` (`{ url }`); the server's
  `GET /pdf/:id` issues a fresh presigned URL with no `id`.
- `health()` now returns `{ status: string }` (the `/health` body is not wrapped
  in `FolioResponse`).

### Added
- Exported `PaperSize` and `StoredUrl` types.
- JSDoc for server input limits (html ≤ 2,000,000 chars, css ≤ 500,000,
  cookies ≤ 50 entries, header value ≤ 8,192 chars).
- Documented that `GET /health` is public (no API key required).

## [1.1.0] - 2026-04-12

### Added
- `screenshot()` — render HTML or a URL to PNG / JPEG / WebP.
- URL rendering for `generate()` (with cookies and extra headers).

## [1.0.0] - 2026-04-07

### Added
- Initial release: `generate`, `get`, `delete`, `merge`, `split`, `compress`,
  `pdfA`, `health`; streaming and S3-URL responses; `X-Api-Key` auth; request
  timeout; typed `FolioError`.
