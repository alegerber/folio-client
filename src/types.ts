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
  /** 0.1 – 2.0 */
  scale?: number;
  printBackground?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface GenerateRequest {
  /** Raw HTML to render. Server limit: 1–2,000,000 chars. Mutually exclusive with `url`. */
  html?: string;
  /** URL to navigate to and render. Mutually exclusive with `html`. Subject to server SSRF policy. */
  url?: string;
  /** Extra CSS injected before rendering. Server limit: ≤ 500,000 chars. */
  css?: string;
  paper?: PaperOptions;
  options?: RenderOptions;
  /** Cookies set before navigation. Server limit: ≤ 50 entries. */
  cookies?: Array<{ name: string; value: string; domain: string }>;
  /** Extra request headers. Server limit: header value ≤ 8,192 chars each. */
  extraHeaders?: Record<string, string>;
  /** When true the raw PDF bytes are returned instead of a storage URL. */
  stream?: boolean | undefined;
}

export interface MergeRequest {
  /** 2 – 20 PDF IDs previously stored via generate/merge/etc. */
  ids: [string, string, ...string[]];
  stream?: boolean | undefined;
}

export interface SplitRequest {
  id: string;
  /**
   * Page range string, e.g. "1-3", "2,4,6", "1-3,5".
   * Consult the Folio docs for the exact syntax accepted by Ghostscript.
   */
  pages: string;
  stream?: boolean | undefined;
}

export interface CompressRequest {
  id: string;
  stream?: boolean | undefined;
}

export interface PdfARequest {
  id: string;
  conformance?: "1b" | "2b" | "3b";
  stream?: boolean | undefined;
}

export interface ViewportOptions {
  width?: number;
  height?: number;
}

export interface ClipRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotRequest {
  html?: string;
  url?: string;
  css?: string;
  viewport?: ViewportOptions;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  fullPage?: boolean;
  clip?: ClipRegion;
  stream?: boolean | undefined;
}

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
}

// ---------------------------------------------------------------------------
// Error type
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
