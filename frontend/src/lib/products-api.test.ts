import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetchWithAuth
const mockFetchWithAuth = vi.fn();
vi.mock("./api-client", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

import { createProduct, updateProduct, deleteProduct } from "./products-api";

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("products-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createProduct ──────────────────────────────────────────

  describe("createProduct", () => {
    it("calls correct endpoint with POST and returns id", async () => {
      mockFetchWithAuth.mockResolvedValue(mockResponse({ id: "prod-123" }));

      const result = await createProduct("biz-1", { name: "Widget" });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/v1/businesses/biz-1/products",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Widget" }),
        }),
      );
      expect(result).toEqual({ id: "prod-123" });
    });

    it("throws on failure", async () => {
      mockFetchWithAuth.mockResolvedValue(
        mockResponse("Bad Request", false, 400),
      );

      await expect(createProduct("biz-1", { name: "" })).rejects.toThrow(
        "Failed to create product",
      );
    });

    it("encodes businessId in URL", async () => {
      mockFetchWithAuth.mockResolvedValue(mockResponse({ id: "p1" }));

      await createProduct("biz/special&chars", { name: "Test" });

      const calledUrl = mockFetchWithAuth.mock.calls[0][0];
      expect(calledUrl).toContain("biz%2Fspecial%26chars");
    });
  });

  // ── updateProduct ──────────────────────────────────────────

  describe("updateProduct", () => {
    it("calls correct endpoint with PATCH", async () => {
      mockFetchWithAuth.mockResolvedValue(mockResponse(null));

      await updateProduct("biz-1", "prod-1", { name: "Updated" });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/v1/businesses/biz-1/products/prod-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Updated" }),
        }),
      );
    });

    it("throws on failure", async () => {
      mockFetchWithAuth.mockResolvedValue(
        mockResponse("Not Found", false, 404),
      );

      await expect(
        updateProduct("biz-1", "bad-id", { name: "X" }),
      ).rejects.toThrow("Failed to update product");
    });
  });

  // ── deleteProduct ──────────────────────────────────────────

  describe("deleteProduct", () => {
    it("calls correct endpoint with DELETE", async () => {
      mockFetchWithAuth.mockResolvedValue(mockResponse(null, true, 204));

      await deleteProduct("biz-1", "prod-1");

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/v1/businesses/biz-1/products/prod-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws on non-204 failure", async () => {
      mockFetchWithAuth.mockResolvedValue(
        mockResponse("Forbidden", false, 403),
      );

      await expect(deleteProduct("biz-1", "prod-1")).rejects.toThrow(
        "Failed to delete product",
      );
    });
  });
});
