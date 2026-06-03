import {
  CompressRequest,
  FolioClientOptions,
  FolioError,
  FolioNetworkError,
  FolioRequestOptions,
  FolioResponse,
  FolioTimeoutError,
  GenerateRequest,
  MergeRequest,
  PdfARequest,
  ScreenshotRequest,
  SplitRequest,
  StoredImage,
  StoredPdf,
  StoredUrl,
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
 * // Return the raw PDF bytes directly (buffered in memory)
 * const bytes = await folio.generate({ html: "<h1>Hello</h1>", stream: true });
 * ```
 */
export class FolioClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;

  constructor(options: FolioClientOptions) {
    // Strip any number of trailing slashes so `baseUrl + path` never doubles up.
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.apiKey = options.apiKey;
  }

  // ---------------------------------------------------------------------------
  // PDF generation
  // ---------------------------------------------------------------------------

  /** Generate a PDF from HTML/CSS. */
  generate(
    body: GenerateRequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  generate(
    body: GenerateRequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>>;
  generate(
    body: GenerateRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async generate(
    body: GenerateRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/pdf/generate", body, options)
      : this.requestJson<FolioResponse<StoredPdf>>(
          "POST",
          "/pdf/generate",
          body,
          options
        );
  }

  // ---------------------------------------------------------------------------
  // PDF retrieval & deletion
  // ---------------------------------------------------------------------------

  /** Retrieve a fresh presigned URL for a stored PDF by ID. */
  async get(
    id: string,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredUrl>> {
    return this.requestJson<FolioResponse<StoredUrl>>(
      "GET",
      `/pdf/${encodeURIComponent(id)}`,
      undefined,
      options
    );
  }

  /** Delete a stored PDF by ID. */
  async delete(id: string, options?: FolioRequestOptions): Promise<void> {
    // send() reads the whole body, so the keep-alive socket is released even if
    // the server returns a 2xx with a body (not just a bodyless 204).
    await this.send("DELETE", `/pdf/${encodeURIComponent(id)}`, undefined, options);
  }

  // ---------------------------------------------------------------------------
  // PDF operations
  // ---------------------------------------------------------------------------

  /** Merge 2–20 stored PDFs into one. */
  merge(
    body: MergeRequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  merge(
    body: MergeRequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>>;
  merge(
    body: MergeRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async merge(
    body: MergeRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/pdf/merge", body, options)
      : this.requestJson<FolioResponse<StoredPdf>>("POST", "/pdf/merge", body, options);
  }

  /** Extract a page range from a stored PDF. */
  split(
    body: SplitRequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  split(
    body: SplitRequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>>;
  split(
    body: SplitRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async split(
    body: SplitRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/pdf/split", body, options)
      : this.requestJson<FolioResponse<StoredPdf>>("POST", "/pdf/split", body, options);
  }

  /** Compress a stored PDF. Requires Ghostscript on the server. */
  compress(
    body: CompressRequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  compress(
    body: CompressRequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>>;
  compress(
    body: CompressRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async compress(
    body: CompressRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/pdf/compress", body, options)
      : this.requestJson<FolioResponse<StoredPdf>>("POST", "/pdf/compress", body, options);
  }

  /** Convert a stored PDF to PDF/A archival format. Requires Ghostscript on the server. */
  pdfA(
    body: PdfARequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  pdfA(
    body: PdfARequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>>;
  pdfA(
    body: PdfARequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array>;
  async pdfA(
    body: PdfARequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/pdf/pdfa", body, options)
      : this.requestJson<FolioResponse<StoredPdf>>("POST", "/pdf/pdfa", body, options);
  }

  // ---------------------------------------------------------------------------
  // Screenshot
  // ---------------------------------------------------------------------------

  /** Render HTML or a URL as an image (PNG/JPEG/WebP). */
  screenshot(
    body: ScreenshotRequest & { stream: true },
    options?: FolioRequestOptions
  ): Promise<Uint8Array>;
  screenshot(
    body: ScreenshotRequest & { stream?: false },
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredImage>>;
  screenshot(
    body: ScreenshotRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredImage> | Uint8Array>;
  async screenshot(
    body: ScreenshotRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredImage> | Uint8Array> {
    return body.stream
      ? this.requestStream("POST", "/screenshot", body, options)
      : this.requestJson<FolioResponse<StoredImage>>("POST", "/screenshot", body, options);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Check service health. `/health` is public — the client never sends the API
   * key to it, even when one is configured.
   */
  async health(options?: FolioRequestOptions): Promise<{ status: string }> {
    return this.requestJson<{ status: string }>("GET", "/health", undefined, options);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build a fresh per-request header set. The API key is withheld from `/health`. */
  private buildHeaders(path: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, application/octet-stream",
    };
    if (this.apiKey && path !== "/health") {
      headers["X-Api-Key"] = this.apiKey;
    }
    return headers;
  }

  /** Perform a request and return the parsed JSON envelope. */
  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: FolioRequestOptions
  ): Promise<T> {
    const { status, bytes } = await this.send(method, path, body, options);
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) {
      throw new FolioError(
        `Folio returned an empty body: ${method} ${path}`,
        status,
        ""
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FolioError(
        `Folio returned a non-JSON body: ${method} ${path}`,
        status,
        text
      );
    }
  }

  /** Perform a request and return the raw response bytes. */
  private async requestStream(
    method: string,
    path: string,
    body?: unknown,
    options?: FolioRequestOptions
  ): Promise<Uint8Array> {
    const { bytes } = await this.send(method, path, body, options);
    return bytes;
  }

  /**
   * Core transport: issues the request, reads the **entire** body while the
   * timeout is still armed, and maps failures to typed errors:
   * - the configured timeout → {@link FolioTimeoutError}
   * - a caller-initiated abort → the native `AbortError` (rethrown as-is)
   * - a network-layer failure → {@link FolioNetworkError}
   * - a non-2xx response → {@link FolioError}
   * The body is read exactly once (as bytes) so callers can decode it as JSON
   * or binary without double-reading the stream.
   */
  private async send(
    method: string,
    path: string,
    body?: unknown,
    options?: FolioRequestOptions
  ): Promise<{ status: number; bytes: Uint8Array }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeout);

    // Forward a caller signal onto our controller without AbortSignal.any
    // (which is Node 20.3+); this keeps the Node floor at >=18.
    const callerSignal = options?.signal;
    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const init: RequestInit = {
        method,
        headers: this.buildHeaders(path),
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(`${this.baseUrl}${path}`, init);

        // Read the body under the still-armed timeout — fetch() resolves on
        // response headers, so a slow/stalled body would otherwise be unbounded.
        const bytes = new Uint8Array(await response.arrayBuffer());

        if (!response.ok) {
          throw new FolioError(
            `Folio request failed: ${method} ${path} → ${response.status}`,
            response.status,
            decodeErrorBody(bytes)
          );
        }

        return { status: response.status, bytes };
      } catch (err) {
        if (err instanceof FolioError) throw err; // the non-2xx error above
        if (timedOut) {
          throw new FolioTimeoutError(
            `Folio request timed out after ${this.timeout}ms: ${method} ${path}`,
            this.timeout
          );
        }
        if (callerSignal?.aborted) throw err; // caller cancellation → native AbortError
        throw new FolioNetworkError(`Folio network error: ${method} ${path}`, err);
      }
    } finally {
      clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}

/** Decode an error body once: parse as JSON when possible, else keep raw text. */
function decodeErrorBody(bytes: Uint8Array): unknown {
  const text = new TextDecoder().decode(bytes);
  if (!text) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
