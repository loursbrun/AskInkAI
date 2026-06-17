// Centralised API client. All requests include credentials (JWT httpOnly cookie).
// VITE_API_URL can be set in production to point to a remote backend.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? 'https://askink-server.onrender.com' : '')

export interface User {
  id: string
  email: string
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    me: () => request<User>('/api/auth/me'),
    register: (email: string, password: string) =>
      request<User>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  },

  apiKey: {
    get: () => request<{ hint: string } | null>('/api/key'),
    save: (key: string) =>
      request<{ hint: string }>('/api/key', {
        method: 'POST',
        body: JSON.stringify({ key }),
      }),
    delete: () => request<void>('/api/key', { method: 'DELETE' }),
  },

  claude: {
    ask: (question: string) =>
      request<{ response: string }>('/api/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
  },
}
