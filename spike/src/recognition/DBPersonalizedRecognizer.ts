import { DBPathRecognizer } from './DBPathRecognizer'
import { MIN_SAMPLES, type UserProfile } from './userProfile'
import type { Point, RecognitionResult, TopCandidate } from '../types'

const SLICE_COUNT = 8
const DELTA_MOVE = 16.0

// Cost at which absolute quality reaches 0. Real user strokes produce 15-30
// direction steps; a cost of 80 corresponds to every step being off by ~1.
const COST_NORMALIZE = 80

// Minimum combined confidence (absolute × relative) to accept a result.
const CONFIDENCE_THRESHOLD = 0.15

export class DBPersonalizedRecognizer {
  private profile: UserProfile | null = null
  // costMax=9999 → no hard cutoff; we use CONFIDENCE_THRESHOLD instead
  private readonly recognizer = new DBPathRecognizer<string>(SLICE_COUNT, DELTA_MOVE, 9999)

  setProfile(profile: UserProfile): void {
    this.profile = profile
    this.rebuildModels()
  }

  isReady(): boolean {
    if (!this.profile) return false
    for (const samples of Object.values(this.profile.alphabet)) {
      if ((samples?.length ?? 0) >= MIN_SAMPLES) return true
    }
    return false
  }

  recognize(strokes: Point[][]): RecognitionResult {
    const t0 = performance.now()
    if (!this.profile) throw new Error('No profile loaded')

    // Compute direction codes per stroke independently (avoids spurious
    // cross-stroke direction jumps) then concatenate into one sequence.
    const inputDirs = this.strokesToDirections(strokes)

    if (inputDirs.length === 0) {
      return { letter: '?', confidence: 0, engine: 'personalized', topCandidates: [], processingMs: performance.now() - t0 }
    }

    const allMatches = this.recognizer.compareAll(inputDirs)

    // Group by letter: keep the minimum cost across all training samples
    const letterCosts = new Map<string, number>()
    for (const { model, cost } of allMatches) {
      const prev = letterCosts.get(model.data) ?? Infinity
      if (cost < prev) letterCosts.set(model.data, cost)
    }

    const ranked = [...letterCosts.entries()].sort((a, b) => a[1] - b[1])

    if (ranked.length === 0) {
      return { letter: '?', confidence: 0, engine: 'personalized', topCandidates: [], processingMs: performance.now() - t0 }
    }

    const bestCost = ranked[0][1]
    const secondCost = ranked[1]?.[1] ?? (bestCost * 2 + 1)

    // Absolute quality: how good is the best match?
    const absoluteQuality = Math.max(0, 1 - bestCost / COST_NORMALIZE)

    // Relative quality: how much better is best vs second-best?
    const denom = bestCost + secondCost
    const margin = denom > 0 ? (secondCost - bestCost) / denom : 0
    const relativeQuality = Math.tanh(margin * 4)

    const confidence = Math.min(0.99, absoluteQuality * relativeQuality)
    const letter = confidence >= CONFIDENCE_THRESHOLD ? ranked[0][0] : '?'

    const topCandidates: TopCandidate[] = ranked.slice(0, 5).map(([l, cost]) => ({
      letter: l,
      score: Math.max(0, 1 - cost / COST_NORMALIZE),
    }))

    return {
      letter,
      confidence,
      engine: 'personalized',
      topCandidates,
      processingMs: performance.now() - t0,
    }
  }

  // Called whenever the profile changes — rebuilds models from stored raw strokes.
  private rebuildModels(): void {
    this.recognizer.clearModels()
    if (!this.profile) return

    for (const [letter, samples] of Object.entries(this.profile.alphabet)) {
      if (!samples) continue
      for (const sample of samples) {
        // Process each stroke independently then concatenate direction codes
        const dirs: number[] = []
        for (const stroke of sample.strokes) {
          if (stroke.length >= 2) {
            dirs.push(...this.recognizer.extractDirections(stroke))
          }
        }
        if (dirs.length > 0) {
          this.recognizer.addModel({ directions: dirs, data: letter })
        }
      }
    }
  }

  private strokesToDirections(strokes: Point[][]): number[] {
    const allDirs: number[] = []
    for (const stroke of strokes) {
      if (stroke.length < 2) continue
      allDirs.push(...this.recognizer.extractDirections(stroke.map(p => ({ x: p.x, y: p.y }))))
    }
    return allDirs
  }
}
