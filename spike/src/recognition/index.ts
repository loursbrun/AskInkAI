import type { Point, RecognitionResult, EngineStatus } from '../types'
import type { UserProfile } from './userProfile'
import { createEmptyProfile } from './userProfile'
import { DBPersonalizedRecognizer } from './DBPersonalizedRecognizer'
import { EMNISTRecognizer } from './EMNISTRecognizer'
import { ImageRecognizer } from './ImageRecognizer'
import { StrokeAnalyzer } from './StrokeAnalyzer'
import { strokesToEMNISTTensor } from './preprocessor'

export type { EngineStatus }

export class RecognitionEngine {
  private personal = new DBPersonalizedRecognizer()
  private emnist = new EMNISTRecognizer()
  private imageNN = new ImageRecognizer()
  private analyzer = new StrokeAnalyzer()
  private status: EngineStatus = 'loading'

  async initialize(): Promise<EngineStatus> {
    this.status = 'loading'

    // Image-NN templates are built synchronously (no download)
    this.imageNN.initialize()

    // Attempt to load optional EMNIST model
    const emnistLoaded = await this.emnist.load('/model/model.json')

    // Status reflects the generic fallback tier;
    // setProfile() upgrades it to 'personal'
    this.status = emnistLoaded ? 'ready' : 'fallback'
    return this.status
  }

  /** Load a user profile. Immediately upgrades recognition to 'personal' tier. */
  setProfile(profile: UserProfile): void {
    this.personal.setProfile(profile)
    if (this.personal.isReady()) {
      this.status = 'personal'
    }
  }

  clearProfile(): void {
    this.personal.setProfile(createEmptyProfile())
    // Revert to best available generic engine
    this.status = this.emnist.isLoaded() ? 'ready' : 'fallback'
  }

  getStatus(): EngineStatus {
    return this.status
  }

  async recognize(
    strokes: Point[][],
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<RecognitionResult> {
    // Tier 0 – Personalized (best accuracy for this specific user)
    if (this.personal.isReady()) {
      try {
        return this.personal.recognize(strokes)
      } catch { /* fall through */ }
    }

    // Tier 1 – EMNIST neural network (requires model file)
    if (this.emnist.isLoaded()) {
      try {
        const tensor = strokesToEMNISTTensor(strokes)
        return await this.emnist.recognize(tensor)
      } catch { /* fall through */ }
    }

    // Tier 2 – Image projection nearest-neighbour
    if (this.imageNN.isReady()) {
      try {
        return this.imageNN.recognize(strokes)
      } catch { /* fall through */ }
    }

    // Tier 3 – Geometric stroke heuristic (last resort)
    return this.analyzer.analyze(strokes, canvasWidth, canvasHeight)
  }

  dispose() {
    this.emnist.dispose()
  }
}
