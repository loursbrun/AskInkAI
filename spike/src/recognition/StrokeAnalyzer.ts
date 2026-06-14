import type { Point, RecognitionResult, StrokeFeatures, TopCandidate } from '../types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/**
 * Geometric heuristic classifier.
 * Extracts stroke features and scores each letter using weighted rules.
 * Accuracy is limited (~15-25%) but provides a real working pipeline.
 */
export class StrokeAnalyzer {
  analyze(strokes: Point[][], canvasWidth: number, canvasHeight: number): RecognitionResult {
    const t0 = performance.now()
    const allPoints = strokes.flat()

    if (allPoints.length < 3) {
      return noStrokeResult(performance.now() - t0)
    }

    const features = this.extractFeatures(allPoints, canvasWidth, canvasHeight)
    const topCandidates = scoreLetters(features)

    return {
      letter: topCandidates[0].letter,
      confidence: topCandidates[0].score,
      engine: 'stroke-analysis',
      topCandidates,
      features,
      processingMs: performance.now() - t0,
    }
  }

  extractFeatures(points: Point[], canvasWidth: number, canvasHeight: number): StrokeFeatures {
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const bboxW = maxX - minX
    const bboxH = maxY - minY
    const diagonal = Math.sqrt(bboxW * bboxW + bboxH * bboxH) || 1

    // Aspect ratio: >1 wide, <1 tall, ~1 square
    const aspectRatio = bboxH > 0 ? bboxW / bboxH : 99

    // Bbox relative to canvas size
    const bboxWidthPct = bboxW / canvasWidth
    const bboxHeightPct = bboxH / canvasHeight

    // Total stroke length
    let totalLength = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    // Relative length: stroke complexity vs bounding box
    const relativeLength = totalLength / diagonal

    // Closure: distance from start to end / diagonal
    const first = points[0]
    const last = points[points.length - 1]
    const closeD = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
    const closure = 1 - Math.min(closeD / diagonal, 1)

    // Direction changes (smoothed)
    const { dirChangesX, dirChangesY } = countDirectionChanges(points)

    // Centroid (center of mass)
    const centroidX = (xs.reduce((a, b) => a + b, 0) / xs.length - minX) / (bboxW || 1)
    const centroidY = (ys.reduce((a, b) => a + b, 0) / ys.length - minY) / (bboxH || 1)

    return {
      aspectRatio,
      bboxWidthPct,
      bboxHeightPct,
      relativeLength,
      closure,
      dirChangesX,
      dirChangesY,
      centroidX,
      centroidY,
    }
  }
}

function countDirectionChanges(points: Point[]): { dirChangesX: number; dirChangesY: number } {
  // Smooth velocities with a 3-point window to reduce noise
  const smoothed: Array<{ vx: number; vy: number }> = []
  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      vx: points[i + 1].x - points[i - 1].x,
      vy: points[i + 1].y - points[i - 1].y,
    })
  }

  let dirChangesX = 0
  let dirChangesY = 0
  let prevSignX = 0
  let prevSignY = 0

  for (const { vx, vy } of smoothed) {
    const signX = Math.abs(vx) > 2 ? Math.sign(vx) : 0
    const signY = Math.abs(vy) > 2 ? Math.sign(vy) : 0

    if (signX !== 0 && prevSignX !== 0 && signX !== prevSignX) dirChangesX++
    if (signY !== 0 && prevSignY !== 0 && signY !== prevSignY) dirChangesY++

    if (signX !== 0) prevSignX = signX
    if (signY !== 0) prevSignY = signY
  }

  return { dirChangesX, dirChangesY }
}

