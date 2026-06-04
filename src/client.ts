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
  RetryOptions,
  ScreenshotRequest,
  SplitRequest,
  StoredImage,
  StoredPdf,
  StoredUrl,
} from "./types.js";

type ResolvedRetry = Required<RetryOptions>;

const DEFAULT_RETRY: ResolvedRetry = {
  maxRetries: 2,
  retryOn: [429, 503],
  respectRetryAfter: true,
  baseDelayMs: 200,
  maxDelayMs: 10_000,
};

/**
 * Client for the Folio serverless PDF API.
 *
 * @example
 * ```ts
 * const folio = new FolioClient({ baseUrl: "http://localhost:8080" });
 *
 * // Store the PDF in S3 and get a presigned URL back
 * const { data } = await folio.generate({ html: "<h1>Hello</h1>" });
 *
 * // Stream the raw PDF bytes (ReadableStream); buffer with collect() if needed
 * const stream = await folio.generateStream({ html: "<h1>Hello</h1>" });
 * const bytes = await collect(stream);
 * ```
 */
export class FolioClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly retry: ResolvedRetry | null;

  constructor(options: FolioClientOptions) {
    // Strip any number of trailing slashes so `baseUrl + path` never doubles up.
    // A manual trim (not a `/\/+$/` regex) avoids polynomial backtracking.
    let end = options.baseUrl.length;
    while (end > 0 && options.baseUrl.charCodeAt(end - 1) === 47 /* "/" */) {
      end--;
    }
    this.baseUrl = options.baseUrl.slice(0, end);
    this.timeout = options.timeout ?? 30_000;
    this.apiKey = options.apiKey;
    this.retry = resolveRetry(DEFAULT_RETRY, options.retry);
  }

  // ---------------------------------------------------------------------------
  // PDF generation
  // ---------------------------------------------------------------------------

  /** Generate a PDF from HTML/CSS and store it; returns a presigned URL. */
  async generate(
    body: GenerateRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>> {
    return this.requestJson("POST", "/pdf/generate", body, options);
  }

  /** Generate a PDF and stream the raw bytes (`ReadableStream<Uint8Array>`). */
  async generateStream(
    body: GenerateRequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/pdf/generate", body, options);
  }

  // ---------------------------------------------------------------------------
  // PDF retrieval & deletion
  // ---------------------------------------------------------------------------

  /** Retrieve a fresh presigned URL for a stored PDF by ID. */
  async get(
    id: string,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredUrl>> {
    return this.requestJson(
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

  /** Merge 2–20 stored PDFs into one; returns a presigned URL. */
  async merge(
    body: MergeRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>> {
    return this.requestJson("POST", "/pdf/merge", body, options);
  }

  /** Merge 2–20 stored PDFs and stream the raw bytes. */
  async mergeStream(
    body: MergeRequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/pdf/merge", body, options);
  }

  /** Extract a page range from a stored PDF; returns a presigned URL. */
  async split(
    body: SplitRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>> {
    return this.requestJson("POST", "/pdf/split", body, options);
  }

  /** Extract a page range and stream the raw bytes. */
  async splitStream(
    body: SplitRequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/pdf/split", body, options);
  }

  /** Compress a stored PDF (requires Ghostscript); returns a presigned URL. */
  async compress(
    body: CompressRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>> {
    return this.requestJson("POST", "/pdf/compress", body, options);
  }

  /** Compress a stored PDF and stream the raw bytes. */
  async compressStream(
    body: CompressRequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/pdf/compress", body, options);
  }

  /** Convert a stored PDF to PDF/A (requires Ghostscript); returns a presigned URL. */
  async pdfA(
    body: PdfARequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredPdf>> {
    return this.requestJson("POST", "/pdf/pdfa", body, options);
  }

  /** Convert a stored PDF to PDF/A and stream the raw bytes. */
  async pdfAStream(
    body: PdfARequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/pdf/pdfa", body, options);
  }

  // ---------------------------------------------------------------------------
  // Screenshot
  // ---------------------------------------------------------------------------

  /** Render HTML or a URL as an image and store it; returns a presigned URL. */
  async screenshot(
    body: ScreenshotRequest,
    options?: FolioRequestOptions
  ): Promise<FolioResponse<StoredImage>> {
    return this.requestJson("POST", "/screenshot", body, options);
  }

  /** Render HTML or a URL as an image and stream the raw bytes. */
  async screenshotStream(
    body: ScreenshotRequest,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    return this.fetchStream("POST", "/screenshot", body, options);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Check service health. `/health` is public — the client never sends the API
   * key to it, even when one is configured.
   */
  async health(options?: FolioRequestOptions): Promise<{ status: string }> {
    return this.requestJson("GET", "/health", undefined, options);
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

  /** Perform a request (with retry) and return the parsed JSON envelope. */
  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: FolioRequestOptions
  ): Promise<T> {
    const { status, bytes } = await this.send(method, path, body, options);
    const text = new TextDecoder().decode(bytes);
    if (!text.trim()) {
      throw new FolioError(`Folio returned an empty body: ${method} ${path}`, status, "");
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

  /**
   * Buffered transport with retry: reads the whole body under the timeout, and
   * retries transient failures (configured statuses + network errors).
   */
  private async send(
    method: string,
    path: string,
    body?: unknown,
    options?: FolioRequestOptions
  ): Promise<{ status: number; bytes: Uint8Array }> {
    const retry = effectiveRetry(this.retry, options?.retry);
    let attempt = 0;
    for (;;) {
      attempt++;
      let response: Response;
      let bytes: Uint8Array;
      try {
        const out = await this.fetchOnce(method, path, body, options?.signal);
        response = out.response;
        bytes = out.bytes;
      } catch (err) {
        if (
          err instanceof FolioNetworkError &&
          retry &&
          attempt <= retry.maxRetries
        ) {
          await sleep(computeDelayMs(retry, attempt - 1, undefined));
          continue;
        }
        throw err; // timeout, caller-abort, or network error with no retries left
      }

      if (response.ok) return { status: response.status, bytes };

      if (retry && attempt <= retry.maxRetries && retry.retryOn.includes(response.status)) {
        await sleep(computeDelayMs(retry, attempt - 1, response));
        continue;
      }

      throw new FolioError(
        `Folio request failed: ${method} ${path} → ${response.status}`,
        response.status,
        decodeErrorBody(bytes)
      );
    }
  }

  /** One buffered attempt: fetch + full body read under the timeout, typed-error mapping. */
  private async fetchOnce(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal | undefined
  ): Promise<{ response: Response; bytes: Uint8Array }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeout);
    const onCallerAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const init: RequestInit = {
        method,
        headers: this.buildHeaders(path),
        signal: controller.signal,
      };
      if (body !== undefined) init.body = JSON.stringify(body);

      try {
        const response = await fetch(`${this.baseUrl}${path}`, init);
        // Read the body under the still-armed timeout.
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { response, bytes };
      } catch (err) {
        if (timedOut) {
          throw new FolioTimeoutError(
            `Folio request timed out after ${this.timeout}ms: ${method} ${path}`,
            this.timeout
          );
        }
        if (signal?.aborted) throw err; // caller cancellation → native AbortError
        throw new FolioNetworkError(`Folio network error: ${method} ${path}`, err);
      }
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onCallerAbort);
    }
  }

  /**
   * Streaming transport: retries the **initial** response (before any bytes are
   * streamed), then returns `response.body`. The timeout bounds only the
   * connect + headers phase — once headers arrive it is disarmed so it cannot
   * kill a long-lived body; the caller's `signal` still cancels the stream.
   */
  private async fetchStream(
    method: string,
    path: string,
    body: unknown,
    options?: FolioRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const retry = effectiveRetry(this.retry, options?.retry);
    const signal = options?.signal;
    // The server returns raw bytes (instead of storing to S3) when stream is set.
    const streamBody =
      body !== undefined ? { ...(body as object), stream: true } : { stream: true };
    let attempt = 0;
    for (;;) {
      attempt++;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeout);
      const onCallerAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onCallerAbort, { once: true });
      }

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: this.buildHeaders(path),
          body: JSON.stringify(streamBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onCallerAbort);
        if (timedOut) {
          throw new FolioTimeoutError(
            `Folio request timed out after ${this.timeout}ms: ${method} ${path}`,
            this.timeout
          );
        }
        if (signal?.aborted) throw err;
        if (retry && attempt <= retry.maxRetries) {
          await sleep(computeDelayMs(retry, attempt - 1, undefined));
          continue;
        }
        throw new FolioNetworkError(`Folio network error: ${method} ${path}`, err);
      }

      if (!response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onCallerAbort);
        if (
          retry &&
          attempt <= retry.maxRetries &&
          retry.retryOn.includes(response.status)
        ) {
          await sleep(computeDelayMs(retry, attempt - 1, response));
          continue;
        }
        throw new FolioError(
          `Folio request failed: ${method} ${path} → ${response.status}`,
          response.status,
          decodeErrorBody(bytes)
        );
      }

      // Headers arrived: disarm the timeout so it cannot abort the body mid-stream.
      // Keep the caller-signal → controller link so the caller can still cancel.
      clearTimeout(timer);
      if (!response.body) {
        if (signal) signal.removeEventListener("abort", onCallerAbort);
        throw new FolioError(
          `Folio returned no response body: ${method} ${path}`,
          response.status,
          ""
        );
      }
      return response.body;
    }
  }
}

/** Buffer a `ReadableStream<Uint8Array>` (e.g. from `generateStream`) into a single `Uint8Array`. */
export async function collect(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Resolve the client-level retry config: `false` → disabled, else merge over defaults. */
function resolveRetry(
  defaults: ResolvedRetry,
  opt: RetryOptions | false | undefined
): ResolvedRetry | null {
  if (opt === false) return null;
  return { ...defaults, ...(opt ?? {}) };
}

/** Apply a per-call retry override over the client policy. */
function effectiveRetry(
  clientRetry: ResolvedRetry | null,
  callRetry: RetryOptions | false | undefined
): ResolvedRetry | null {
  if (callRetry === undefined) return clientRetry;
  if (callRetry === false) return null;
  return { ...(clientRetry ?? DEFAULT_RETRY), ...callRetry };
}

/** Backoff for retry number `n` (0-based): Retry-After if present, else exponential + jitter. */
function computeDelayMs(
  retry: ResolvedRetry,
  n: number,
  response: Response | undefined
): number {
  if (retry.respectRetryAfter && response) {
    const header = response.headers.get("retry-after");
    if (header) {
      const seconds = Number(header);
      let ms: number | undefined;
      if (Number.isFinite(seconds)) ms = seconds * 1000;
      else {
        const when = Date.parse(header);
        if (!Number.isNaN(when)) ms = when - Date.now();
      }
      if (ms !== undefined && ms >= 0) return Math.min(ms, retry.maxDelayMs);
    }
  }
  const exponential = Math.min(retry.baseDelayMs * 2 ** n, retry.maxDelayMs);
  return exponential * (0.5 + Math.random() * 0.5); // jitter in [0.5, 1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
