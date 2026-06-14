import { strokesToEMNISTTensor } from './preprocessor'
import { extractImageFeatures, featureDistance } from './imageFeatures'
import { MIN_SAMPLES, type UserProfile } from './userProfile'
import type { Point, RecognitionResult, TopCandidate } from '../types'

// Below this confidence the result is returned as '?' (unknown)
const CONFIDENCE_THRESHOLD = 0.30

// Maximum "good" distance — beyond this even the best match is considered poor
const MAX_GOOD_DIST = 4.5

// How many nearest samples per class to average for robust distance
const K_PER_CLASS = 3

export class PersonalizedRecognizer {
  private profile: UserProfile | null = null

  setProfile(profile: UserProfile): void {
    this.profile = profile
  }

  isReady(): boolean {
    if (!this.profile) return false
    // Usable when at least 2 letters are trained (enough to discriminate)
    let count = 0
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i)
      if ((this.profile.alphabet[letter]?.length ?? 0) >= MIN_SAMPLES) {
        count++
        if (count >= 2) return true
      }
    }
    return false
  }

  recognize(strokes: Point[][]): RecognitionResult {
    const t0 = performance.now()

    if (!this.profile) throw new Error('No profile loaded')

    const tensor = strokesToEMNISTTensor(strokes)
    const input = extractImageFeatures(tensor)

    // For each trained letter, compute a robust per-class distance:
    // average of the K_PER_CLASS nearest samples (less sensitive to outliers).
    const perClass: Array<{ letter: string; dist: number }> = []

    for (const [letter, samples] of Object.entries(this.profile.alphabet)) {
      if (!samples || samples.length < MIN_SAMPLES) continue

      const dists = samples
        .map(s => featureDistance(input, s.features))
        .sort((a, b) => a - b)

      const k = Math.min(K_PER_CLASS, dists.length)
      const avgDist = dists.slice(0, k).reduce((a, b) => a + b, 0) / k

      perClass.push({ letter, dist: avgDist })
    }

    if (perClass.length === 0) {
      return {
        letter: '?',
        confidence: 0,
        engine: 'personalized',
        topCandidates: [],
        processingMs: performance.now() - t0,
      }
    }

    perClass.sort((a, b) => a.dist - b.dist)

    const best = perClass[0]
    const second = perClass[1] ?? { letter: '?', dist: MAX_GOOD_DIST * 2 }

    // Absolute quality: how close is the best match?
    const absoluteQuality = Math.max(0, 1 - best.dist / MAX_GOOD_DIST)

    // Relative quality: how much better is best vs second?
    const denom = best.dist + second.dist
    const margin = denom > 0 ? (second.dist - best.dist) / denom : 0
    const relativeQuality = Math.tanh(margin * 6)

    const confidence = Math.min(0.99, absoluteQuality * relativeQuality)

    // Build top-5 for display
    const maxDist = perClass[perClass.length - 1]?.dist ?? 1
    const topCandidates: TopCandidate[] = perClass.slice(0, 5).map((c, i) => ({
      letter: c.letter,
      score: i === 0
        ? confidence
        : Math.max(0, (1 - c.dist / maxDist) * (1 - confidence) * 0.8),
    }))

    const letter = confidence >= CONFIDENCE_THRESHOLD ? best.letter : '?'

    return {
      letter,
      confidence,
      engine: 'personalized',
      topCandidates,
      processingMs: performance.now() - t0,
    }
  }
}
