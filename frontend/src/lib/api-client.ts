import { auth } from "./firebase";
import { getIdToken } from "firebase/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * A wrapper around the native `fetch` function that automatically attaches
 * the Firebase ID token if the user is authenticated.
 */
export async function fetchWithAuth(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { requireAuth = true, headers = {}, ...rest } = options;

  console.log('[fetchWithAuth] auth:', auth);
  console.log('[fetchWithAuth] auth.currentUser:', auth?.currentUser);
  console.log('[fetchWithAuth] requireAuth:', requireAuth);

  let authHeader = {};
  if (requireAuth && auth?.currentUser) {
    try {
      const token = await getIdToken(auth.currentUser);
      console.log('[fetchWithAuth] Got token:', token ? 'YES' : 'NO');
      authHeader = { Authorization: `Bearer ${token}` };
    } catch (error) {
      console.error("Failed to fetch Firebase ID token for request:", error);
      if (requireAuth) {
        throw new Error("Authentication required but token fetch failed");
      }
    }
  } else {
    console.log('[fetchWithAuth] Skipping auth - auth or currentUser is null');
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(endpoint);
  let url: string;
  if (isAbsoluteUrl) {
    url = endpoint;
  } else {
    const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    url = `${normalizedBase}${normalizedEndpoint}`;
  }

  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...headers,
    },
  });
}
