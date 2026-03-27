import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase auth module before importing api-client
vi.mock("./firebase", () => ({
  auth: {
    currentUser: null,
  },
}));

vi.mock("firebase/auth", () => ({
  getIdToken: vi.fn().mockResolvedValue("mock-firebase-token"),
}));

import { fetchWithAuth, API_BASE_URL } from "./api-client";
import { auth } from "./firebase";
import { getIdToken } from "firebase/auth";

describe("fetchWithAuth", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    // Reset auth state
    (auth as any).currentUser = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── URL construction ────────────────────────────────────────

  it("constructs URL from relative endpoint", async () => {
    await fetchWithAuth("/v1/products");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/products"),
      expect.any(Object),
    );
    // Should prepend API_BASE_URL
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe(`${API_BASE_URL}/v1/products`);
  });

  it("constructs URL from relative endpoint without leading slash", async () => {
    await fetchWithAuth("v1/products");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe(`${API_BASE_URL}/v1/products`);
  });

  it("passes absolute URLs through unchanged", async () => {
    await fetchWithAuth("https://external-api.com/data");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("https://external-api.com/data");
  });

  // ── Headers ────────────────────────────────────────────────

  it("sets Content-Type header by default", async () => {
    await fetchWithAuth("/v1/test");

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
  });

  it("allows custom headers to be passed", async () => {
    await fetchWithAuth("/v1/test", {
      headers: { "X-Custom": "value" },
    });

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers["X-Custom"]).toBe("value");
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
  });

  // ── Auth behavior ──────────────────────────────────────────

  it("does NOT attach Authorization header when user is not logged in", async () => {
    await fetchWithAuth("/v1/test");

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers.Authorization).toBeUndefined();
  });

  it("attaches Authorization header when user is logged in", async () => {
    // Simulate logged-in user
    (auth as any).currentUser = { uid: "user-123" };

    await fetchWithAuth("/v1/test");

    expect(getIdToken).toHaveBeenCalled();
    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers.Authorization).toBe(
      "Bearer mock-firebase-token",
    );
  });

  it("skips auth header when requireAuth is false", async () => {
    (auth as any).currentUser = { uid: "user-123" };

    await fetchWithAuth("/v1/public", { requireAuth: false });

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.headers.Authorization).toBeUndefined();
  });

  // ── Request passthrough ────────────────────────────────────

  it("passes through method and body", async () => {
    const body = JSON.stringify({ name: "Test" });

    await fetchWithAuth("/v1/products", {
      method: "POST",
      body,
    });

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.body).toBe(body);
  });
});
