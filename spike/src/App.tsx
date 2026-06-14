import { useCallback, useEffect, useRef, useState } from 'react'
import type { HistoryEntry, RecognitionResult, EngineStatus, Point } from './types'
import { RecognitionEngine } from './recognition'
import {
  loadProfile,
  saveProfile,
  deleteProfile,
  totalSamples,
  trainedLetters,
  type UserProfile,
} from './recognition/userProfile'
import DrawingCanvas, { DrawingCanvasHandle } from './components/DrawingCanvas'
import ResultPanel from './components/ResultPanel'
import TrainingScreen from './components/TrainingScreen'

const AUTO_RECOGNIZE_DELAY = 1000
const MAX_HISTORY = 10

const engine = new RecognitionEngine()

type AppMode = 'loading' | 'training' | 'recognition'

// ── Speech synthesis ─────────────────────────────────────────────────────────
const DIGIT_WORDS: Record<string, string> = {
  '0': 'zéro', '1': 'un', '2': 'deux', '3': 'trois', '4': 'quatre',
  '5': 'cinq', '6': 'six', '7': 'sept', '8': 'huit', '9': 'neuf',
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'fr-FR'
  window.speechSynthesis.speak(utt)
}

// Convert a single recognized character to its natural spoken form.
// Passing uppercase letters to the TTS causes it to say "A majuscule" —
// lowercase avoids that. Digits are mapped to French words.
function speakChar(char: string) {
  if (char === ' ') { speak('espace'); return }
  if (DIGIT_WORDS[char]) { speak(DIGIT_WORDS[char]); return }
  speak(char.toLowerCase())
}

/** Returns 'space' for a left→right horizontal stroke, 'backspace' for right→left, null otherwise. */
function detectGesture(strokes: Point[][], canvasWidth: number): 'space' | 'backspace' | null {
  if (strokes.length !== 1) return null
  const stroke = strokes[0]
  if (stroke.length < 4) return null

  const first = stroke[0]
  const last = stroke[stroke.length - 1]
  const deltaX = last.x - first.x
  const deltaY = last.y - first.y
  const absDeltaX = Math.abs(deltaX)
  const absDeltaY = Math.abs(deltaY)

  // Must be predominantly horizontal (3:1 ratio) and span at least 30% of canvas width
  if (absDeltaX < absDeltaY * 3) return null
  if (absDeltaX < canvasWidth * 0.3) return null

  return deltaX > 0 ? 'space' : 'backspace'
}

