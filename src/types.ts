// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface PaperOptions {
  /** e.g. "A4", "Letter", "Legal" */
  size?: string;
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
  html?: string;
  url?: string;
  css?: string;
  paper?: PaperOptions;
  options?: RenderOptions;
  cookies?: Array<{ name: string; value: string; domain: string }>;
  extraHeaders?: Record<string, string>;
  /** When true the raw PDF bytes are returned instead of a storage URL. */
  stream?: boolean;
}

export interface MergeRequest {
  /** 2 – 20 PDF IDs previously stored via generate/merge/etc. */
  ids: [string, string, ...string[]];
  stream?: boolean;
}

export interface SplitRequest {
  id: string;
  /**
   * Page range string, e.g. "1-3", "2,4,6", "1-3,5".
   * Consult the Folio docs for the exact syntax accepted by Ghostscript.
   */
  pages: string;
  stream?: boolean;
}

export interface CompressRequest {
  id: string;
  stream?: boolean;
}

export interface PdfARequest {
  id: string;
  conformance?: "1b" | "2b" | "3b";
  stream?: boolean;
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
  stream?: boolean;
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
  /** ISO timestamp */
  createdAt: string;
  /** File size in bytes */
  size?: number;
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
