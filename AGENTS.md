# AGENTS.md

Guidance for AI coding agents and contributors working in this repository.
This is the agent-facing companion to the user-facing `README.md`: it documents
how to build, verify, and ship the client — not how to *use* it. For the public
API surface, see `README.md`; for vulnerability reporting, see `SECURITY.md`.

## Project snapshot

`folio-client` is a small, dependency-free TypeScript client for the Folio
serverless PDF API (HTML/URL → PDF, plus merge/split/compress/PDF-A/screenshot).
It is ESM-first (`"type": "module"`) and ships a dual ESM/CJS build via `tsup`.

There are **no public consumers yet**. The package version deliberately tracks
the Folio *server* version rather than strict semver of the client surface (see
*Versioning & release*), so breaking client changes have shipped under non-major
bumps (e.g. `1.2.1` introduced breaking type changes). Once external consumers
exist, switch to strict semver.

## Source layout

The build entry is **`src/index.ts` only** (`tsup src/index.ts`). Anything not
re-exported from `index.ts` is internal, regardless of its `export` keyword.

| File                  | Role                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `src/client.ts`       | Runtime: `FolioClient` class, `collect()` helper, retry/backoff, timeout/abort handling, header building, error mapping. |
| `src/types.ts`        | Types + error classes (`FolioError`, `FolioTimeoutError`, `FolioNetworkError`). The `html`/`url` request shape is a discriminated union — exactly one is required. |
| `src/index.ts`        | Public barrel. The *only* entry point; defines the package surface.  |
| `src/client.test.ts`  | Vitest suite (co-located with the source).                           |

## Build & verify gates

CI (`.github/workflows/ci.yml`, Node 24) runs **six** gates in order. All must
pass before a PR merges; run them locally with the same commands:

```bash
npm run lint        # eslint src/  (flat config: eslint.config.js)
npm run typecheck   # tsc --noEmit  (exactOptionalPropertyTypes is on)
npm test            # vitest run
npm run build       # tsup → dist/  (cjs + esm + .d.ts/.d.cts)
npx --yes publint                       # validates exports/main/module wiring
npx --yes @arethetypeswrong/cli --pack  # validates per-condition type maps
```

`publint` and `attw` are a **distinct gate category** from lint/typecheck/test:
they validate that the *published artifact* actually resolves under both
`import` and `require`. They catch `exports`/`.mjs`-style breakage that the other
gates cannot. Re-run both whenever you touch the `exports` map, `main`,
`module`, `types`, the `tsup` flags, or anything under `dist/` packaging.

Docs are built separately (`.github/workflows/docs.yml`, also Node 24):
`npm run docs` (TypeDoc → GitHub Pages). The CI runs on Node 24, but
`engines` requires Node `>=18` — keep runtime code compatible with 18.

## Conventions

- **TDD** (vitest, red → green): write the failing test, watch it fail for the
  right reason, then write the minimal code to pass it.
- **Commits**: imperative mood, English (e.g. `feat(client): add retry/backoff`).
- **Dual packaging**: the `exports` map carries *per-condition* types —
  `import` → `dist/index.js` + `dist/index.d.ts`, `require` → `dist/index.cjs` +
  `dist/index.d.cts`. Do not edit it without re-running `publint` + `attw`.
- **Errors**: a class hierarchy. `FolioTimeoutError` and `FolioNetworkError`
  extend `FolioError` with `statusCode === 0`, so `instanceof FolioError` still
  matches while callers can narrow to the specific cause.
- Keep the client **dependency-free** at runtime — no runtime `dependencies` in
  `package.json`.

## Versioning & release

- The version tracks the Folio server version: `folio-client@x.y.z` aligns with
  `folio` server `x.y.z`.
- Release flow:
  1. Bump `version` in `package.json`.
  2. Add the section to `CHANGELOG.md` **first** (it is the source of truth for
     release notes).
  3. Merge to `main`; confirm CI is green on the merge commit.
  4. Tag that commit: `git tag -a vX.Y.Z -m … <merge-sha>` then `git push origin vX.Y.Z`.
  5. `gh release create vX.Y.Z --latest --verify-tag --notes-file <changelog-section>`.
- Only tag a **green** commit — a tag is meant to be immutable.
- `prepack` runs `build`; `prepublishOnly` runs `lint && typecheck && test && build`,
  so `npm publish` always emits a freshly validated `dist/`.

## Gotchas (verified against the source)

- **Fetch mocks need a fresh `Response` per call.** A `Response` body is a
  single-use stream. Use `vi.fn().mockImplementation(() => Promise.resolve(new Response(...)))`,
  **not** `mockResolvedValue(new Response(...))` — a shared instance is re-read
  on retries and throws *"Body has already been read"* (see `src/client.test.ts`).
- **Read a response body once, then decode.** The client reads bytes via
  `arrayBuffer()` → `Uint8Array` → `TextDecoder().decode(...)`. Never call
  `.json()` then `.text()` on the same body — the second read fails.
- **Keep string trimming linear.** The base-URL trailing-slash trim is a manual
  `charCodeAt` loop, *not* a `/\/+$/` regex — that regex is a polynomial-ReDoS
  flagged by CodeQL (`js/polynomial-redos`). Avoid backtracking-prone regexes on
  caller input.
- **Retry semantics.** Network/`429`/`503` failures are retried (exponential
  backoff + jitter, honoring `Retry-After`); POST retries are therefore
  *at-least-once*. **Timeouts are never retried** — the time budget is spent.
