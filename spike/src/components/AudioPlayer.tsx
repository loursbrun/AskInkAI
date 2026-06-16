import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  text: string | null
  autoPlay?: boolean
  onDismiss: () => void
}

export default function AudioPlayer({ text, autoPlay = false, onDismiss }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stopAll = useCallback(() => {
    window.speechSynthesis.cancel()
    uttRef.current = null
    setIsPlaying(false)
    setIsPaused(false)
  }, [])

  const playText = useCallback((t: string) => {
    if (!('speechSynthesis' in window)) return
    stopAll()
    const utt = new SpeechSynthesisUtterance(t)
    utt.lang = 'fr-FR'
    utt.onstart = () => { setIsPlaying(true); setIsPaused(false) }
    utt.onend = () => { setIsPlaying(false); setIsPaused(false) }
    utt.onpause = () => { setIsPaused(true) }
    utt.onresume = () => { setIsPaused(false) }
    utt.onerror = () => { setIsPlaying(false); setIsPaused(false) }
    uttRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [stopAll])

  // Auto-play when text changes
  useEffect(() => {
    if (text && autoPlay) playText(text)
    return () => { if (!text) stopAll() }
  }, [text, autoPlay, playText, stopAll]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopAll(), [stopAll])

  if (!text) return null

  const handlePlayPause = () => {
    if (!isPlaying && !isPaused) {
      playText(text)
    } else if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
    } else {
      window.speechSynthesis.pause()
      setIsPaused(true)
    }
  }

  const handleRestart = () => playText(text)

  return (
    <div
      className="flex-none flex items-center gap-3 px-4 py-2.5"
      style={{
        borderTop: '1px solid #1e1e1e',
        background: 'rgba(99,102,241,0.05)',
      }}
    >
      <span className="text-xs font-mono flex-none" style={{ color: '#555' }}>LECTURE</span>

      {/* Restart */}
      <button
        onClick={handleRestart}
        className="flex-none flex items-center justify-center rounded-lg text-sm"
        style={{
          width: 34, height: 34,
          background: '#1a1a1a',
          border: '1px solid #222',
          color: '#888',
          cursor: 'pointer',
        }}
        title="Reprendre depuis le début"
      >
        ↩
      </button>

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        className="flex-none flex items-center justify-center rounded-lg text-base font-bold"
        style={{
          width: 40, height: 40,
          background: isPlaying && !isPaused ? '#6366f1' : '#1a1a1a',
          border: `1px solid ${isPlaying && !isPaused ? '#6366f1' : '#222'}`,
          color: isPlaying && !isPaused ? '#fff' : '#888',
          cursor: 'pointer',
        }}
        title={isPaused ? 'Reprendre' : isPlaying ? 'Pause' : 'Lire'}
      >
        {isPlaying && !isPaused ? '⏸' : '▶'}
      </button>

      {/* Waveform / status */}
      <div className="flex-1 flex items-center gap-1 min-w-0">
        {isPlaying && !isPaused ? (
          <AudioWave />
        ) : (
          <span className="text-xs truncate" style={{ color: '#444' }}>
            {isPaused ? 'En pause' : 'Réponse Claude prête'}
          </span>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => { stopAll(); onDismiss() }}
        className="flex-none text-sm"
        style={{ color: '#333', background: 'none', border: 'none', cursor: 'pointer' }}
        title="Fermer"
      >
        ✕
      </button>
    </div>
  )
}

function AudioWave() {
  return (
    <div className="flex items-end gap-0.5" style={{ height: 16 }}>
      {[3, 5, 8, 5, 10, 7, 3, 9, 4, 6].map((h, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: 2,
            height: h,
            background: '#6366f1',
            animation: `audioBar 0.8s ease-in-out ${i * 0.08}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes audioBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
