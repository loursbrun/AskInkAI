const BASE = (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? 'https://askink-server.onrender.com' : '')

const TOKEN_KEY = 'askink_token'

export function saveToken(token: string) { localStorage.setItem(TOKEN_KEY, token) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }
function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }

export interface User {
  id: string
  email: string
}

interface AuthResponse extends User {
  token: string
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    me: () => request<User>('/api/auth/me'),
    register: async (email: string, password: string): Promise<User> => {
      const data = await request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveToken(data.token)
      return { id: data.id, email: data.email }
    },
    login: async (email: string, password: string): Promise<User> => {
      const data = await request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveToken(data.token)
      return { id: data.id, email: data.email }
    },
    logout: () => { clearToken(); return Promise.resolve() },
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
