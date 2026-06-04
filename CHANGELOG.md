# Changelog

All notable changes to `folio-client` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `FolioTimeoutError` and `FolioNetworkError` (both extend `FolioError`, with
  `statusCode === 0`) so timeouts and network failures are distinguishable from
  HTTP errors via `instanceof`.
- Per-call `options.signal` (`AbortSignal`) on every method for caller-side
  cancellation, combined with the client timeout.
- `engines: { node: ">=18" }`, package metadata (`repository`, `bugs`,
  `homepage`, `author`), `sideEffects: false`, and `publint` +
  `@arethetypeswrong/cli` in CI.

### Fixed
- Non-JSON or empty error bodies now surface as `FolioError` instead of a raw
  `TypeError`/`SyntaxError` — the response body is read exactly once.
- The request timeout now covers the response **body download**, not just the
  connect + headers phase.
- `package.json` `exports`/`main`/`module` now resolve correctly for both ESM
  `import` and CJS `require` (previously pointed at a non-existent `.mjs`).
- `X-Api-Key` is no longer sent to the public `/health` endpoint.
- `baseUrl` trailing-slash normalization no longer uses a polynomial regex.

### Changed
- `stream` is now `boolean | undefined` on request types, so `stream: undefined`
  compiles under `exactOptionalPropertyTypes`.

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
