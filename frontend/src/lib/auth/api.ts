export const AUTH_API_PLACEHOLDERS = {
  baseUrl: "__BACKEND_AUTH_BASE_URL__",
  loginEndpoint: "/auth/login",
  signupEndpoint: "/auth/signup",
  tokenHeader: "Authorization: Bearer __ID_TOKEN__",
  notes:
    "Replace AUTH_API_PLACEHOLDERS with real backend auth values when the backend auth contract is finalized.",
} as const;

export interface AuthApiRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthApiPlaceholderResponse {
  ok: false;
  status: "placeholder_not_implemented";
  endpoint: string;
  method: "POST";
  message: string;
  placeholderBaseUrl: string;
  placeholderHeader: string;
  requestPreview: AuthApiRequest;
}

function buildPlaceholderAuthResponse(
  endpoint: string,
  payload: AuthApiRequest,
): AuthApiPlaceholderResponse {
  return {
    ok: false,
    status: "placeholder_not_implemented",
    endpoint,
    method: "POST",
    message:
      "Placeholder auth API only. Replace the base URL and endpoint contract with the backend implementation.",
    placeholderBaseUrl: AUTH_API_PLACEHOLDERS.baseUrl,
    placeholderHeader: AUTH_API_PLACEHOLDERS.tokenHeader,
    requestPreview: payload,
  };
}

export async function loginWithBackendPlaceholder(
  payload: AuthApiRequest,
): Promise<AuthApiPlaceholderResponse> {
  return Promise.resolve(
    buildPlaceholderAuthResponse(AUTH_API_PLACEHOLDERS.loginEndpoint, payload),
  );
}

export async function signupWithBackendPlaceholder(
  payload: AuthApiRequest,
): Promise<AuthApiPlaceholderResponse> {
  return Promise.resolve(
    buildPlaceholderAuthResponse(AUTH_API_PLACEHOLDERS.signupEndpoint, payload),
  );
}
