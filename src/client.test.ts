import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolioClient } from "./client.js";
import { FolioError, FolioNetworkError, FolioTimeoutError } from "./types.js";

const BASE_URL = "http://localhost:8080";
const MOCK_PDF: import("./types.js").StoredPdf = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  url: "https://s3.example.com/my.pdf?presigned=1",
};

// Build a *real* WHATWG Response so json()/text()/arrayBuffer() share one body
// stream — exactly like undici in production. A hand-rolled mock with three
// independent body functions cannot reproduce single-stream consumption and so
// silently hides double-read bugs.
function mockFetch(
  status: number,
  body: unknown,
  contentType = "application/json"
) {
  const isJson = contentType.includes("application/json");
  const hasBody = body !== null && body !== undefined && status !== 204;
  let payload: string | null = null;
  if (hasBody) {
    // JSON bodies are serialized; non-JSON test bodies are passed through as-is
    // (they are always strings), avoiding String(unknown) -> "[object Object]".
    payload = !isJson && typeof body === "string" ? body : JSON.stringify(body);
  }
  return vi
    .fn()
    .mockResolvedValue(
      new Response(payload, { status, headers: { "content-type": contentType } })
    );
}

describe("FolioClient", () => {
  let client: FolioClient;

  beforeEach(() => {
    client = new FolioClient({ baseUrl: BASE_URL, apiKey: "test-key-32-chars-padded-00000000" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generate", () => {
    it("posts to /pdf/generate and returns StoredPdf", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      const result = await client.generate({ html: "<h1>Hi</h1>" });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/generate`,
        expect.objectContaining({ method: "POST" })
      );
      expect(result).toEqual({ statusCode: 200, data: MOCK_PDF });
    });

    it("returns Uint8Array when stream: true", async () => {
      const fetch = mockFetch(200, "%PDF-1.4 stub bytes", "application/pdf");
      vi.stubGlobal("fetch", fetch);

      const bytes = await client.generate({ html: "<h1>Hi</h1>", stream: true });

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
    });

    it("accepts url instead of html", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.generate({ url: "https://example.com" });

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ url: "https://example.com" });
    });
  });

  describe("get", () => {
    it("sends GET /pdf/:id and returns a presigned URL ({ url } only)", async () => {
      const data = { url: MOCK_PDF.url };
      const fetch = mockFetch(200, { statusCode: 200, data });
      vi.stubGlobal("fetch", fetch);

      const result = await client.get(MOCK_PDF.id);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/${MOCK_PDF.id}`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ statusCode: 200, data });
    });
  });

  describe("health", () => {
    it("returns the status payload (not wrapped in FolioResponse)", async () => {
      const fetch = mockFetch(200, { status: "ok" });
      vi.stubGlobal("fetch", fetch);

      const result = await client.health();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/health`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ status: "ok" });
    });
  });

  describe("delete", () => {
    it("sends DELETE /pdf/:id and resolves on 204", async () => {
      const fetch = mockFetch(204, null);
      vi.stubGlobal("fetch", fetch);

      await expect(client.delete(MOCK_PDF.id)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/${MOCK_PDF.id}`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("merge", () => {
    it("posts to /pdf/merge", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.merge({ ids: ["id-1", "id-2"] });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/merge`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("split", () => {
    it("posts to /pdf/split", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.split({ id: MOCK_PDF.id, pages: "1-3" });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/split`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("compress", () => {
    it("posts to /pdf/compress", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.compress({ id: MOCK_PDF.id });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/compress`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("pdfA", () => {
    it("posts to /pdf/pdfa with conformance level", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.pdfA({ id: MOCK_PDF.id, conformance: "2b" });

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ conformance: "2b" });
    });
  });

  describe("screenshot", () => {
    const MOCK_IMAGE: import("./types.js").StoredImage = {
      url: "https://s3.example.com/my.png?presigned=1",
    };

    it("posts to /screenshot and returns StoredImage", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_IMAGE });
      vi.stubGlobal("fetch", fetch);

      const result = await client.screenshot({ html: "<h1>Hi</h1>" });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/screenshot`,
        expect.objectContaining({ method: "POST" })
      );
      expect(result).toEqual({ statusCode: 200, data: MOCK_IMAGE });
    });

    it("returns Uint8Array when stream: true", async () => {
      const fetch = mockFetch(200, "\x89PNG stub bytes", "image/png");
      vi.stubGlobal("fetch", fetch);

      const bytes = await client.screenshot({ url: "https://example.com", stream: true });

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("throws FolioError on non-2xx response", async () => {
      const fetch = mockFetch(422, { message: "Invalid HTML" });
      vi.stubGlobal("fetch", fetch);

      await expect(client.generate({ html: "" })).rejects.toThrow(FolioError);
    });

    it("includes statusCode on FolioError", async () => {
      const fetch = mockFetch(401, { message: "Unauthorized" });
      vi.stubGlobal("fetch", fetch);

      const error: unknown = await client.get("any").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(FolioError);
      expect((error as FolioError).statusCode).toBe(401);
    });
  });

  describe("auth header", () => {
    it("sends X-Api-Key when apiKey is provided", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.get(MOCK_PDF.id);

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(
        "test-key-32-chars-padded-00000000"
      );
    });

    it("omits X-Api-Key when no apiKey configured", async () => {
      const noAuthClient = new FolioClient({ baseUrl: BASE_URL });
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await noAuthClient.get(MOCK_PDF.id);

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["X-Api-Key"]).toBeUndefined();
    });

    it("does NOT send X-Api-Key to the public /health endpoint", async () => {
      const fetch = mockFetch(200, { status: "ok" });
      vi.stubGlobal("fetch", fetch);

      await client.health();

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["X-Api-Key"]).toBeUndefined();
    });
  });

  describe("non-JSON / empty bodies", () => {
    it("throws FolioError (not a raw TypeError) when an error body is not JSON", async () => {
      const fetch = mockFetch(502, "<html>Bad Gateway</html>", "text/html");
      vi.stubGlobal("fetch", fetch);

      const err: unknown = await client
        .generate({ html: "<h1>x</h1>" })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(FolioError);
      expect((err as FolioError).statusCode).toBe(502);
    });

    it("throws FolioError (not a raw SyntaxError) on an empty 2xx JSON body", async () => {
      const fetch = mockFetch(200, null);
      vi.stubGlobal("fetch", fetch);

      const err: unknown = await client.get("some-id").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(FolioError);
    });
  });

  describe("request headers", () => {
    it("sends an Accept header", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      await client.get(MOCK_PDF.id);

      const [, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["Accept"]).toBeDefined();
    });
  });

  describe("stream flag typing", () => {
    it("accepts stream: undefined and resolves to a FolioResponse", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      // Must compile under exactOptionalPropertyTypes (verified by `npm run typecheck`).
      const result = await client.generate({ html: "<h1>x</h1>", stream: undefined });

      expect(result).toEqual({ statusCode: 200, data: MOCK_PDF });
    });
  });

  describe("timeout & network errors", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("throws FolioTimeoutError when the request exceeds the timeout", async () => {
      vi.useFakeTimers();
      const fetch = vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("This operation was aborted", "AbortError"))
          );
        })
      );
      vi.stubGlobal("fetch", fetch);

      const fast = new FolioClient({ baseUrl: BASE_URL, timeout: 1000 });
      const p = fast.get("id");
      const assertion = expect(p).rejects.toBeInstanceOf(FolioTimeoutError);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    });

    it("covers the body download with the timeout (aborts a stalled body)", async () => {
      vi.useFakeTimers();
      // fetch resolves on headers, but the body read never settles until abort.
      const fetch = vi.fn((_url: string, init: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () =>
            new Promise((_res, reject) => {
              init.signal?.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError"))
              );
            }),
        } as unknown as Response)
      );
      vi.stubGlobal("fetch", fetch);

      const fast = new FolioClient({ baseUrl: BASE_URL, timeout: 1000 });
      const p = fast.get("id");
      const assertion = expect(p).rejects.toBeInstanceOf(FolioTimeoutError);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    });

    it("wraps a fetch network failure in FolioNetworkError", async () => {
      const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
      vi.stubGlobal("fetch", fetch);

      const err: unknown = await client.get("id").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(FolioNetworkError);
    });

    it("rethrows a caller-initiated abort as a native AbortError (not FolioTimeoutError)", async () => {
      const fetch = vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
      );
      vi.stubGlobal("fetch", fetch);

      const ac = new AbortController();
      const settled = client.get("id", { signal: ac.signal }).catch((e: unknown) => e);
      ac.abort();
      const err = await settled;

      expect(err).not.toBeInstanceOf(FolioError);
      expect((err as Error).name).toBe("AbortError");
    });
  });
});
