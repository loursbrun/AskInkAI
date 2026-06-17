import { useEffect, useState } from 'react'

type SpeechState = 'speaking' | 'paused' | 'ended'

interface Props {
  response: string
  onClose: () => void
}

export default function ResponseModal({ response, onClose }: Props) {
  const [speechState, setSpeechState] = useState<SpeechState>('speaking')

  const startSpeech = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(response)
    utt.lang = 'fr-FR'
    utt.onstart = () => setSpeechState('speaking')
    utt.onpause = () => setSpeechState('paused')
    utt.onresume = () => setSpeechState('speaking')
    utt.onend = () => setSpeechState('ended')
    utt.onerror = () => setSpeechState('ended')
    setSpeechState('speaking')
    window.speechSynthesis.speak(utt)
  }

  // Auto-start on open
  useEffect(() => {
    startSpeech()
    return () => { window.speechSynthesis.cancel() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleTextClick = () => {
    if (!('speechSynthesis' in window)) return
    if (speechState === 'speaking') {
      window.speechSynthesis.pause()
      setSpeechState('paused')
    } else if (speechState === 'paused') {
      window.speechSynthesis.resume()
      setSpeechState('speaking')
    } else {
      startSpeech()
    }
  }

  const icon = speechState === 'speaking' ? '⏸' : speechState === 'paused' ? '▶' : '↺'
  const hint = speechState === 'speaking' ? 'Cliquer pour mettre en pause'
    : speechState === 'paused' ? 'Cliquer pour reprendre'
    : 'Cliquer pour relire'

  const iconBg = speechState === 'speaking'
    ? 'rgba(99,102,241,0.85)'
    : speechState === 'paused'
    ? 'rgba(251,191,36,0.2)'
    : 'rgba(16,185,129,0.2)'

  const iconColor = speechState === 'speaking' ? '#fff'
    : speechState === 'paused' ? '#fbbf24'
    : '#6ee7b7'

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: '#0d0d0d', border: '1px solid #222', maxHeight: '80vh' }}
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

        {/* Body — click to pause / resume / restart */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 relative"
          onClick={handleTextClick}
          title={hint}
          style={{ cursor: 'pointer' }}
        >
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap select-none"
            style={{
              color: '#d4d4d4',
              opacity: speechState === 'paused' ? 0.55 : 1,
              transition: 'opacity 0.25s',
            }}
          >
            {response}
          </p>

          {/* State badge */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: iconBg,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: iconColor,
              transition: 'all 0.2s',
            }}
          >
            {icon}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-5 py-3 flex-none"
          style={{ borderTop: '1px solid #1a1a1a' }}
        >
          <button
            onClick={() => navigator.clipboard.writeText(response).catch(() => {})}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#1a1a1a', color: '#888', border: '1px solid #222', cursor: 'pointer' }}
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
