import { ApiError } from "./api";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://bidii-server.onrender.com";
export const ADMIN_TOKEN_KEY = "bidii_admin_token";

/**
 * Decodes the (unsigned, client-side-only) payload of the current JWT to
 * read its subject — the logged-in admin's user ID. This is display-only
 * ("is this row me?" in the Users table); the backend independently
 * verifies the token's signature on every request, so nothing security-
 * relevant depends on this decode being trustworthy.
 */
export function getCurrentAdminId(): string | null {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Same decode as getCurrentAdminId, but for the `role` claim — used to
 * decide whether to show admin/loan-officer-only UI (e.g. the internal
 * fee breakdown on the public Loan Calculator). Display-only: every
 * endpoint that actually returns privileged data re-checks the role
 * server-side against the DB, never trusting this decode on its own.
 */
export function getCurrentAdminRole(): string | null {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/** Dispatched whenever a request comes back 401, so the auth context can react from anywhere. */
const SESSION_EXPIRED_EVENT = "bidii-admin-session-expired";

function extractErrorMessage(data: { message?: string; detail?: string } | null): string {
  return data?.message ?? data?.detail ?? "Something went wrong. Please try again.";
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    clearAdminToken();
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status, data?.errors);
  }

  return data as T;
}

export function onAdminSessionExpired(callback: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
}

function authHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  return handleResponse<T>(response);
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

/** For multipart uploads (e.g. a news article image) — no Content-Type header, the browser sets the boundary itself. */
export async function adminPostForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse<T>(response);
}

export async function adminDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<T>(response);
}

/** For downloading a CV — needs the auth header, so a plain <a href> won't work. */
export async function adminDownloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(data), response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Login itself doesn't need a token yet, so it's a plain unauthenticated POST. */
export async function adminLogin(username: string, password: string): Promise<{ access_token: string; role: string }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
}


// import { ApiError } from "./api";

// const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://bidii-server.onrender.com";
// export const ADMIN_TOKEN_KEY = "bidii_admin_token";

// /**
//  * Decodes the (unsigned, client-side-only) payload of the current JWT to
//  * read its subject — the logged-in admin's user ID. This is display-only
//  * ("is this row me?" in the Users table); the backend independently
//  * verifies the token's signature on every request, so nothing security-
//  * relevant depends on this decode being trustworthy.
//  */
// export function getCurrentAdminId(): string | null {
//   const token = getAdminToken();
//   if (!token) return null;
//   try {
//     const payload = token.split(".")[1];
//     const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
//     return decoded.sub ?? null;
//   } catch {
//     return null;
//   }
// }

// export function getAdminToken(): string | null {
//   return localStorage.getItem(ADMIN_TOKEN_KEY);
// }

// export function setAdminToken(token: string) {
//   localStorage.setItem(ADMIN_TOKEN_KEY, token);
// }

// export function clearAdminToken() {
//   localStorage.removeItem(ADMIN_TOKEN_KEY);
// }

// /** Dispatched whenever a request comes back 401, so the auth context can react from anywhere. */
// const SESSION_EXPIRED_EVENT = "bidii-admin-session-expired";

// function extractErrorMessage(data: { message?: string; detail?: string } | null): string {
//   return data?.message ?? data?.detail ?? "Something went wrong. Please try again.";
// }

// async function handleResponse<T>(response: Response): Promise<T> {
//   const data = await response.json().catch(() => null);

//   if (response.status === 401) {
//     clearAdminToken();
//     window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
//   }

//   if (!response.ok) {
//     throw new ApiError(extractErrorMessage(data), response.status, data?.errors);
//   }

//   return data as T;
// }

// export function onAdminSessionExpired(callback: () => void) {
//   window.addEventListener(SESSION_EXPIRED_EVENT, callback);
//   return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
// }

// function authHeaders(): HeadersInit {
//   const token = getAdminToken();
//   return token ? { Authorization: `Bearer ${token}` } : {};
// }

// export async function adminGet<T>(path: string): Promise<T> {
//   const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
//   return handleResponse<T>(response);
// }

// export async function adminPost<T>(path: string, body: unknown): Promise<T> {
//   const response = await fetch(`${API_BASE_URL}${path}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json", ...authHeaders() },
//     body: JSON.stringify(body),
//   });
//   return handleResponse<T>(response);
// }

// export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
//   const response = await fetch(`${API_BASE_URL}${path}`, {
//     method: "PATCH",
//     headers: { "Content-Type": "application/json", ...authHeaders() },
//     body: JSON.stringify(body),
//   });
//   return handleResponse<T>(response);
// }

// export async function adminDelete<T>(path: string): Promise<T> {
//   const response = await fetch(`${API_BASE_URL}${path}`, {
//     method: "DELETE",
//     headers: authHeaders(),
//   });
//   return handleResponse<T>(response);
// }

// /** For downloading a CV — needs the auth header, so a plain <a href> won't work. */
// export async function adminDownloadFile(path: string, filename: string): Promise<void> {
//   const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
//   if (!response.ok) {
//     const data = await response.json().catch(() => null);
//     throw new ApiError(extractErrorMessage(data), response.status);
//   }
//   const blob = await response.blob();
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   a.click();
//   URL.revokeObjectURL(url);
// }

// /** Login itself doesn't need a token yet, so it's a plain unauthenticated POST. */
// export async function adminLogin(username: string, password: string): Promise<{ access_token: string }> {
//   const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ username, password }),
//   });
//   return handleResponse(response);
// }
