import type { Point } from '../types'

const TARGET_SIZE = 28
const INNER_SIZE = 20
const PADDING = (TARGET_SIZE - INNER_SIZE) / 2

/**
 * Converts drawn strokes to a 28×28 Float32Array tensor (EMNIST-compatible).
 * White letter on black background, normalized [0,1].
 * Uses centroid-based centering for better alignment.
 */
export function strokesToEMNISTTensor(strokes: Point[][]): Float32Array {
  const offscreen = document.createElement('canvas')
  offscreen.width = TARGET_SIZE
  offscreen.height = TARGET_SIZE

  const ctx = offscreen.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE)

  if (strokes.length === 0 || strokes.every(s => s.length === 0)) {
    return new Float32Array(TARGET_SIZE * TARGET_SIZE)
  }

  const bbox = computeBoundingBox(strokes)
  if (bbox.w === 0 && bbox.h === 0) return new Float32Array(TARGET_SIZE * TARGET_SIZE)

  // Treat single-axis strokes (e.g. vertical I) gracefully
  const effectiveW = bbox.w || 1
  const effectiveH = bbox.h || 1

  const scale = INNER_SIZE / Math.max(effectiveW, effectiveH)
  const scaledW = effectiveW * scale
  const scaledH = effectiveH * scale

  // Centroid-based centering: distributes ink symmetrically
  const centroid = computeCentroid(strokes)
  const centroidInScaledX = (centroid.x - bbox.x) * scale
  const centroidInScaledY = (centroid.y - bbox.y) * scale
  const offsetX = PADDING + scaledW / 2 - centroidInScaledX
  const offsetY = PADDING + scaledH / 2 - centroidInScaledY

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.8  // slightly thicker for denser pixel coverage at 28px
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of strokes) {
    if (stroke.length === 0) continue
    ctx.beginPath()
    const first = toCanvasPt(stroke[0], bbox, scale, offsetX, offsetY)
    ctx.moveTo(first.x, first.y)

    if (stroke.length === 1) {
      // Single-point stroke: draw a small dot
      ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    } else {
      for (let i = 1; i < stroke.length; i++) {
        const pt = toCanvasPt(stroke[i], bbox, scale, offsetX, offsetY)
        ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()
    }
  }

  const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE)
  const tensor = new Float32Array(TARGET_SIZE * TARGET_SIZE)
  for (let i = 0; i < TARGET_SIZE * TARGET_SIZE; i++) {
    tensor[i] = imageData.data[i * 4] / 255
  }
  return tensor
}

function toCanvasPt(
  pt: Point,
  bbox: { x: number; y: number },
  scale: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  return {
    x: (pt.x - bbox.x) * scale + offsetX,
    y: (pt.y - bbox.y) * scale + offsetY,
  }
}

function computeBoundingBox(strokes: Point[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    for (const pt of stroke) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function computeCentroid(strokes: Point[][]): { x: number; y: number } {
  let sumX = 0, sumY = 0, count = 0
  for (const stroke of strokes) {
    for (const pt of stroke) {
      sumX += pt.x
      sumY += pt.y
      count++
    }
  }
  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 }
}

export function tensorToDebugCanvas(tensor: Float32Array): HTMLCanvasElement {
  const scale = 6
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE * scale
  canvas.height = TARGET_SIZE * scale
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < TARGET_SIZE; y++) {
    for (let x = 0; x < TARGET_SIZE; x++) {
      const v = Math.round(tensor[y * TARGET_SIZE + x] * 255)
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  return canvas
}
