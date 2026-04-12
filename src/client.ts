import {
  CompressRequest,
  FolioClientOptions,
  FolioError,
  FolioResponse,
  GenerateRequest,
  MergeRequest,
  PdfARequest,
  ScreenshotRequest,
  SplitRequest,
  StoredImage,
  StoredPdf,
} from "./types.js";

/**
 * Client for the Folio serverless PDF API.
 *
 * @example
 * ```ts
 * const folio = new FolioClient({ baseUrl: "http://localhost:8080" });
 *
 * // Store generated PDF in S3 and get a presigned URL back
 * const result = await folio.generate({ html: "<h1>Hello</h1>" });
 * console.log(result.data.url);
 *
 * // Stream the PDF bytes directly
 * const bytes = await folio.generate({ html: "<h1>Hello</h1>", stream: true });
 * ```
 */
export class FolioClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(options: FolioClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.headers = { "Content-Type": "application/json" };
    if (options.apiKey) {
      this.headers["X-Api-Key"] = options.apiKey;
    }
  }

  // ---------------------------------------------------------------------------
  // PDF generation
  // ---------------------------------------------------------------------------

  /** Generate a PDF from HTML/CSS. */
  generate(body: GenerateRequest & { stream: true }): Promise<Uint8Array>;
  generate(
    body: GenerateRequest & { stream?: false }
  ): Promise<FolioResponse<StoredPdf>>;
  generate(body: GenerateRequest): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async generate(
    body: GenerateRequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return this.request("POST", "/pdf/generate", body, body.stream);
  }

  // ---------------------------------------------------------------------------
  // PDF retrieval & deletion
  // ---------------------------------------------------------------------------

  /** Retrieve a stored PDF by ID. Returns the presigned URL object. */
  async get(id: string): Promise<FolioResponse<StoredPdf>> {
    return this.request("GET", `/pdf/${encodeURIComponent(id)}`) as Promise<FolioResponse<StoredPdf>>;
  }

  /** Delete a stored PDF by ID. */
  async delete(id: string): Promise<void> {
    await this.requestRaw("DELETE", `/pdf/${encodeURIComponent(id)}`);
  }

  // ---------------------------------------------------------------------------
  // PDF operations
  // ---------------------------------------------------------------------------

  /** Merge 2–20 stored PDFs into one. */
  merge(body: MergeRequest & { stream: true }): Promise<Uint8Array>;
  merge(
    body: MergeRequest & { stream?: false }
  ): Promise<FolioResponse<StoredPdf>>;
  merge(body: MergeRequest): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async merge(
    body: MergeRequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return this.request("POST", "/pdf/merge", body, body.stream);
  }

  /** Extract a page range from a stored PDF. */
  split(body: SplitRequest & { stream: true }): Promise<Uint8Array>;
  split(
    body: SplitRequest & { stream?: false }
  ): Promise<FolioResponse<StoredPdf>>;
  split(body: SplitRequest): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async split(
    body: SplitRequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return this.request("POST", "/pdf/split", body, body.stream);
  }

  /** Compress a stored PDF. Requires Ghostscript on the server. */
  compress(body: CompressRequest & { stream: true }): Promise<Uint8Array>;
  compress(
    body: CompressRequest & { stream?: false }
  ): Promise<FolioResponse<StoredPdf>>;
  compress(
    body: CompressRequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async compress(
    body: CompressRequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return this.request("POST", "/pdf/compress", body, body.stream);
  }

  /** Convert a stored PDF to PDF/A archival format. Requires Ghostscript on the server. */
  pdfA(body: PdfARequest & { stream: true }): Promise<Uint8Array>;
  pdfA(
    body: PdfARequest & { stream?: false }
  ): Promise<FolioResponse<StoredPdf>>;
  pdfA(body: PdfARequest): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async pdfA(
    body: PdfARequest
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return this.request("POST", "/pdf/pdfa", body, body.stream);
  }

  // ---------------------------------------------------------------------------
  // Screenshot
  // ---------------------------------------------------------------------------

  /** Render HTML or a URL as an image (PNG/JPEG/WebP). */
  screenshot(body: ScreenshotRequest & { stream: true }): Promise<Uint8Array>;
  screenshot(body: ScreenshotRequest & { stream?: false }): Promise<FolioResponse<StoredImage>>;
  screenshot(body: ScreenshotRequest): Promise<FolioResponse<StoredImage> | Uint8Array>;
  async screenshot(body: ScreenshotRequest): Promise<FolioResponse<StoredImage> | Uint8Array> {
    return this.request('POST', '/screenshot', body, body.stream);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /** Check service health. Returns HTTP 200 when healthy. */
  async health(): Promise<unknown> {
    return this.request("GET", "/health");
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async request(
    method: string,
    path: string,
    body?: unknown,
    stream?: boolean
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    const response = await this.requestRaw(method, path, body);

    if (stream) {
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    }

    const json = (await response.json()) as FolioResponse<StoredPdf>;
    return json;
  }

  private async requestRaw(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok && response.status !== 204) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new FolioError(
        `Folio request failed: ${method} ${path} → ${response.status}`,
        response.status,
        errorBody
      );
    }

    return response;
  }
}
