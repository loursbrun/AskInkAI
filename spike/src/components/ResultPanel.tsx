import type { RecognitionResult, HistoryEntry, EngineStatus, StrokeFeatures } from '../types'

interface Props {
  result: RecognitionResult | null
  history: HistoryEntry[]
  engineStatus: EngineStatus
  profileLetterCount?: number
}

export default function ResultPanel({ result, history, engineStatus, profileLetterCount = 0 }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: '#f5f5f5' }}>
      {/* Engine badge */}
      <div className="flex-none px-4 pt-4 pb-3">
        <EngineBadge status={engineStatus} result={result} profileLetterCount={profileLetterCount} />
      </div>

      {/* Main result */}
      <div className="flex-none px-4 pb-4">
        {result ? (
          <CurrentResult result={result} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Top candidates */}
      {result && result.topCandidates.length > 0 && (
        <div className="flex-none px-4 pb-4">
          <TopCandidates candidates={result.topCandidates} />
        </div>
      )}

      {/* Features (stroke analysis mode) */}
      {result?.features && (
        <div className="flex-none px-4 pb-4">
          <FeatureTable features={result.features} />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          <History entries={history} />
        </div>
      )}
    </div>
  )
}

function EngineBadge({
  status,
  result,
  profileLetterCount,
}: {
  status: EngineStatus
  result: RecognitionResult | null
  profileLetterCount: number
}) {
  const engine = result?.engine

  const engineLabel =
    engine === 'personalized' ? 'Profil perso.' :
    engine === 'tfjs-emnist' ? 'TF.js EMNIST' :
    engine === 'image-nn' ? 'Image NNM' :
    engine === 'stroke-analysis' ? 'Géom.' : '—'

  const engineColor =
    engine === 'personalized'
      ? { bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7', border: 'rgba(16,185,129,0.4)' }
      : engine === 'tfjs-emnist'
      ? { bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc', border: 'rgba(99,102,241,0.4)' }
      : engine === 'image-nn'
      ? { bg: 'rgba(56,189,248,0.2)', text: '#7dd3fc', border: 'rgba(56,189,248,0.4)' }
      : { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)' }

  const statusText =
    status === 'loading' ? 'Initialisation…' :
    status === 'personal' ? `Profil actif · ${profileLetterCount}/26 lettres` :
    status === 'ready' ? 'Modèle EMNIST actif' :
    status === 'fallback' ? 'Reconnaissance par image' :
    'Erreur moteur'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatusDot status={status} />
      <span className="text-xs" style={{ color: '#888' }}>{statusText}</span>

      {result && (
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono"
          style={{
            background: engineColor.bg,
            color: engineColor.text,
            border: `1px solid ${engineColor.border}`,
          }}
        >
          {engineLabel}
        </span>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: EngineStatus }) {
  const color = {
    loading: '#888',
    personal: '#10b981',
    ready: '#4ade80',
    fallback: '#fbbf24',
    error: '#f87171',
  }[status]

  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{
        background: color,
        boxShadow: (status === 'ready' || status === 'personal') ? `0 0 4px ${color}` : 'none',
      }}
    />
  )
}

function CurrentResult({ result }: { result: RecognitionResult }) {
  const confPct = Math.round(result.confidence * 100)
  const isUnknown = result.letter === '?'

  return (
    <div
      className="rounded-xl p-4 fade-in"
      style={{
        background: '#111',
        border: `1px solid ${isUnknown ? '#2a2020' : '#222'}`,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Big letter / unknown indicator */}
        <div
          className="flex-none flex items-center justify-center rounded-lg letter-flash"
          style={{
            width: 80,
            height: 80,
            background: isUnknown ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${isUnknown ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.3)'}`,
          }}
        >
          {isUnknown ? (
            <span style={{ fontSize: 32, color: '#f87171', lineHeight: 1 }}>?</span>
          ) : (
            <span
              style={{
                fontSize: 52,
                fontFamily: 'Georgia, serif',
                color: '#c7d2fe',
                lineHeight: 1,
              }}
            >
              {result.letter}
            </span>
          )}
        </div>

        {/* Label + confidence + timing */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <span
              style={{
                color: isUnknown ? '#f87171' : '#c7d2fe',
                fontSize: isUnknown ? 14 : 22,
                fontWeight: 600,
              }}
            >
              {isUnknown ? 'Non reconnue' : result.letter}
            </span>
            <span style={{ color: '#888', fontSize: 12 }}>
              {confPct}% confiance
            </span>
          </div>

          {/* Confidence bar */}
          <div className="rounded-full overflow-hidden mb-2" style={{ background: '#1e1e1e', height: 6 }}>
            <div
              className="h-full confidence-bar rounded-full"
              style={{
                width: `${confPct}%`,
                background: isUnknown
                  ? '#f87171'
                  : confPct > 60
                  ? '#6366f1'
                  : confPct > 35
                  ? '#fbbf24'
                  : '#f87171',
              }}
            />
          </div>

          {isUnknown && (
            <div style={{ color: '#664444', fontSize: 11, marginBottom: 4 }}>
              Confidence trop faible — redessine la lettre
            </div>
          )}

          <div style={{ color: '#555', fontSize: 11 }}>
            {result.processingMs.toFixed(1)} ms
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{ background: '#111', border: '1px solid #1a1a1a' }}
    >
      <div style={{ color: '#333', fontSize: 40, marginBottom: 8 }}>✏️</div>
      <div style={{ color: '#444', fontSize: 13 }}>
        Dessine une lettre sur le canvas
      </div>
    </div>
  )
}

function TopCandidates({ candidates }: { candidates: Array<{ letter: string; score: number }> }) {
  const max = candidates[0]?.score || 1

  return (
    <div>
      <div className="text-xs mb-2" style={{ color: '#555', fontFamily: 'monospace' }}>
        TOP 5 CANDIDATS
      </div>
      <div className="flex flex-col gap-1.5">
        {candidates.map((c, i) => (
          <div key={c.letter} className="flex items-center gap-2">
            <span
              className="flex-none w-6 text-center font-mono text-sm"
              style={{ color: i === 0 ? '#c7d2fe' : '#666' }}
            >
              {c.letter}
            </span>
            <div className="flex-1 rounded overflow-hidden" style={{ background: '#1a1a1a', height: 14 }}>
              <div
                className="h-full confidence-bar"
                style={{
                  width: `${(c.score / max) * 100}%`,
                  background: i === 0 ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.25)',
                }}
              />
            </div>
            <span
              className="flex-none text-xs font-mono w-10 text-right"
              style={{ color: '#555' }}
            >
              {(c.score * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureTable({ features }: { features: StrokeFeatures }) {
  const rows: Array<{ label: string; value: string; note: string }> = [
    {
      label: 'Ratio w/h',
      value: features.aspectRatio.toFixed(2),
      note: features.aspectRatio < 0.5 ? 'vertical' : features.aspectRatio > 1.8 ? 'horizontal' : 'carré',
    },
    {
      label: 'Fermeture',
      value: (features.closure * 100).toFixed(0) + '%',
      note: features.closure > 0.7 ? 'boucle fermée' : features.closure < 0.3 ? 'ouvert' : 'semi-fermé',
    },
    {
      label: 'Chgt dir X',
      value: String(features.dirChangesX),
      note: features.dirChangesX === 0 ? 'mono-dir' : `${features.dirChangesX} inversions`,
    },
    {
      label: 'Chgt dir Y',
      value: String(features.dirChangesY),
      note: features.dirChangesY === 0 ? 'mono-dir' : `${features.dirChangesY} inversions`,
    },
    {
      label: 'Complexité',
      value: features.relativeLength.toFixed(1) + 'x',
      note: features.relativeLength < 1.5 ? 'simple' : features.relativeLength > 3 ? 'complexe' : 'moyen',
    },
    {
      label: 'Centroïde',
      value: `(${(features.centroidX * 100).toFixed(0)}%, ${(features.centroidY * 100).toFixed(0)}%)`,
      note: 'x% y%',
    },
  ]

  return (
    <div>
      <div className="text-xs mb-2" style={{ color: '#555', fontFamily: 'monospace' }}>
        CARACTÉRISTIQUES GÉOMÉTRIQUES
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid #1e1e1e' }}
      >
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center px-3 py-1.5"
            style={{
              background: i % 2 === 0 ? '#0f0f0f' : '#111',
              borderBottom: i < rows.length - 1 ? '1px solid #1a1a1a' : 'none',
            }}
          >
            <span className="flex-none text-xs font-mono w-24" style={{ color: '#555' }}>
              {row.label}
            </span>
            <span className="flex-none text-xs font-mono w-20" style={{ color: '#aaa' }}>
              {row.value}
            </span>
            <span className="flex-1 text-xs" style={{ color: '#444' }}>
              {row.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function History({ entries }: { entries: HistoryEntry[] }) {
  const reversed = [...entries].reverse()

  return (
    <div>
      <div className="text-xs mb-2" style={{ color: '#555', fontFamily: 'monospace' }}>
        HISTORIQUE ({entries.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reversed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{
              background: '#111',
              border: '1px solid #1e1e1e',
            }}
            title={`${entry.result.engine} · ${(entry.result.confidence * 100).toFixed(0)}% · ${entry.result.processingMs.toFixed(1)}ms`}
          >
            <span className="font-mono text-sm" style={{ color: '#c7d2fe' }}>
              {entry.result.letter}
            </span>
            <span className="text-xs" style={{ color: '#444' }}>
              {(entry.result.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
