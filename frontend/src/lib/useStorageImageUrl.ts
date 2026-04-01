import { useEffect, useRef, useState } from "react";
import { getAssetDownloadUrl } from "./assets-api";

/** Cache of resolved download URLs (only caches successful results, never null) */
const resolvedUrlCache = new Map<string, string>();

/** In-flight request deduplication */
const inflightRequests = new Map<string, Promise<string | null>>();

/**
 * Hook that resolves a Firebase Storage key to a download URL via backend API.
 * Only caches successful results — 404s/nulls are retried on next call.
 */
export function useStorageImageUrl(
  businessId: string | undefined,
  storageKey: string | undefined,
): string | null {
  // Sync: check cache first (no effect needed)
  const cacheKey = storageKey ?? "";
  const cachedUrl =
    businessId && storageKey ? resolvedUrlCache.get(cacheKey) : undefined;

  const [asyncUrl, setAsyncUrl] = useState<string | null>(null);
  const [asyncFetchedKey, setAsyncFetchedKey] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Only fetch async if not already cached and we have both params
  useEffect(() => {
    if (
      !businessId ||
      !storageKey ||
      cachedUrl !== undefined ||
      storageKey === asyncFetchedKey
    )
      return;

    // Deduplicate concurrent requests for the same key
    if (!inflightRequests.has(cacheKey)) {
      inflightRequests.set(
        cacheKey,
        getAssetDownloadUrl(businessId, storageKey),
      );
    }

    const promise = inflightRequests.get(cacheKey)!;

    promise
      .then((result) => {
        if (!mountedRef.current) return;
        // Only cache successful URLs (non-null)
        if (result) {
          resolvedUrlCache.set(cacheKey, result);
        }
        setAsyncUrl(result);
        setAsyncFetchedKey(storageKey);
      })
      .finally(() => {
        inflightRequests.delete(cacheKey);
      });
  }, [businessId, storageKey, cacheKey, cachedUrl, asyncFetchedKey]);

  // Return cached value if available, otherwise async result
  if (cachedUrl !== undefined) return cachedUrl;
  return asyncUrl;
}

/** Clear the entire URL cache (useful after uploads to force fresh URLs) */
export function clearStorageUrlCache() {
  resolvedUrlCache.clear();
  inflightRequests.clear();
}
