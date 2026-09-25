
const AUTH_ENDPOINTS = ["auth/refresh", "auth/verify", "auth/login"];
const API_BASE_URL = import.meta.env.PUBLIC_API_SERVER_URL || "";

function getUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let refreshPromise: Promise<boolean> | null = null;
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(getUrl('/api/auth/refresh'), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res) => {
        if (!res.ok) return false;

        const data = await res.json();

        setAccessToken(data.access);

        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function request(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<any> {

  const res = await fetch(getUrl(endpoint), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => endpoint.includes(p));

  if (res.status === 401 && !isRetry && !isAuthEndpoint) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request(endpoint, options, true);
    }
    redirectToLogin();
    throw new ApiError("Session expired", 401);
  }

  if (!res.ok) {
    let errorData: any = null;
    try {
      errorData = await res.json();
    } catch {
      // response might not be JSON
    }

    const message =
      res.status >= 500
        ? `Server error (${res.status}). Please try again later.`
        : (errorData?.message ||
           errorData?.error ||
           res.statusText ||
           'Request failed');

    throw new ApiError(message, res.status, errorData);
  }

  const result = await res.json();
  if (result && result.status === 'error') {
    const message = result.message || result.error || 'Request failed';
    throw new ApiError(message, 400, result);
  }
  return result;
}

export const api = {
  get: (endpoint: string) => request(endpoint),
  post: (endpoint: string, body: any) =>
    request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  patch: (endpoint: string, body: any) =>
    request(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (endpoint: string) => request(endpoint, { method: "DELETE" }),
  download: async (endpoint: string, fallbackFilename = "IAC_Report.xlsx") => {
    const res = await fetch(getUrl(endpoint), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      }
    });
    if (!res.ok) throw new Error("Failed to download file");

    // Extract filename from header if available
    const disposition = res.headers.get("content-disposition");
    let filename = fallbackFilename;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};