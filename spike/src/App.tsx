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
import AuthPage from './components/AuthPage'
import ApiKeyForm from './components/ApiKeyForm'
import ResponseModal from './components/ResponseModal'
import { api, type User } from './api/client'

const AUTO_RECOGNIZE_DELAY = 1000
const MAX_HISTORY = 10

const engine = new RecognitionEngine()

type AppMode = 'checking-auth' | 'auth' | 'api-key-setup' | 'loading' | 'training' | 'recognition'

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

function speakChar(char: string) {
  if (char === ' ') { speak('espace'); return }
  if (DIGIT_WORDS[char]) { speak(DIGIT_WORDS[char]); return }
  speak(char.toLowerCase())
}

type Gesture = 'space' | 'backspace' | 'send' | 'clear' | 'play'

function detectGesture(strokes: Point[][], canvasWidth: number, canvasHeight: number): Gesture | null {
  if (strokes.length === 0) return null
  const stroke = strokes[strokes.length - 1]
  if (stroke.length < 4) return null
  const first = stroke[0]
  const last = stroke[stroke.length - 1]
  const deltaX = last.x - first.x
  const deltaY = last.y - first.y
  const absDeltaX = Math.abs(deltaX)
  const absDeltaY = Math.abs(deltaY)

  // ◁ triangle (play): vertex on the left, both arms extend rightward
  const xs = stroke.map(p => p.x)
  const minX = Math.min(...xs)
  const minXIdx = xs.indexOf(minX)
  const minXPoint = stroke[minXIdx]
  const relativeMidPos = minXIdx / stroke.length
  const vertexYDrift = Math.abs(minXPoint.y - (first.y + last.y) / 2)
  if (
    relativeMidPos > 0.2 && relativeMidPos < 0.8 &&
    first.x - minX > canvasWidth * 0.12 &&
    last.x - minX > canvasWidth * 0.12 &&
    Math.max(...xs) - minX > canvasWidth * 0.18 &&
    vertexYDrift < canvasHeight * 0.25 &&
    absDeltaY < canvasHeight * 0.3
  ) {
    return 'play'
  }

  // ↑ / ↓ vertical gestures: up = clear, down = send
  if (absDeltaY > absDeltaX * 1.5 && absDeltaY > canvasHeight * 0.25) {
    return deltaY < 0 ? 'clear' : 'send'
  }

  // → / ← horizontal gestures: right = space, left = backspace
  if (absDeltaX < absDeltaY * 3) return null
  if (absDeltaX < canvasWidth * 0.3) return null
  return deltaX > 0 ? 'space' : 'backspace'
}

