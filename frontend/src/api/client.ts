const TOKEN_KEY = "upi-monitor-token";

export const apiBase = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return path.startsWith("/") ? `${apiBase}${path}` : path;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), { ...options, headers });
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("upi-monitor-user");
    if (!path.endsWith("/login")) {
      window.location.assign(window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login");
    }
  }
  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 403 && body.error === "This account is inactive") {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("upi-monitor-user");
    window.location.assign("/login");
  }
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body as T;
}
