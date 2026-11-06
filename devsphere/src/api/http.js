const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "devsphere-token";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Can't connect to the DevSphere server. Check that the backend is running.", 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && !path.startsWith("/auth/login")) {
    saveToken(null);
    window.dispatchEvent(new Event("devsphere:unauthorized"));
  }

  if (!response.ok) {
    throw new ApiError(payload.error || "The request could not be completed.", response.status);
  }

  return payload;
}

export const get = (path) => request(path);
export const post = (path, body) => request(path, { method: "POST", body });
export const put = (path, body) => request(path, { method: "PUT", body });
export const patch = (path, body) => request(path, { method: "PATCH", body });
export const remove = (path) => request(path, { method: "DELETE" });

export async function uploadFile(path, file, fields = {}) {
  const headers = new Headers();
  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = new FormData();
  body.append("file", file);

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      body.append(key, String(value));
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    throw new ApiError("Can't connect to the DevSphere server. Check that the backend is running.", 0);
  }

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    saveToken(null);
    window.dispatchEvent(new Event("devsphere:unauthorized"));
  }

  if (!response.ok) {
    throw new ApiError(payload.error || "The file could not be uploaded.", response.status);
  }

  return payload;
}
