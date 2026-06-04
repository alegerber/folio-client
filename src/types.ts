// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/** Paper sizes accepted by the Folio server (validated as an enum). */
export type PaperSize = "A4" | "A3" | "Letter" | "Legal" | "Tabloid";

export interface PaperOptions {
  size?: PaperSize;
  orientation?: "portrait" | "landscape";
}

export interface MarginOptions {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface RenderOptions {
  margin?: MarginOptions;
  /** Render scale, 0.1 – 2.0 (validated server-side). */
  scale?: number;
  printBackground?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

/**
 * Exactly one of `html` / `url` must be provided. Encoded as a discriminated
 * union so that supplying both — or neither — is a compile error.
 */
export type HtmlOrUrl =
  | {
      /** Raw HTML to render. Server limit: 1–2,000,000 chars. */
      html: string;
      url?: never;
    }
  | {
      /** URL to navigate to and render. Subject to server SSRF policy. */
      url: string;
      html?: never;
    };

export interface GenerateOptions {
  /** Extra CSS injected before rendering. Server limit: ≤ 500,000 chars. */
  css?: string;
  paper?: PaperOptions;
  options?: RenderOptions;
  /** Cookies set before navigation. Server limit: ≤ 50 entries. */
  cookies?: Array<{ name: string; value: string; domain: string }>;
  /** Extra request headers. Server limit: header value ≤ 8,192 chars each. */
  extraHeaders?: Record<string, string>;
}

/** Body for `generate` / `generateStream`. Exactly one of `html`/`url` is required. */
export type GenerateRequest = GenerateOptions & HtmlOrUrl;

export interface MergeRequest {
  /**
   * PDF IDs previously stored via generate/merge/etc. The tuple type enforces
   * a minimum of 2; the upper bound of 20 is validated server-side.
   */
  ids: [string, string, ...string[]];
}

export interface SplitRequest {
  id: string;
  /**
   * Page range string, e.g. "1-3", "2,4,6", "1-3,5".
   * Consult the Folio docs for the exact syntax accepted by Ghostscript.
   */
  pages: string;
}

export interface CompressRequest {
  id: string;
}

export interface PdfARequest {
  id: string;
  conformance?: "1b" | "2b" | "3b";
}

export interface ViewportOptions {
  /** Viewport width in px, 1–3840 (default 1280). */
  width?: number;
  /** Viewport height in px, 1–2160 (default 720). */
  height?: number;
}

export interface ClipRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  /** Extra CSS injected before rendering. */
  css?: string;
  viewport?: ViewportOptions;
  /** Image format. @default 'png' */
  format?: "png" | "jpeg" | "webp";
  /** Quality 1–100; applies to `jpeg`/`webp` only (validated server-side). */
  quality?: number;
  /** Capture the full scrollable page instead of just the viewport. @default false */
  fullPage?: boolean;
  /** Capture only a sub-region of the rendered page. */
  clip?: ClipRegion;
}

/** Body for `screenshot` / `screenshotStream`. Exactly one of `html`/`url` is required. */
export type ScreenshotRequest = ScreenshotOptions & HtmlOrUrl;

export interface StoredImage {
  url: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface StoredPdf {
  id: string;
  /** Presigned S3 URL to download the PDF. */
  url: string;
}

/**
 * Response of `get(id)`: the server issues a fresh presigned URL only (no id).
 */
export interface StoredUrl {
  url: string;
}

export interface FolioResponse<T> {
  statusCode: number;
  data: T;
}

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

/**
 * Automatic retry of transient failures. Pass `false` (on the client or a
 * single call) to disable.
 */
export interface RetryOptions {
  /** Maximum retries after the first attempt. @default 2 */
  maxRetries?: number;
  /** HTTP status codes to retry. @default [429, 503] */
  retryOn?: number[];
  /** Honor a `Retry-After` response header when present. @default true */
  respectRetryAfter?: boolean;
  /** Base backoff in ms (exponential with jitter). @default 200 */
  baseDelayMs?: number;
  /** Upper bound for any single backoff wait, in ms. @default 10_000 */
  maxDelayMs?: number;
}

export interface FolioClientOptions {
  /** Base URL of your Folio instance, e.g. "http://localhost:8080" */
  baseUrl: string;
  /**
   * Optional API key sent as the X-Api-Key header.
   * Only required when the server has API_KEY configured.
   */
  apiKey?: string;
  /**
   * Request timeout in milliseconds.
   * @default 30_000
   */
  timeout?: number;
  /**
   * Retry policy for transient failures (429/503 + network errors). Defaults to
   * `{ maxRetries: 2, retryOn: [429, 503], respectRetryAfter: true }`. Pass
   * `false` to disable retries entirely.
   */
  retry?: RetryOptions | false;
}

/** Per-call options accepted as the trailing argument of every client method. */
export interface FolioRequestOptions {
  /**
   * Caller-side cancellation. Combined with the client's internal timeout, so
   * either the caller or the timeout can abort the request. A caller-initiated
   * abort surfaces as the native `AbortError`; only the timeout is wrapped in
   * a {@link FolioTimeoutError}.
   */
  signal?: AbortSignal;
  /**
   * Override or disable retries for this call. Shallow-merged over the client's
   * policy; `false` disables, an object re-enables even if the client disabled.
   */
  retry?: RetryOptions | false;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class FolioError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "FolioError";
  }
}

/**
 * Thrown when a request exceeds the configured `timeout`. A subclass of
 * {@link FolioError} with `statusCode === 0`, so `instanceof FolioError` still
 * matches while `instanceof FolioTimeoutError` lets callers detect timeouts.
 * Timeouts are never retried (the time budget is already spent).
 */
export class FolioTimeoutError extends FolioError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message, 0, undefined);
    this.name = "FolioTimeoutError";
  }
}

/**
 * Thrown when the request fails at the network layer (DNS, connection refused,
 * TLS) before any HTTP status is available. A subclass of {@link FolioError}
 * with `statusCode === 0`; the underlying cause is available on `.body`.
 */
export class FolioNetworkError extends FolioError {
  constructor(message: string, cause: unknown) {
    super(message, 0, cause);
    this.name = "FolioNetworkError";
  }
}
