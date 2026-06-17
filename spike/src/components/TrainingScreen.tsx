import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point } from '../types'
import {
  addSample,
  clearLetter,
  createEmptyProfile,
  isComplete,
  MIN_SAMPLES,
  removeLastSample,
  sampleCount,
  saveProfile,
  TARGET_SAMPLES,
  totalSamples,
  type UserProfile,
} from '../recognition/userProfile'
import DrawingCanvas, { type DrawingCanvasHandle } from './DrawingCanvas'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DIGITS = '0123456789'.split('')
const ARROW_CHARS = ['↑', '→', '↓']
const ARROW_ACTIONS: Record<string, string> = {
  '↑': 'Effacer le texte',
  '→': 'Lire le texte',
  '↓': 'Envoyer à Claude',
}
const ALL_CHARS = [...LETTERS, ...DIGITS, ...ARROW_CHARS]
// Délai après le DERNIER trait — assez long pour les lettres multi-traits (A, E, H, I, T…)
const CAPTURE_DELAY = 1000

interface Props {
  initialProfile: UserProfile | null
  onComplete: (profile: UserProfile) => void
  onBack: () => void  // return to recognition with whatever profile exists
}

export default function TrainingScreen({ initialProfile, onComplete, onBack }: Props) {
  // Start from first incomplete character
  const [letterIdx, setLetterIdx] = useState(() => {
    if (!initialProfile) return 0
    for (let i = 0; i < ALL_CHARS.length; i++) {
      if (sampleCount(initialProfile, ALL_CHARS[i]) < TARGET_SAMPLES) return i
    }
    return ALL_CHARS.length - 1
  })

  const [profile, setProfile] = useState<UserProfile>(initialProfile ?? createEmptyProfile())
  const [captureFlash, setCaptureFlash] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const pendingKeyRef = useRef(0)
  const [pendingKey, setPendingKey] = useState(0)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Point[][]>([])

  const letter = ALL_CHARS[letterIdx]
  const count = sampleCount(profile, letter)
  const canAdvance = count >= MIN_SAMPLES
  const isLetterDone = count >= TARGET_SAMPLES
  const trainedCount = LETTERS.filter(l => sampleCount(profile, l) >= MIN_SAMPLES).length
  const trainedDigitCount = DIGITS.filter(d => sampleCount(profile, d) >= MIN_SAMPLES).length

  // Sur changement de lettre : annule timer + vide canvas
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsPending(false)
    pendingRef.current = []
    canvasRef.current?.clear()
  }, [letterIdx])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const doCapture = useCallback((strokes: Point[][]) => {
    if (strokes.length === 0 || strokes.every(s => s.length === 0)) return

    setProfile(prev => {
      const next = addSample(prev, letter, strokes)
      saveProfile(next)
      return next
    })

    setCaptureFlash(true)
    setTimeout(() => setCaptureFlash(false), 400)
    canvasRef.current?.clear()
    pendingRef.current = []
  }, [letter])

  const handleStrokeEnd = useCallback((strokes: Point[][]) => {
    pendingRef.current = strokes
    // Réinitialise le timer à chaque nouveau trait
    if (timerRef.current) clearTimeout(timerRef.current)
    // Relance la barre de progression
    pendingKeyRef.current += 1
    setPendingKey(pendingKeyRef.current)
    setIsPending(true)
    timerRef.current = setTimeout(() => {
      setIsPending(false)
      doCapture(pendingRef.current)
    }, CAPTURE_DELAY)
  }, [doCapture])

  const handleDrawStart = useCallback(() => {
    // Nouveau trait en cours : annule la capture imminente
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsPending(false)
  }, [])

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPending(false)
    canvasRef.current?.clear()
    pendingRef.current = []
  }, [])

  // Navigate to a character AND reset all its existing samples so the user retrains from scratch.
  const handleSelectChar = useCallback((char: string, idx: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    pendingRef.current = []
    setIsPending(false)
    canvasRef.current?.clear()
    setProfile(prev => {
      const next = clearLetter(prev, char)
      saveProfile(next)
      return next
    })
    setLetterIdx(idx)
  }, [])

  const handleUndoLast = useCallback(() => {
    setProfile(prev => {
      const next = removeLastSample(prev, letter)
      saveProfile(next)
      return next
    })
  }, [letter])

  const handleClearLetter = useCallback(() => {
    setProfile(prev => {
      const next = clearLetter(prev, letter)
      saveProfile(next)
      return next
    })
  }, [letter])

  const goNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    pendingRef.current = []

    if (letterIdx < ALL_CHARS.length - 1) {
      setLetterIdx(i => i + 1)
      setIsPending(false)
    } else {
      setProfile(current => {
        onComplete(current)
        return current
      })
    }
  }, [letterIdx, onComplete])

  const goPrev = useCallback(() => {
    if (letterIdx > 0) {
      if (timerRef.current) clearTimeout(timerRef.current)
      pendingRef.current = []
      setLetterIdx(i => i - 1)
      setIsPending(false)
    }
  }, [letterIdx])

  const handleFinish = useCallback(() => {
    setProfile(current => {
      onComplete(current)
      return current
    })
  }, [onComplete])

  // Auto-advance when letter hits TARGET_SAMPLES
  const prevCountRef = useRef(count)
  useEffect(() => {
    if (count !== prevCountRef.current && count >= TARGET_SAMPLES && letterIdx < ALL_CHARS.length - 1) {
      const t = setTimeout(goNext, 1800)
      prevCountRef.current = count
      return () => clearTimeout(t)
    }
    prevCountRef.current = count
  }, [count, letterIdx, goNext])

  const progressPct = (trainedCount / 26) * 100
  const isDigitChar = letterIdx >= 26 && letterIdx < 36
  const isArrowChar = letterIdx >= 36
  const trainedArrowCount = ARROW_CHARS.filter(a => sampleCount(profile, a) >= MIN_SAMPLES).length

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: '#0a0a0a', color: '#f5f5f5' }}
    >
      {/* Header */}
      <header
        className="flex-none flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#888', background: '#1a1a1a', border: '1px solid #222' }}
        >
          ← Retour
        </button>
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: '#c7d2fe' }}>
            Apprentissage de l'écriture
          </div>
          <div className="text-xs" style={{ color: '#444' }}>
            {trainedCount}/26 lettres · {trainedDigitCount}/10 chiffres · {trainedArrowCount}/3 gestes
          </div>
        </div>

        {totalSamples(profile) > 0 && (
          <button
            onClick={handleFinish}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: '#6366f1', color: '#fff', border: 'none' }}
          >
            Terminer →
          </button>
        )}
      </header>

      {/* Overall progress bar */}
      <div style={{ height: 3, background: '#1a1a1a' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: '#6366f1' }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: drawing zone */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Letter instruction */}
          <div
            className="flex-none flex flex-col items-center justify-center py-4 px-4"
            style={{ borderBottom: '1px solid #1a1a1a' }}
          >
            <div className="text-xs mb-1" style={{ color: '#555' }}>
              {isArrowChar
                ? `Geste : ${ARROW_ACTIONS[letter]}`
                : 'Dessine la lettre'}
            </div>

            {/* Big letter display */}
            <div
              className="flex items-center justify-center rounded-2xl mb-2 transition-all"
              style={{
                width: 96,
                height: 96,
                background: captureFlash
                  ? 'rgba(16,185,129,0.2)'
                  : 'rgba(99,102,241,0.1)',
                border: `2px solid ${captureFlash ? 'rgba(16,185,129,0.6)' : 'rgba(99,102,241,0.4)'}`,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <span
                style={{
                  fontSize: 64,
                  fontFamily: 'Georgia, serif',
                  color: captureFlash ? '#6ee7b7' : '#c7d2fe',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
              >
                {letter}
              </span>
            </div>

            {/* Sample dots */}
            <SampleDots count={count} target={TARGET_SAMPLES} />

            <div
              className="text-xs mt-1"
              style={{ color: isLetterDone ? '#6ee7b7' : isPending ? '#6366f1' : '#555' }}
            >
              {isLetterDone
                ? `✓ ${isArrowChar ? 'Geste' : isDigitChar ? 'Chiffre' : 'Lettre'} appris — passage automatique…`
                : isPending
                ? 'Attente fin du tracé…'
                : count === 0
                ? `Dessine ${TARGET_SAMPLES} exemples`
                : `${count} / ${TARGET_SAMPLES} exemples`}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <DrawingCanvas
              ref={canvasRef}
              onStrokeEnd={handleStrokeEnd}
              onDrawStart={handleDrawStart}
              isProcessing={false}
            />
          </div>

          {/* Barre de progression : se remplit pendant le délai avant capture */}
          <div style={{ height: 2, background: '#111', flexShrink: 0 }}>
            {isPending && (
              <div
                key={pendingKey}
                style={{
                  height: '100%',
                  background: '#6366f1',
                  animation: `recognition-progress ${CAPTURE_DELAY}ms linear forwards`,
                }}
              />
            )}
          </div>

          {/* Canvas controls */}
          <div
            className="flex-none flex items-center gap-2 px-3 py-2"
            style={{ borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}
          >
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: '#1a1a1a', color: '#666', border: '1px solid #222' }}
            >
              ✕ Effacer
            </button>

            {count > 0 && (
              <button
                onClick={handleUndoLast}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                style={{ background: '#1a1a1a', color: '#666', border: '1px solid #222' }}
              >
                ↩ Défaire
              </button>
            )}

            <div className="flex-1" />

            {count > 0 && !canAdvance && (
              <button
                onClick={handleClearLetter}
                className="text-xs px-2 py-1 rounded"
                style={{ color: '#555', background: 'none' }}
              >
                Recommencer
              </button>
            )}

            <button
              onClick={goNext}
              disabled={!canAdvance && count === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isLetterDone
                  ? '#10b981'
                  : canAdvance
                  ? '#6366f1'
                  : '#2a2a2a',
                color: canAdvance || isLetterDone ? '#fff' : '#444',
                border: 'none',
                cursor: canAdvance ? 'pointer' : 'default',
                opacity: !canAdvance && count === 0 ? 0.4 : 1,
              }}
            >
              {letterIdx < ALL_CHARS.length - 1 ? (
                canAdvance
                  ? isLetterDone
                    ? `✓ ${ALL_CHARS[letterIdx + 1]} →`
                    : `Suivante (${ALL_CHARS[letterIdx + 1]}) →`
                  : 'Passer →'
              ) : (
                isComplete(profile) ? 'Terminer ✓' : 'Terminer →'
              )}
            </button>
          </div>
        </div>

        {/* Right: alphabet progress panel */}
        <div
          className="flex-none overflow-y-auto px-3 py-3"
          style={{
            width: 200,
            borderLeft: '1px solid #1a1a1a',
            background: '#0a0a0a',
          }}
        >
          <div className="text-xs mb-2" style={{ color: '#444', fontFamily: 'monospace' }}>
            LETTRES
          </div>
          <div className="grid grid-cols-2 gap-1">
            {LETTERS.map((l, i) => {
              const n = sampleCount(profile, l)
              const done = n >= TARGET_SAMPLES
              const current = i === letterIdx

              return (
                <button
                  key={l}
                  onClick={() => handleSelectChar(l, i)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: current ? 'rgba(99,102,241,0.2)' : done ? 'rgba(16,185,129,0.08)' : '#111',
                    border: `1px solid ${current ? 'rgba(99,102,241,0.5)' : done ? 'rgba(16,185,129,0.3)' : '#1a1a1a'}`,
                    color: done ? '#6ee7b7' : current ? '#c7d2fe' : '#666',
                  }}
                >
                  <span className="font-mono font-semibold">{l}</span>
                  <span className="text-xs" style={{ color: done ? '#6ee7b7' : '#444' }}>
                    {done ? '✓' : n > 0 ? `${n}` : '—'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-xs mt-3 mb-2" style={{ color: '#444', fontFamily: 'monospace' }}>
            CHIFFRES
          </div>
          <div className="grid grid-cols-2 gap-1">
            {DIGITS.map((d, i) => {
              const globalIdx = 26 + i
              const n = sampleCount(profile, d)
              const done = n >= TARGET_SAMPLES
              const current = globalIdx === letterIdx

              return (
                <button
                  key={d}
                  onClick={() => handleSelectChar(d, globalIdx)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: current ? 'rgba(99,102,241,0.2)' : done ? 'rgba(16,185,129,0.08)' : '#111',
                    border: `1px solid ${current ? 'rgba(99,102,241,0.5)' : done ? 'rgba(16,185,129,0.3)' : '#1a1a1a'}`,
                    color: done ? '#6ee7b7' : current ? '#c7d2fe' : '#666',
                  }}
                >
                  <span className="font-mono font-semibold">{d}</span>
                  <span className="text-xs" style={{ color: done ? '#6ee7b7' : '#444' }}>
                    {done ? '✓' : n > 0 ? `${n}` : '—'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-xs mt-3 mb-2" style={{ color: '#444', fontFamily: 'monospace' }}>
            GESTES
          </div>
          <div className="flex flex-col gap-1">
            {ARROW_CHARS.map((char, i) => {
              const globalIdx = 36 + i
              const n = sampleCount(profile, char)
              const done = n >= TARGET_SAMPLES
              const current = globalIdx === letterIdx
              return (
                <button
                  key={char}
                  onClick={() => handleSelectChar(char, globalIdx)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    background: current ? 'rgba(99,102,241,0.2)' : done ? 'rgba(16,185,129,0.08)' : '#111',
                    border: `1px solid ${current ? 'rgba(99,102,241,0.5)' : done ? 'rgba(16,185,129,0.3)' : '#1a1a1a'}`,
                    color: done ? '#6ee7b7' : current ? '#c7d2fe' : '#666',
                  }}
                >
                  <span className="font-mono font-semibold text-base">{char}</span>
                  <span className="flex-1 text-xs text-left" style={{ color: done ? '#6ee7b7' : current ? '#a5b4fc' : '#444' }}>
                    {ARROW_ACTIONS[char]}
                  </span>
                  <span className="text-xs" style={{ color: done ? '#6ee7b7' : '#333' }}>
                    {done ? '✓' : n > 0 ? `${n}` : '—'}
                  </span>
                </button>
              )
            })}
          </div>

          {totalSamples(profile) > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
              <div className="text-xs mb-1" style={{ color: '#444' }}>
                {totalSamples(profile)} exemples
              </div>
              <div className="text-xs" style={{ color: '#555' }}>
                {trainedCount}/26 lettres · {trainedDigitCount}/10 chiffres · {trainedArrowCount}/3 gestes
              </div>
            </div>
          )}

          {/* Navigation prev/next */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={goPrev}
              disabled={letterIdx === 0}
              className="flex-1 py-1.5 rounded text-sm"
              style={{
                background: '#1a1a1a',
                color: letterIdx > 0 ? '#888' : '#2a2a2a',
                border: '1px solid #222',
              }}
            >
              ←
            </button>
            <button
              onClick={() => goNext()}
              disabled={!canAdvance && count === 0}
              className="flex-1 py-1.5 rounded text-sm"
              style={{
                background: '#1a1a1a',
                color: canAdvance ? '#888' : '#2a2a2a',
                border: '1px solid #222',
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SampleDots({ count, target }: { count: number; target: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: target }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-200"
          style={{
            width: i < count ? 10 : 8,
            height: i < count ? 10 : 8,
            background: i < count
              ? count >= target
                ? '#10b981'
                : '#6366f1'
              : '#1e1e1e',
            border: `1px solid ${i < count ? (count >= target ? '#10b981' : '#6366f1') : '#333'}`,
          }}
        />
      ))}
    </div>
  )
}
