/**
 * API client — wraps fetch with JWT bearer auth, auto-refresh on 401,
 * and typed error responses matching the backend error format.
 */

export const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Token store (in-memory; persisted in localStorage for refresh) ───────────

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) localStorage.setItem("lf_access_token", token);
  else localStorage.removeItem("lf_access_token");
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  _accessToken = localStorage.getItem("lf_access_token");
  return _accessToken;
}

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const data = (await res.json()) as { data: { accessToken: string } };
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...init } = options;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const token = getAccessToken();
  if (token && !skipAuth) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    if (isRefreshing) {
      // Queue until refresh resolves
      const newToken = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      });
      if (newToken) headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
    } else {
      isRefreshing = true;
      const newToken = await tryRefresh();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];

      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
      }
    }
  }

  if (!res.ok) {
    let errorBody: { error?: { code?: string; message?: string; details?: unknown[] } } = {};
    try {
      errorBody = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      errorBody.error?.code ?? "UNKNOWN",
      errorBody.error?.message ?? res.statusText,
      errorBody.error?.details ?? [],
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const api = {
  // Auth
  auth: {
    requestOtp: (email: string) =>
      apiFetch<{ data: { message: string } }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuth: true,
      }),
    verifyOtp: (email: string, code: string, name?: string) =>
      apiFetch<{ data: { accessToken: string } }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code, ...(name && { name }) }),
        skipAuth: true,
      }),
    me: () => apiFetch<{ data: import("./types").User }>("/auth/me"),
    logout: () => apiFetch<{ data: { message: string } }>("/auth/logout", { method: "POST" }),
    refresh: () =>
      apiFetch<{ data: { accessToken: string } }>("/auth/refresh", {
        method: "POST",
        skipAuth: true,
      }),
  },

  // Items
  items: {
    list: (params?: Record<string, string | number | undefined>) => {
      const qs = params
        ? "?" +
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
            .join("&")
        : "";
      return apiFetch<{ data: import("./types").Item[]; meta: import("./types").PaginationMeta }>(
        `/items${qs}`,
        { skipAuth: true },
      );
    },
    get: (id: string) =>
      apiFetch<{ data: import("./types").Item }>(`/items/${id}`, { skipAuth: true }),
    create: (body: import("./types").CreateItemInput) =>
      apiFetch<{ data: import("./types").Item }>("/items", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<import("./types").CreateItemInput>) =>
      apiFetch<{ data: import("./types").Item }>(`/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) => apiFetch<void>(`/items/${id}`, { method: "DELETE" }),
    markReturned: (id: string) =>
      apiFetch<{ data: import("./types").Item }>(`/items/${id}/mark-returned`, { method: "POST" }),
    myClaims: (params?: { page?: number; limit?: number }) => {
      const qs = params ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}` : "";
      return apiFetch<{ data: import("./types").Claim[]; meta: import("./types").PaginationMeta }>(
        `/users/me/claims${qs}`,
      );
    },
    myItems: (params?: { page?: number; limit?: number }) => {
      const qs = params ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}` : "";
      return apiFetch<{ data: import("./types").Item[]; meta: import("./types").PaginationMeta }>(
        `/users/me/items${qs}`,
      );
    },
  },

  // Claims
  claims: {
    forItem: (itemId: string) =>
      apiFetch<{ data: import("./types").Claim[] }>(`/items/${itemId}/claims`),
    create: (itemId: string, answer: string, note?: string) =>
      apiFetch<{ data: import("./types").Claim }>(`/items/${itemId}/claims`, {
        method: "POST",
        body: JSON.stringify({ answer, ...(note && { note }) }),
      }),
    decide: (claimId: string, status: "APPROVED" | "REJECTED") =>
      apiFetch<{ data: import("./types").Claim }>(`/claims/${claimId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    cancel: (claimId: string) =>
      apiFetch<{ data: import("./types").Claim }>(`/claims/${claimId}`, { method: "DELETE" }),
  },

  // Messages
  messages: {
    list: (claimId: string, page = 1, limit = 50) =>
      apiFetch<{ data: import("./types").Message[]; meta: import("./types").PaginationMeta }>(
        `/claims/${claimId}/messages?page=${page}&limit=${limit}`,
      ),
    send: (claimId: string, body: string) =>
      apiFetch<{ data: import("./types").Message }>(`/claims/${claimId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    markRead: (claimId: string) =>
      apiFetch<void>(`/claims/${claimId}/messages/read`, { method: "POST" }),
  },

  // Notifications
  notifications: {
    list: (page = 1, limit = 20) =>
      apiFetch<{
        data: import("./types").Notification[];
        meta: import("./types").PaginationMeta;
      }>(`/notifications?page=${page}&limit=${limit}`),
    unreadCount: () => apiFetch<{ data: { count: number } }>("/notifications/unread-count"),
    markRead: (id: string) =>
      apiFetch<{ data: import("./types").Notification }>(`/notifications/${id}/read`, {
        method: "PATCH",
      }),
    markAllRead: () => apiFetch<void>("/notifications/read-all", { method: "POST" }),
  },

  // Reference data
  categories: {
    list: () =>
      apiFetch<{ data: import("./types").Category[] }>("/categories", { skipAuth: true }),
  },
  handoverPoints: {
    list: () =>
      apiFetch<{ data: import("./types").HandoverPoint[] }>("/handover-points", {
        skipAuth: true,
      }),
  },

  // Uploads
  uploads: {
    sign: () =>
      apiFetch<{
        data: {
          signature: string;
          timestamp: number;
          apiKey: string;
          cloudName: string;
          folder: string;
        };
      }>("/uploads/sign", { method: "POST" }),
  },

  // Matches
  matches: {
    forItem: (itemId: string) =>
      apiFetch<{ data: import("./types").Match[] }>(`/items/${itemId}/matches`),
    dismiss: (matchId: string) =>
      apiFetch<void>(`/matches/${matchId}/dismiss`, { method: "POST" }),
  },

  // Generic escape hatch (e.g. for report submission)
  apiFetch,
};