export default function App() {
  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStrokesRef = useRef<Point[][]>([])

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  // ── Claude state ──────────────────────────────────────────────────────────
  const [claudeResponse, setClaudeResponse] = useState<string | null>(null)
  const [isSendingToClaude, setIsSendingToClaude] = useState(false)
  const [claudeError, setClaudeError] = useState<string | null>(null)

  // ── Recognition app state ─────────────────────────────────────────────────
  const [appMode, setAppMode] = useState<AppMode>('checking-auth')
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
  const [builtText, setBuiltText] = useState('')
  const [isEditingText, setIsEditingText] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── Auth init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.auth.me()
      .then(async (u) => {
        setUser(u)
        const keyInfo = await api.apiKey.get().catch(() => null)
        setApiKeyHint(keyInfo?.hint ?? null)
        // Transition to recognition engine init
        setAppMode('loading')
      })
      .catch(() => {
        setAppMode('auth')
      })
  }, [])

  // ── Recognition engine init (runs after auth confirmed) ───────────────────
  useEffect(() => {
    if (appMode !== 'loading') return
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
  }, [appMode])

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuthSuccess = useCallback(async (u: User) => {
    setUser(u)
    const keyInfo = await api.apiKey.get().catch(() => null)
    setApiKeyHint(keyInfo?.hint ?? null)
    if (!keyInfo) {
      setAppMode('api-key-setup')
    } else {
      setAppMode('loading')
    }
  }, [])

  const handleApiKeySaved = useCallback((hint: string) => {
    setApiKeyHint(hint)
    setShowApiKeyModal(false)
    if (appMode === 'api-key-setup') setAppMode('loading')
  }, [appMode])

  const handleApiKeyDeleted = useCallback(() => {
    setApiKeyHint(null)
    setShowApiKeyModal(false)
  }, [])

  const handleLogout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    setUser(null)
    setApiKeyHint(null)
    setAppMode('auth')
  }, [])

  // ── Recognition handlers ──────────────────────────────────────────────────
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
      if (saved) { applyProfile(saved); setAppMode('recognition') }
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
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
    setIsPending(false)
  }, [])

  const recognize = useCallback(async (strokes: Point[][]) => {
    if (isProcessing || strokes.length === 0) return
    const size = canvasRef.current?.getCanvasSize() ?? { width: 400, height: 400 }
    const gesture = detectGesture(strokes, size.width, size.height)
    if (gesture !== null) {
      setResult(null)
      clearCanvas()
      if (gesture === 'space') { setBuiltText(t => t + ' '); speakChar(' ') }
      else if (gesture === 'backspace') { setBuiltText(t => t.slice(0, -1)) }
      else if (gesture === 'clear') { setBuiltText('') }
      else if (gesture === 'play') { if (builtText) speak(builtText) }
      else if (gesture === 'send') {
        if (!builtText.trim() || isSendingToClaude) return
        if (!apiKeyHint) { setShowApiKeyModal(true); return }
        setClaudeError(null)
        setIsSendingToClaude(true)
        try {
          const { response } = await api.claude.ask(builtText.trim())
          setClaudeResponse(response)
        } catch (err) {
          setClaudeError(err instanceof Error ? err.message : 'Erreur Claude')
        } finally {
          setIsSendingToClaude(false)
        }
      }
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
      if (r.letter !== '?') {
        setBuiltText(t => t + r.letter)
        clearCanvas()
        speakChar(r.letter)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, clearCanvas, builtText, isSendingToClaude, apiKeyHint])

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
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
    setIsPending(false)
  }, [])

  const handleManualRecognize = useCallback(() => {
    recognize(canvasRef.current?.getStrokes() ?? [])
  }, [recognize])

  const handleClearCanvas = useCallback(() => {
    setResult(null); setIsProcessing(false); clearCanvas()
  }, [clearCanvas])

  const handleCopyText = useCallback(async () => {
    if (!builtText) return
    try { await navigator.clipboard.writeText(builtText); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { /* clipboard not available */ }
  }, [builtText])

  const handleClearText = useCallback(() => { setBuiltText(''); handleClearCanvas() }, [handleClearCanvas])

  const handleSpeakText = useCallback(() => {
    if (!builtText) { speak('Aucun texte à lire'); return }
    speak(builtText.toLowerCase())
  }, [builtText])

  // ── Claude send ───────────────────────────────────────────────────────────
  const handleSendToClaude = useCallback(async () => {
    if (!builtText.trim() || isSendingToClaude) return
    if (!apiKeyHint) {
      setShowApiKeyModal(true)
      return
    }
    setClaudeError(null)
    setIsSendingToClaude(true)
    try {
      const { response } = await api.claude.ask(builtText.trim())
      setClaudeResponse(response)
    } catch (err) {
      setClaudeError(err instanceof Error ? err.message : 'Erreur Claude')
    } finally {
      setIsSendingToClaude(false)
    }
  }, [builtText, isSendingToClaude, apiKeyHint])

  // ── Render guards ─────────────────────────────────────────────────────────
  if (appMode === 'checking-auth') {
    return <Splash text="Vérification de la session…" />
  }

  if (appMode === 'auth') {
    return <AuthPage onSuccess={handleAuthSuccess} />
  }

  if (appMode === 'api-key-setup') {
    return (
      <ApiKeyForm
        currentHint={apiKeyHint}
        onSaved={handleApiKeySaved}
        onDeleted={handleApiKeyDeleted}
        onSkip={() => setAppMode('loading')}
      />
    )
  }

  if (appMode === 'loading') {
    return <Splash text="Initialisation du moteur…" />
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
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#0a0a0a' }}>

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
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
              Profil · {trained.length}/26
            </div>
          )}

          {/* API key indicator */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
            style={{
              background: apiKeyHint ? 'rgba(99,102,241,0.1)' : '#1a1a1a',
              border: `1px solid ${apiKeyHint ? 'rgba(99,102,241,0.3)' : '#222'}`,
              color: apiKeyHint ? '#a5b4fc' : '#555',
              cursor: 'pointer',
            }}
            title={apiKeyHint ? `Clé : ${apiKeyHint}` : 'Configurer la clé API Claude'}
          >
            {apiKeyHint ? '🔑 API' : '⚙ API'}
          </button>

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
              title="Supprimer le profil et recommencer"
            >
              ↺ Reset
            </button>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs" style={{ color: '#666' }}>Auto</span>
            <button
              onClick={() => setAutoMode(v => !v)}
              className="relative rounded-full transition-colors duration-200"
              style={{ width: 36, height: 20, background: autoMode ? '#6366f1' : '#2a2a2a', border: 'none', cursor: 'pointer' }}
              aria-label={`Auto-reconnaissance ${autoMode ? 'activée' : 'désactivée'}`}
            >
              <span
                className="absolute top-0.5 rounded-full transition-transform duration-200"
                style={{ width: 16, height: 16, background: '#fff', left: 2, transform: autoMode ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </button>
          </label>

          {/* User + logout */}
          {user && (
            <div className="flex items-center gap-2 ml-1 pl-2" style={{ borderLeft: '1px solid #1a1a1a' }}>
              <span className="text-xs max-w-28 truncate" style={{ color: '#555' }}>{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: '#444', background: '#111', border: '1px solid #1a1a1a', cursor: 'pointer' }}
              >
                Déco.
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Text composition bar */}
      <div
        className="flex-none flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}
      >
        {/* Text display / edit */}
        {isEditingText ? (
          <input
            autoFocus
            value={builtText}
            onChange={e => setBuiltText(e.target.value)}
            onBlur={() => setIsEditingText(false)}
            onKeyDown={e => { if (e.key === 'Enter') setIsEditingText(false) }}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg"
            style={{
              background: '#111',
              border: '1px solid #6366f1',
              minHeight: 44,
              color: '#f5f5f5',
              fontFamily: 'monospace',
              fontSize: 20,
              letterSpacing: 1,
              outline: 'none',
            }}
          />
        ) : (
          <div
            className="flex-1 min-w-0 px-3 py-2 rounded-lg overflow-x-auto"
            onClick={() => setIsEditingText(true)}
            title="Cliquer pour éditer"
            style={{ background: '#111', border: '1px solid #222', minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'text' }}
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
        )}

        {/* Envoyer à Claude */}
        <button
          onClick={handleSendToClaude}
          disabled={!builtText.trim() || isSendingToClaude}
          className="flex-none flex items-center gap-1.5 px-5 rounded-xl text-sm font-semibold transition-all"
          style={{
            height: 52,
            background: isSendingToClaude
              ? '#2a2a2a'
              : builtText.trim()
              ? 'rgba(16,185,129,0.85)'
              : '#1a1a1a',
            color: builtText.trim() && !isSendingToClaude ? '#fff' : '#444',
            border: 'none',
            cursor: builtText.trim() && !isSendingToClaude ? 'pointer' : 'not-allowed',
            minWidth: 110,
            justifyContent: 'center',
          }}
          title={!apiKeyHint ? 'Configurez votre clé API Claude d\'abord' : undefined}
        >
          {isSendingToClaude ? '⏳ Envoi…' : '✉ Envoyer'}
        </button>

        {/* Copy */}
        <button
          onClick={handleCopyText}
          disabled={!builtText}
          className="flex-none flex items-center gap-1.5 px-5 rounded-xl text-sm font-semibold transition-all"
          style={{
            height: 52,
            background: copied ? 'rgba(16,185,129,0.2)' : builtText ? '#6366f1' : '#1a1a1a',
            color: copied ? '#6ee7b7' : builtText ? '#fff' : '#333',
            border: copied ? '1px solid rgba(16,185,129,0.4)' : 'none',
            cursor: builtText ? 'pointer' : 'not-allowed',
            minWidth: 100,
            justifyContent: 'center',
          }}
        >
          {copied ? '✓ Copié' : '⎘ Copier'}
        </button>

        {/* Énoncer */}
        <button
          onClick={handleSpeakText}
          className="flex-none flex items-center gap-1.5 px-5 rounded-xl text-sm font-semibold transition-all"
          style={{ height: 52, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', cursor: 'pointer', minWidth: 100, justifyContent: 'center' }}
        >
          🔊 Énoncer
        </button>

        {/* Effacer */}
        <button
          onClick={handleClearText}
          disabled={!builtText}
          className="flex-none flex items-center gap-1.5 px-5 rounded-xl text-sm font-semibold transition-all"
          style={{
            height: 52,
            background: builtText ? 'rgba(239,68,68,0.15)' : '#1a1a1a',
            color: builtText ? '#f87171' : '#333',
            border: builtText ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1a1a1a',
            cursor: builtText ? 'pointer' : 'not-allowed',
            minWidth: 100,
            justifyContent: 'center',
          }}
        >
          ✕ Effacer
        </button>
      </div>

      {/* Claude error banner */}
      {claudeError && (
        <div
          className="flex-none flex items-center justify-between px-4 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <span>{claudeError}</span>
          <button onClick={() => setClaudeError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
        </div>
      )}

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
                style={{ height: '100%', background: '#6366f1', animation: `recognition-progress ${AUTO_RECOGNIZE_DELAY}ms linear forwards` }}
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
              <span>✕</span><span>Effacer dessin</span>
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
                {isPending ? 'Attente fin du tracé…' : `Auto · ${AUTO_RECOGNIZE_DELAY / 1000}s après le dernier trait`}
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
        className="flex-none flex items-center justify-center gap-4 px-4 py-1.5 flex-wrap"
        style={{ borderTop: '1px solid #111', background: '#080808' }}
      >
        <span className="text-xs" style={{ color: '#2a2a2a' }}>→ espace</span>
        <span className="text-xs" style={{ color: '#2a2a2a' }}>← suppr.</span>
        <span className="text-xs" style={{ color: '#2a2a2a' }}>↑ effacer</span>
        <span className="text-xs" style={{ color: '#2a2a2a' }}>↓ envoyer</span>
        <span className="text-xs" style={{ color: '#2a2a2a' }}>◁ lire</span>
      </div>

      {/* Claude response modal */}
      {claudeResponse && (
        <ResponseModal
          response={claudeResponse}
          onClose={() => { setClaudeResponse(null); window.speechSynthesis.cancel() }}
        />
      )}

      {/* API key management modal */}
      {showApiKeyModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowApiKeyModal(false) }}
        >
          <div className="w-full max-w-md">
            <ApiKeyForm
              currentHint={apiKeyHint}
              onSaved={handleApiKeySaved}
              onDeleted={handleApiKeyDeleted}
              onSkip={() => setShowApiKeyModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-screen w-screen" style={{ background: '#0a0a0a', color: '#444' }}>
      <div className="text-sm animate-pulse">{text}</div>
    </div>
  )
}

function InkLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 22 L14 5 L22 22 M9.5 16 L18.5 16" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