export default function App() {
  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStrokesRef = useRef<Point[][]>([])

  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('loading')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const pendingKeyRef = useRef(0)
  const [pendingKey, setPendingKey] = useState(0)
  const historySeqRef = useRef(0)

  // Accumulated text built letter by letter
  const [builtText, setBuiltText] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    engine.initialize().then((status) => {
      const saved = loadProfile()
      if (saved) {
        engine.setProfile(saved)
        setUserProfile(saved)
        setEngineStatus('personal')
        setAppMode('recognition')
      } else {
        setEngineStatus(status)
        setAppMode('training')
      }
    })
    return () => engine.dispose()
  }, [])

  const applyProfile = useCallback((profile: UserProfile) => {
    engine.setProfile(profile)
    setUserProfile(profile)
    setEngineStatus('personal')
  }, [])

  const handleTrainingComplete = useCallback((profile: UserProfile) => {
    saveProfile(profile)
    applyProfile(profile)
    setAppMode('recognition')
  }, [applyProfile])

  const handleTrainingBack = useCallback(() => {
    if (userProfile && totalSamples(userProfile) > 0) {
      setAppMode('recognition')
    } else {
      const saved = loadProfile()
      if (saved) {
        applyProfile(saved)
        setAppMode('recognition')
      }
    }
  }, [userProfile, applyProfile])

  const handleResetProfile = useCallback(() => {
    deleteProfile()
    setUserProfile(null)
    engine.clearProfile()
    setEngineStatus(engine.getStatus())
    setResult(null)
    setHistory([])
    setBuiltText('')
    setAppMode('training')
  }, [])

  const clearCanvas = useCallback(() => {
    canvasRef.current?.clear()
    pendingStrokesRef.current = []
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    setIsPending(false)
  }, [])

  const recognize = useCallback(async (strokes: Point[][]) => {
    if (isProcessing || strokes.length === 0) return
    const size = canvasRef.current?.getCanvasSize() ?? { width: 400, height: 400 }

    // Detect horizontal gestures before running the recognition engine
    const gesture = detectGesture(strokes, size.width)
    if (gesture !== null) {
      if (gesture === 'space') {
        setBuiltText(t => t + ' ')
        speakChar(' ')
      } else {
        setBuiltText(t => t.slice(0, -1))
      }
      setResult(null)
      clearCanvas()
      return
    }

    setIsProcessing(true)
    try {
      const r = await engine.recognize(strokes, size.width, size.height)
      setResult(r)
      historySeqRef.current += 1
      setHistory(prev => {
        const entry: HistoryEntry = { id: historySeqRef.current, result: r, timestamp: new Date() }
        const next = [...prev, entry]
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
      })

      // Accepted = recognizer returned a real character (it already applies its own confidence gate)
      if (r.letter !== '?') {
        setBuiltText(t => t + r.letter)
        clearCanvas()
        speakChar(r.letter)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, clearCanvas])

  const handleStrokeEnd = useCallback((strokes: Point[][]) => {
    pendingStrokesRef.current = strokes
    if (!autoMode) return

    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)

    pendingKeyRef.current += 1
    setPendingKey(pendingKeyRef.current)
    setIsPending(true)

    autoTimerRef.current = setTimeout(() => {
      setIsPending(false)
      recognize(pendingStrokesRef.current)
    }, AUTO_RECOGNIZE_DELAY)
  }, [autoMode, recognize])

  const handleDrawStart = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    setIsPending(false)
  }, [])

  const handleManualRecognize = useCallback(() => {
    const strokes = canvasRef.current?.getStrokes() ?? []
    recognize(strokes)
  }, [recognize])

  const handleClearCanvas = useCallback(() => {
    setResult(null)
    setIsProcessing(false)
    clearCanvas()
  }, [clearCanvas])

  const handleCopyText = useCallback(async () => {
    if (!builtText) return
    try {
      await navigator.clipboard.writeText(builtText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard not available */ }
  }, [builtText])

  const handleClearText = useCallback(() => {
    setBuiltText('')
    handleClearCanvas()
  }, [handleClearCanvas])

  const handleSpeakText = useCallback(() => {
    if (!builtText) {
      speak('Aucun texte à lire')
      return
    }
    speak(builtText.toLowerCase())
  }, [builtText])

  if (appMode === 'loading') {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ background: '#0a0a0a', color: '#444' }}
      >
        <div className="text-sm animate-pulse">Initialisation…</div>
      </div>
    )
  }

  if (appMode === 'training') {
    return (
      <TrainingScreen
        initialProfile={userProfile}
        onComplete={handleTrainingComplete}
        onBack={handleTrainingBack}
      />
    )
  }

  const trained = userProfile ? trainedLetters(userProfile) : []

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      {/* Header */}
      <header
        className="flex-none flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}
      >
        <div className="flex items-center gap-3">
          <InkLogo />
          <div>
            <div className="text-sm font-semibold" style={{ color: '#c7d2fe' }}>AskInkAI</div>
            <div className="text-xs" style={{ color: '#444' }}>Spike Reconnaissance</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {userProfile && trained.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#6ee7b7',
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
              Profil · {trained.length}/26
            </div>
          )}

          <button
            onClick={() => setAppMode('training')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: '#1a1a1a', color: '#888', border: '1px solid #222' }}
          >
            ✏️ Entraîner
          </button>

          {userProfile && (
            <button
              onClick={handleResetProfile}
              className="text-xs px-2 py-1.5 rounded-lg"
              style={{ color: '#444', background: 'none', border: '1px solid #1a1a1a' }}
              title="Supprimer le profil et recommencer l'entraînement"
            >
              ↺ Reset
            </button>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs" style={{ color: '#666' }}>Auto</span>
            <button
              onClick={() => setAutoMode(v => !v)}
              className="relative rounded-full transition-colors duration-200"
              style={{
                width: 36, height: 20,
                background: autoMode ? '#6366f1' : '#2a2a2a',
                border: 'none', cursor: 'pointer',
              }}
              aria-label={`Auto-reconnaissance ${autoMode ? 'activée' : 'désactivée'}`}
            >
              <span
                className="absolute top-0.5 rounded-full transition-transform duration-200"
                style={{
                  width: 16, height: 16, background: '#fff', left: 2,
                  transform: autoMode ? 'translateX(16px)' : 'translateX(0)',
                }}
              />
            </button>
          </label>
        </div>
      </header>

      {/* Text composition bar */}
      <div
        className="flex-none flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}
      >
        {/* Text display */}
        <div
          className="flex-1 min-w-0 px-3 py-2 rounded-lg overflow-x-auto"
          style={{
            background: '#111',
            border: '1px solid #222',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {builtText ? (
            <span style={{ color: '#f5f5f5', fontFamily: 'monospace', fontSize: 20, whiteSpace: 'pre', letterSpacing: 1 }}>
              {builtText}
              <span className="cursor-blink" style={{ color: '#6366f1' }}>|</span>
            </span>
          ) : (
            <span style={{ color: '#333', fontFamily: 'monospace', fontSize: 14 }}>
              Dessine des lettres — elles s'accumuleront ici…
            </span>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopyText}
          disabled={!builtText}
          className="flex-none flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: copied ? 'rgba(16,185,129,0.2)' : builtText ? '#6366f1' : '#1a1a1a',
            color: copied ? '#6ee7b7' : builtText ? '#fff' : '#333',
            border: copied ? '1px solid rgba(16,185,129,0.4)' : 'none',
            cursor: builtText ? 'pointer' : 'not-allowed',
            minWidth: 90,
            justifyContent: 'center',
          }}
        >
          {copied ? '✓ Copié' : '⎘ Copier'}
        </button>

        {/* Speak button */}
        <button
          onClick={handleSpeakText}
          className="flex-none flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: 'rgba(251,191,36,0.12)',
            color: '#fbbf24',
            border: '1px solid rgba(251,191,36,0.3)',
            cursor: 'pointer',
            minWidth: 90,
            justifyContent: 'center',
          }}
        >
          🔊 Énoncer
        </button>

        {/* Clear text button */}
        <button
          onClick={handleClearText}
          disabled={!builtText}
          className="flex-none flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: builtText ? 'rgba(239,68,68,0.15)' : '#1a1a1a',
            color: builtText ? '#f87171' : '#333',
            border: builtText ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1a1a1a',
            cursor: builtText ? 'pointer' : 'not-allowed',
            minWidth: 90,
            justifyContent: 'center',
          }}
        >
          ✕ Effacer
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Canvas */}
        <div className="flex flex-col" style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            <DrawingCanvas
              ref={canvasRef}
              onStrokeEnd={handleStrokeEnd}
              onDrawStart={handleDrawStart}
              isProcessing={isProcessing}
            />
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: '#111', flexShrink: 0 }}>
            {isPending && autoMode && (
              <div
                key={pendingKey}
                style={{
                  height: '100%',
                  background: '#6366f1',
                  animation: `recognition-progress ${AUTO_RECOGNIZE_DELAY}ms linear forwards`,
                }}
              />
            )}
          </div>

          <div
            className="flex-none flex items-center gap-2 px-3 py-2"
            style={{ borderTop: '1px solid #1a1a1a', background: '#0d0d0d' }}
          >
            <button
              onClick={handleClearCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ background: '#1a1a1a', color: '#888', border: '1px solid #222' }}
            >
              <span>✕</span>
              <span>Effacer dessin</span>
            </button>

            {!autoMode && (
              <button
                onClick={handleManualRecognize}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: isProcessing ? '#2a2a2a' : '#6366f1',
                  color: isProcessing ? '#555' : '#fff',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.6 : 1,
                }}
              >
                {isProcessing ? '⏳ Analyse…' : '🔍 Reconnaître'}
              </button>
            )}

            {autoMode && (
              <span className="text-xs ml-auto" style={{ color: isPending ? '#6366f1' : '#444' }}>
                {isPending
                  ? 'Attente fin du tracé…'
                  : `Auto · ${AUTO_RECOGNIZE_DELAY / 1000}s après le dernier trait`}
              </span>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div
          className="flex-none overflow-y-auto"
          style={{ width: 320, borderLeft: '1px solid #1a1a1a', background: '#0a0a0a' }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className="text-xs font-mono" style={{ color: '#444' }}>RÉSULTATS</span>
            {history.length > 0 && (
              <button
                onClick={() => { setHistory([]); historySeqRef.current = 0 }}
                className="text-xs"
                style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Vider
              </button>
            )}
          </div>
          <ResultPanel
            result={result}
            history={history}
            engineStatus={engineStatus}
            profileLetterCount={trained.length}
          />
        </div>
      </div>

      {/* Gesture hint bar */}
      <div
        className="flex-none flex items-center justify-center gap-6 px-4 py-1.5"
        style={{ borderTop: '1px solid #111', background: '#080808' }}
      >
        <span className="text-xs" style={{ color: '#2a2a2a' }}>
          →→ trait horizontal : espace
        </span>
        <span className="text-xs" style={{ color: '#2a2a2a' }}>
          ←← trait horizontal : suppr.
        </span>
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
