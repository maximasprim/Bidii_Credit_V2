export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://bidii-server.onrender.com";

/** Builds the public URL for a news article image (path is what's stored in an article's image_urls, e.g. "news/<uuid>_cover.jpg"). */
export function newsImageUrl(path: string): string {
  return `${API_BASE_URL}/api/news/images/${path}`;
}

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function extractErrorMessage(data: { message?: string; detail?: string } | null): string {
  // The backend returns { message, errors } from its custom validation
  // handler, but a plain FastAPI HTTPException (e.g. file upload checks
  // in the careers endpoint) comes back as { detail } instead.
  return data?.message ?? data?.detail ?? "Something went wrong. Please try again.";
}

/**
 * GETs from the backend and returns the parsed response body. Used for
 * public read endpoints (news, jobs, loan tiers) that don't need auth.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status, data?.errors);
  }

  return data as T;
}

/**
 * POSTs JSON to the backend and returns the parsed response body.
 * Throws ApiError with a real message extracted from either of the
 * backend's error shapes on any non-2xx response, so callers can show a
 * real error instead of silently pretending the submission worked.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status, data?.errors);
  }

  return data as T;
}

/**
 * POSTs FormData (e.g. a file upload) to the backend. Deliberately does NOT
 * set a Content-Type header — the browser sets the correct multipart
 * boundary automatically, which breaks if overridden manually.
 */
export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status, data?.errors);
  }

  return data as T;
}
