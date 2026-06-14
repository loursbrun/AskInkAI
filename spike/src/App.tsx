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

// Délai après le DERNIER trait avant de lancer la reconnaissance.
// Doit être suffisamment long pour les lettres multi-traits (A, E, F, H, I, T, X…).
const AUTO_RECOGNIZE_DELAY = 1000
const MAX_HISTORY = 10

const engine = new RecognitionEngine()

type AppMode = 'loading' | 'training' | 'recognition'

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
  // Visual pending state: true while the debounce timer is running
  const [isPending, setIsPending] = useState(false)
  // Increments on each new stroke to restart the progress-bar CSS animation
  const pendingKeyRef = useRef(0)
  const [pendingKey, setPendingKey] = useState(0)
  const historySeqRef = useRef(0)

  // Initialize engine + load profile
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
        setAppMode('training')  // first run: go straight to training
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
    // Allow returning to recognition even if training is incomplete
    if (userProfile && totalSamples(userProfile) > 0) {
      setAppMode('recognition')
    } else {
      const saved = loadProfile()
      if (saved) {
        applyProfile(saved)
        setAppMode('recognition')
      }
      // else stays on training (no profile to fall back to)
    }
  }, [userProfile, applyProfile])

  const handleResetProfile = useCallback(() => {
    deleteProfile()
    setUserProfile(null)
    engine.clearProfile()
    setEngineStatus(engine.getStatus())
    setResult(null)
    setHistory([])
    setAppMode('training')
  }, [])

  const recognize = useCallback(async (strokes: Point[][]) => {
    if (isProcessing || strokes.length === 0) return
    const size = canvasRef.current?.getCanvasSize() ?? { width: 400, height: 400 }

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
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing])

  const handleStrokeEnd = useCallback((strokes: Point[][]) => {
    pendingStrokesRef.current = strokes
    if (!autoMode) return

    // Réinitialise le timer à chaque nouveau trait
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)

    // Incrémente la clé pour relancer l'animation de la barre de progression
    pendingKeyRef.current += 1
    setPendingKey(pendingKeyRef.current)
    setIsPending(true)

    autoTimerRef.current = setTimeout(() => {
      setIsPending(false)
      recognize(pendingStrokesRef.current)
    }, AUTO_RECOGNIZE_DELAY)
  }, [autoMode, recognize])

  const handleDrawStart = useCallback(() => {
    // Nouveau trait : on annule le timer en cours (pas encore parti analyser)
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    // La barre de progression sera relancée quand le trait se termine
    setIsPending(false)
  }, [])

  const handleManualRecognize = useCallback(() => {
    const strokes = canvasRef.current?.getStrokes() ?? []
    recognize(strokes)
  }, [recognize])

  const handleClear = useCallback(() => {
    canvasRef.current?.clear()
    setResult(null)
    setIsPending(false)
    pendingStrokesRef.current = []
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    setIsProcessing(false)
  }, [])

  // ── Loading splash ────────────────────────────────────────────────────────
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

  // ── Training screen ───────────────────────────────────────────────────────
  if (appMode === 'training') {
    return (
      <TrainingScreen
        initialProfile={userProfile}
        onComplete={handleTrainingComplete}
        onBack={handleTrainingBack}
      />
    )
  }

  // ── Recognition UI ────────────────────────────────────────────────────────
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
          {/* Profile badge */}
          {userProfile && trained.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#6ee7b7',
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: '#10b981' }}
              />
              Profil · {trained.length}/26
            </div>
          )}

          {/* Training button */}
          <button
            onClick={() => setAppMode('training')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: '#1a1a1a',
              color: '#888',
              border: '1px solid #222',
            }}
          >
            ✏️ Entraîner
          </button>

          {/* Reset profile */}
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

          {/* Auto-recognition toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs" style={{ color: '#666' }}>Auto</span>
            <button
              onClick={() => setAutoMode(v => !v)}
              className="relative rounded-full transition-colors duration-200"
              style={{
                width: 36,
                height: 20,
                background: autoMode ? '#6366f1' : '#2a2a2a',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={`Auto-reconnaissance ${autoMode ? 'activée' : 'désactivée'}`}
            >
              <span
                className="absolute top-0.5 rounded-full transition-transform duration-200"
                style={{
                  width: 16,
                  height: 16,
                  background: '#fff',
                  left: 2,
                  transform: autoMode ? 'translateX(16px)' : 'translateX(0)',
                }}
              />
            </button>
          </label>
        </div>
      </header>

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

          {/* Barre de progression : se remplit pendant le délai d'attente avant analyse */}
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
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ background: '#1a1a1a', color: '#888', border: '1px solid #222' }}
            >
              <span>✕</span>
              <span>Effacer</span>
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
              <span
                className="text-xs ml-auto"
                style={{ color: isPending ? '#6366f1' : '#444' }}
              >
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
