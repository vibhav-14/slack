// Single entry point for HTTP. With VITE_API_URL set, requests go to the
// FastAPI service; otherwise they are answered by the in-browser mock.

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
export const usingMock = !BASE;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MOCK_LATENCY_MS = 220;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (usingMock) {
    const { dispatch } = await import("./mock/handlers");
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    const res = dispatch(method, path, body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
    if (res.status >= 400) throw new ApiError(res.status, (res.data as { detail: string }).detail);
    // Clone so callers can never mutate the mock database by reference.
    return JSON.parse(JSON.stringify(res.data)) as T;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
