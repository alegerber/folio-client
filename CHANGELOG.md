# Changelog

All notable changes to `folio-client` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-03

Types brought in line with the current Folio server contract. **Runtime
behaviour is unchanged** — these are type corrections, but because exported
types changed, this is a major release.

### Changed (breaking)
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
