import { useState, useCallback } from 'react'
import { api, type User } from '../api/client'

interface Props {
  onSuccess: (user: User) => void
}

export default function AuthPage({ onSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = tab === 'login'
        ? await api.auth.login(email, password)
        : await api.auth.register(email, password)
      onSuccess(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [tab, email, password, onSuccess])

  return (
    <div
      className="flex items-center justify-center h-screen w-screen"
      style={{ background: '#0a0a0a' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <InkLogo />
          <span className="text-lg font-semibold" style={{ color: '#c7d2fe' }}>AskInkAI</span>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 rounded-lg overflow-hidden" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: tab === t ? '#6366f1' : 'transparent',
                color: tab === t ? '#fff' : '#666',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#666' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: '#111',
                border: '1px solid #222',
                color: '#f5f5f5',
                outline: 'none',
              }}
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#666' }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: '#111',
                border: '1px solid #222',
                color: '#f5f5f5',
                outline: 'none',
              }}
              placeholder={tab === 'register' ? '8 caractères minimum' : '••••••••'}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold mt-2"
            style={{
              background: loading ? '#2a2a2a' : '#6366f1',
              color: loading ? '#555' : '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Chargement…' : tab === 'login' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </form>
      </div>
    </div>
  )
}

function InkLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 22 L14 5 L22 22 M9.5 16 L18.5 16"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
