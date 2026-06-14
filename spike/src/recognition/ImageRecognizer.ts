import { strokesToEMNISTTensor } from './preprocessor'
import { extractImageFeatures, featureDistance, type ImageFeatures } from './imageFeatures'
import { buildTemplates } from './templateEngine'
import type { Point, RecognitionResult, TopCandidate } from '../types'

// Minimum confidence to return a prediction; below this → '?'
const CONFIDENCE_THRESHOLD = 0.25

// Maximum expected distance for a "good" match (calibrated for 72-dim feature space)
const MAX_GOOD_DIST = 5.0

// How many strokes are typical per letter (used as a soft constraint)
const STROKE_PREFS: Record<string, number[]> = {
  A: [2, 3],    B: [1, 2],    C: [1],       D: [1, 2],
  E: [1, 2, 3, 4], F: [1, 2, 3], G: [1, 2],   H: [2, 3],
  I: [1, 2, 3], J: [1, 2],   K: [2, 3],    L: [1, 2],
  M: [1, 2, 3, 4], N: [1, 2, 3], O: [1],      P: [1, 2],
  Q: [1, 2],    R: [1, 2],   S: [1],       T: [1, 2],
  U: [1, 2],    V: [1, 2],   W: [1, 2, 3, 4], X: [2, 3],
  Y: [1, 2, 3], Z: [1, 2, 3],
}

export class ImageRecognizer {
  private templates: Map<string, ImageFeatures> | null = null

  initialize(): void {
    this.templates = buildTemplates()
  }

  isReady(): boolean {
    return this.templates !== null
  }

  recognize(strokes: Point[][]): RecognitionResult {
    const t0 = performance.now()

    if (!this.templates) throw new Error('ImageRecognizer not initialized')

    const tensor = strokesToEMNISTTensor(strokes)
    const inputFeatures = extractImageFeatures(tensor)
    const numStrokes = strokes.filter(s => s.length > 0).length

    // Compute adjusted distance to each template
    const ranked: Array<{ letter: string; dist: number; adjusted: number }> = []
    for (const [letter, tmpl] of this.templates) {
      const dist = featureDistance(inputFeatures, tmpl)
      const penalty = strokePenalty(letter, numStrokes)
      ranked.push({ letter, dist, adjusted: dist + penalty })
    }
    ranked.sort((a, b) => a.adjusted - b.adjusted)

    const best = ranked[0]
    const second = ranked[1]

    // Absolute quality: 0 if best distance is too large
    const absoluteQuality = Math.max(0, 1 - best.adjusted / MAX_GOOD_DIST)

    // Relative quality: how much better is best vs second-best
    const denom = best.adjusted + second.adjusted
    const margin = denom > 0 ? (second.adjusted - best.adjusted) / denom : 0
    const relativeQuality = Math.tanh(margin * 6)  // smooth 0→1 curve

    const confidence = Math.min(0.99, absoluteQuality * relativeQuality)

    // Build top-5 candidates with plausible score distribution
    const maxDist = ranked[ranked.length - 1].adjusted || 1
    const topCandidates: TopCandidate[] = ranked.slice(0, 5).map((r, i) => ({
      letter: r.letter,
      score: i === 0
        ? confidence
        : Math.max(0, confidence * (1 - (r.adjusted - best.adjusted) / (maxDist - best.adjusted + 0.001)) * 0.6),
    }))

    const letter = confidence >= CONFIDENCE_THRESHOLD ? best.letter : '?'

    return {
      letter,
      confidence,
      engine: 'image-nn',
      topCandidates,
      processingMs: performance.now() - t0,
    }
  }
}

function strokePenalty(letter: string, numStrokes: number): number {
  const prefs = STROKE_PREFS[letter]
  if (!prefs || prefs.includes(numStrokes)) return 0
  const minDist = Math.min(...prefs.map(e => Math.abs(e - numStrokes)))
  return minDist * 0.35
}
