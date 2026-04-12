import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolioClient } from "./client.js";
import { FolioError } from "./types.js";

const BASE_URL = "http://localhost:8080";
const MOCK_PDF: import("./types.js").StoredPdf = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  url: "https://s3.example.com/my.pdf?presigned=1",
  createdAt: "2024-01-01T00:00:00.000Z",
};

function mockFetch(
  status: number,
  body: unknown,
  contentType = "application/json"
) {
  const isJson = contentType.includes("application/json");
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (isJson ? Promise.resolve(body) : Promise.reject(new Error("not json"))),
    text: () => Promise.resolve(String(body)),
    arrayBuffer: () =>
      Promise.resolve(new TextEncoder().encode("%PDF-stub").buffer),
  } as unknown as Response);
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
      const fetch = mockFetch(200, null, "application/pdf");
      vi.stubGlobal("fetch", fetch);

      const bytes = await client.generate({ html: "<h1>Hi</h1>", stream: true });

      expect(bytes).toBeInstanceOf(Uint8Array);
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
    it("sends GET /pdf/:id", async () => {
      const fetch = mockFetch(200, { statusCode: 200, data: MOCK_PDF });
      vi.stubGlobal("fetch", fetch);

      const result = await client.get(MOCK_PDF.id);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/pdf/${MOCK_PDF.id}`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ statusCode: 200, data: MOCK_PDF });
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
      const fetch = mockFetch(200, null, "image/png");
      vi.stubGlobal("fetch", fetch);

      const bytes = await client.screenshot({ url: "https://example.com", stream: true });

      expect(bytes).toBeInstanceOf(Uint8Array);
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
  });
});
