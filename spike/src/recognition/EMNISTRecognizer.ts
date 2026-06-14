import type { RecognitionResult, TopCandidate } from '../types'

// Model output: 36 classes — indices 0-9 digits, 10-35 letters A-Z.
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const LETTER_OFFSET = 10
const MODEL_SIZE = 28

let tf: typeof import('@tensorflow/tfjs') | null = null

async function loadTF() {
  if (tf) return tf
  tf = await import('@tensorflow/tfjs')
  return tf
}

export class EMNISTRecognizer {
  private model: import('@tensorflow/tfjs').LayersModel | null = null

  async load(modelPath = '/model/model.json'): Promise<boolean> {
    try {
      const lib = await loadTF()
      this.model = await lib.loadLayersModel(modelPath)
      const dummy = lib.zeros([1, MODEL_SIZE, MODEL_SIZE, 1])
      const warmup = this.model.predict(dummy) as import('@tensorflow/tfjs').Tensor
      warmup.dispose()
      dummy.dispose()
      return true
    } catch {
      this.model = null
      return false
    }
  }

  async recognize(tensor: Float32Array): Promise<RecognitionResult> {
    if (!this.model || !tf) throw new Error('Model not loaded')

    const t0 = performance.now()
    const inputTensor = tf.tensor4d(tensor, [1, MODEL_SIZE, MODEL_SIZE, 1])
    const prediction = this.model.predict(inputTensor) as import('@tensorflow/tfjs').Tensor
    const probabilities = await prediction.data() as Float32Array
    inputTensor.dispose()
    prediction.dispose()

    const topCandidates = buildLetterCandidates(probabilities)
    const best = topCandidates[0]
    const letterSum = Array.from(probabilities).slice(LETTER_OFFSET).reduce((s, v) => s + v, 0)
    const confidence = letterSum > 0 ? Math.min(best.score / letterSum, 1) : best.score

    return {
      letter: best.letter,
      confidence,
      engine: 'tfjs-emnist',
      topCandidates,
      processingMs: performance.now() - t0,
    }
  }

  isLoaded(): boolean { return this.model !== null }

  dispose() {
    this.model?.dispose()
    this.model = null
  }
}

function buildLetterCandidates(probabilities: Float32Array): TopCandidate[] {
  const letterProbs = Array.from(probabilities).slice(LETTER_OFFSET, LETTER_OFFSET + 26)
  const candidates = letterProbs.map((score, i) => ({ letter: LETTERS[i], score }))
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, 5)
}
