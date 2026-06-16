import { useEffect, useRef } from 'react'

interface Props {
  response: string
  onClose: () => void
  onSpeak: (text: string) => void
}

export default function ResponseModal({ response, onClose, onSpeak }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdrop}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: '#0d0d0d',
          border: '1px solid #222',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-none"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: '#c7d2fe' }}>Réponse Claude</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              claude-haiku
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none px-2 py-1 rounded"
            style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: '#d4d4d4' }}
          >
            {response}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-5 py-3 flex-none"
          style={{ borderTop: '1px solid #1a1a1a' }}
        >
          <button
            onClick={() => onSpeak(response)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: 'rgba(251,191,36,0.1)',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.25)',
              cursor: 'pointer',
            }}
          >
            🔊 Lire
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(response).catch(() => {})}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: '#1a1a1a',
              color: '#888',
              border: '1px solid #222',
              cursor: 'pointer',
            }}
          >
            ⎘ Copier
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
