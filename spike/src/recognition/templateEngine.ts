import { extractImageFeatures, type ImageFeatures } from './imageFeatures'

const TARGET_SIZE = 28
const INNER_SIZE = 20
const PAD = (TARGET_SIZE - INNER_SIZE) / 2
const HIGH_RES = 280  // render at 10× then downsample for quality

/**
 * Generates reference feature vectors for all 26 uppercase letters
 * by rendering them with the browser's canvas text API and applying
 * the same bounding-box normalization as strokesToEMNISTTensor.
 */
export function buildTemplates(): Map<string, ImageFeatures> {
  const result = new Map<string, ImageFeatures>()
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    const tensor = renderLetterTemplate(letter)
    result.set(letter, extractImageFeatures(tensor))
  }
  return result
}

function renderLetterTemplate(letter: string): Float32Array {
  // Step 1 – render at high resolution to avoid font aliasing artifacts
  const big = document.createElement('canvas')
  big.width = HIGH_RES
  big.height = HIGH_RES
  const bigCtx = big.getContext('2d')!

  bigCtx.fillStyle = '#000'
  bigCtx.fillRect(0, 0, HIGH_RES, HIGH_RES)

  // Use a bold sans-serif font – closest to how users draw uppercase letters
  const fontSize = Math.floor(HIGH_RES * 0.72)
  bigCtx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`
  bigCtx.fillStyle = '#fff'
  bigCtx.textAlign = 'center'
  bigCtx.textBaseline = 'middle'
  bigCtx.fillText(letter, HIGH_RES / 2, HIGH_RES / 2)

  // Step 2 – find tight bounding box of non-zero pixels
  const bigData = bigCtx.getImageData(0, 0, HIGH_RES, HIGH_RES).data
  let minX = HIGH_RES, maxX = 0, minY = HIGH_RES, maxY = 0
  for (let y = 0; y < HIGH_RES; y++) {
    for (let x = 0; x < HIGH_RES; x++) {
      if (bigData[(y * HIGH_RES + x) * 4] > 30) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (minX > maxX || minY > maxY) return new Float32Array(TARGET_SIZE * TARGET_SIZE)

  // Step 3 – scale bounding box to INNER_SIZE × INNER_SIZE with padding,
  // matching exactly the transform used in strokesToEMNISTTensor
  const bboxW = maxX - minX + 1
  const bboxH = maxY - minY + 1
  const scale = INNER_SIZE / Math.max(bboxW, bboxH)
  const scaledW = bboxW * scale
  const scaledH = bboxH * scale
  const destX = PAD + (INNER_SIZE - scaledW) / 2
  const destY = PAD + (INNER_SIZE - scaledH) / 2

  const small = document.createElement('canvas')
  small.width = TARGET_SIZE
  small.height = TARGET_SIZE
  const smallCtx = small.getContext('2d')!
  smallCtx.fillStyle = '#000'
  smallCtx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE)
  smallCtx.drawImage(big, minX, minY, bboxW, bboxH, destX, destY, scaledW, scaledH)

  const data = smallCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE).data
  const tensor = new Float32Array(TARGET_SIZE * TARGET_SIZE)
  for (let i = 0; i < TARGET_SIZE * TARGET_SIZE; i++) {
    tensor[i] = data[i * 4] / 255
  }
  return tensor
}
