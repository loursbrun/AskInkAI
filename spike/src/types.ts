export interface Point {
  x: number
  y: number
  t: number
}

export type Stroke = Point[]

export type EngineType = 'personalized' | 'tfjs-emnist' | 'image-nn' | 'stroke-analysis' | 'none'

export interface TopCandidate {
  letter: string
  score: number
}

export interface StrokeFeatures {
  aspectRatio: number
  bboxWidthPct: number
  bboxHeightPct: number
  relativeLength: number
  closure: number
  dirChangesX: number
  dirChangesY: number
  centroidX: number
  centroidY: number
}

export interface RecognitionResult {
  letter: string
  confidence: number
  engine: EngineType
  topCandidates: TopCandidate[]
  features?: StrokeFeatures
  processingMs: number
}

export interface HistoryEntry {
  id: number
  result: RecognitionResult
  timestamp: Date
}

export type EngineStatus = 'loading' | 'personal' | 'ready' | 'fallback' | 'error'
