import { useState, useCallback } from 'react'
import { api } from '../api/client'

interface Props {
  currentHint: string | null
  onSaved: (hint: string) => void
  onDeleted: () => void
  onSkip?: () => void
}

export default function ApiKeyForm({ currentHint, onSaved, onDeleted, onSkip }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setError(null)
    setSaving(true)
    try {
      const { hint } = await api.apiKey.save(key.trim())
      setKey('')
      onSaved(hint)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }, [key, onSaved])

  const handleDelete = useCallback(async () => {
    if (!confirm('Supprimer la clé API ?')) return
    setDeleting(true)
    try {
      await api.apiKey.delete()
      onDeleted()
    } catch {
      // silently ignore
    } finally {
      setDeleting(false)
    }
  }, [onDeleted])

  return (
    <div
      className="flex items-center justify-center h-screen w-screen"
      style={{ background: '#0a0a0a' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1" style={{ color: '#c7d2fe' }}>
            Clé API Claude
          </h2>
          <p className="text-sm" style={{ color: '#555' }}>
            Votre clé est chiffrée côté serveur et n'est jamais exposée au navigateur.
          </p>
        </div>

        {currentHint && (
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-4"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <span className="text-sm font-mono" style={{ color: '#6ee7b7' }}>{currentHint}</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs ml-3"
              style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {deleting ? '…' : 'Supprimer'}
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#666' }}>
              {currentHint ? 'Remplacer la clé API' : 'Entrer votre clé API Anthropic'}
            </label>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              required
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono"
              style={{
                background: '#111',
                border: '1px solid #222',
                color: '#f5f5f5',
                outline: 'none',
              }}
              placeholder="sk-ant-api0..."
            />
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !key.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: saving || !key.trim() ? '#2a2a2a' : '#6366f1',
                color: saving || !key.trim() ? '#555' : '#fff',
                border: 'none',
                cursor: saving || !key.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="px-4 py-2.5 rounded-lg text-sm"
                style={{ background: '#1a1a1a', color: '#666', border: '1px solid #222', cursor: 'pointer' }}
              >
                Passer
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