function scoreLetters(f: StrokeFeatures): TopCandidate[] {
  const scores: Record<string, number> = Object.fromEntries(LETTERS.map(l => [l, 0.5]))

  const { aspectRatio: ar, closure, dirChangesX: dx, dirChangesY: dy,
    relativeLength: rl, centroidX: cx, centroidY: cy } = f

  // --- Narrow vertical shapes ---
  if (ar < 0.3) {
    scores['I'] += 5; scores['J'] += 2; scores['L'] += 1
  }
  if (ar < 0.5) {
    scores['I'] += 2; scores['J'] += 1
  }

  // --- Wide horizontal shapes ---
  if (ar > 2.5) {
    scores['Z'] += 3; scores['E'] += 2; scores['T'] += 2; scores['F'] += 2; scores['H'] += 1
  }

  // --- Square / roughly equal ---
  if (ar > 0.7 && ar < 1.4) {
    scores['O'] += 2; scores['C'] += 1; scores['D'] += 1; scores['U'] += 1; scores['V'] += 1
  }

  // --- Closed shapes (loop-like) ---
  if (closure > 0.7) {
    scores['O'] += 6; scores['Q'] += 4; scores['D'] += 3; scores['P'] += 2; scores['B'] += 2
    scores['R'] += 1; scores['A'] += 1; scores['G'] += 1
  }
  if (closure > 0.85) {
    scores['O'] += 4; scores['Q'] += 2
  }

  // --- Open shapes ---
  if (closure < 0.25) {
    scores['C'] += 3; scores['U'] += 2; scores['V'] += 2; scores['L'] += 2
    scores['J'] += 2; scores['S'] += 1; scores['Z'] += 1; scores['W'] += 1
  }

  // --- Direction changes X ---
  if (dx === 0) {
    scores['I'] += 3; scores['C'] += 2; scores['L'] += 2; scores['J'] += 2
    scores['U'] += 2; scores['O'] += 1
  }
  if (dx === 1) {
    scores['L'] += 3; scores['V'] += 3; scores['N'] += 2; scores['Z'] += 2
    scores['J'] += 1; scores['T'] += 1
  }
  if (dx === 2) {
    scores['S'] += 4; scores['Z'] += 3; scores['W'] += 2; scores['M'] += 2
    scores['N'] += 1; scores['K'] += 1
  }
  if (dx >= 3) {
    scores['S'] += 3; scores['M'] += 3; scores['W'] += 3; scores['B'] += 2
    scores['E'] += 2; scores['F'] += 1
  }

  // --- Direction changes Y ---
  if (dy === 0) {
    scores['C'] += 2; scores['I'] += 2; scores['L'] += 1; scores['Z'] += 2
    scores['T'] += 1
  }
  if (dy === 1) {
    scores['U'] += 4; scores['V'] += 3; scores['J'] += 2; scores['L'] += 1
    scores['A'] += 1; scores['N'] += 1
  }
  if (dy === 2) {
    scores['S'] += 3; scores['Z'] += 2; scores['N'] += 2; scores['B'] += 1
    scores['A'] += 2; scores['R'] += 1
  }
  if (dy >= 3) {
    scores['M'] += 3; scores['W'] += 3; scores['B'] += 2; scores['E'] += 2
    scores['F'] += 1; scores['S'] += 2
  }

  // --- Stroke complexity ---
  if (rl < 1.5) {
    scores['I'] += 3; scores['L'] += 2; scores['C'] += 1
  }
  if (rl > 2.5 && rl < 4.0) {
    scores['O'] += 2; scores['C'] += 1; scores['S'] += 1; scores['U'] += 1
  }
  if (rl > 4.0) {
    scores['M'] += 2; scores['W'] += 2; scores['B'] += 1; scores['E'] += 1
  }

  // --- Centroid position ---
  if (cy < 0.4) {
    scores['T'] += 2; scores['F'] += 2; scores['E'] += 1
  }
  if (cy > 0.6) {
    scores['L'] += 2; scores['J'] += 2; scores['U'] += 1
  }
  if (cx < 0.4) {
    scores['J'] += 1; scores['L'] += 1
  }
  if (cx > 0.6) {
    scores['J'] -= 1; scores['L'] -= 1; scores['R'] += 1; scores['P'] += 1
  }

  // Normalize to [0,1] range
  const values = Object.values(scores)
  const maxScore = Math.max(...values)
  const minScore = Math.min(...values)
  const range = maxScore - minScore || 1

  const normalized: TopCandidate[] = LETTERS.map(letter => ({
    letter,
    score: (scores[letter] - minScore) / range,
  }))
  normalized.sort((a, b) => b.score - a.score)

  // Apply softmax-like spreading to top scores for better display
  const top5 = normalized.slice(0, 5)
  const topSum = top5.reduce((s, c) => s + c.score, 0) || 1
  return top5.map(c => ({ ...c, score: c.score / topSum }))
}

function noStrokeResult(ms: number): RecognitionResult {
  return {
    letter: '?',
    confidence: 0,
    engine: 'stroke-analysis',
    topCandidates: [],
    processingMs: ms,
  }
}
