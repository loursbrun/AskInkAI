// TypeScript port of DBPathRecognizer (Swift) by Didier Brun
// https://github.com/didierbrun/DBPathRecognizer
//
// Algorithm: DTW-variant on direction-code sequences.
// Points → filtered delta-points → angle bins (0-7) → Levenshtein-DTW cost.

export interface PathPoint {
  x: number
  y: number
}

export interface PathModel<T = unknown> {
  directions: number[]
  data: T
  filter?: (cost: number, infos: PathInfos) => number
}

export interface PathInfos {
  deltaPoints: PathPoint[]
  boundingBox: { top: number; left: number; bottom: number; right: number }
  directions: number[]
}

export class DBPathRecognizer<T = unknown> {
  private readonly sliceCount: number
  private readonly deltaMove: number
  private readonly costMax: number
  private models: PathModel<T>[] = []

  constructor(sliceCount = 8, deltaMove = 8.0, costMax = 9999) {
    this.sliceCount = sliceCount
    this.deltaMove = deltaMove
    this.costMax = costMax
  }

  addModel(model: PathModel<T>): void {
    this.models.push(model)
  }

  clearModels(): void {
    this.models = []
  }

  /** Extract direction-code sequence from a stroke's points. */
  extractDirections(points: PathPoint[]): number[] {
    return this.directions(this.deltaPoints(points))
  }

  /**
   * Compare a pre-computed direction sequence against all registered models.
   * Returns every (model, cost) pair sorted by ascending cost.
   * Use this when directions are computed per-stroke and concatenated.
   */
  compareAll(dirs: number[]): Array<{ model: PathModel<T>; cost: number }> {
    if (dirs.length === 0) return []

    const results: Array<{ model: PathModel<T>; cost: number }> = []

    for (const model of this.models) {
      let cost = this.costLeven(model.directions, dirs)

      if (model.filter) {
        // Infos are omitted here since we don't have the original points; filter
        // is not used in the personalized path anyway.
        cost = model.filter(cost, { deltaPoints: [], boundingBox: { top: 0, left: 0, bottom: 0, right: 0 }, directions: dirs })
      }

      results.push({ model, cost })
    }

    return results.sort((a, b) => a.cost - b.cost)
  }

  /** Convenience: extract directions from raw points then compareAll. */
  recognize(points: PathPoint[]): { model: PathModel<T>; cost: number } | null {
    if (points.length < 2) return null
    const dirs = this.extractDirections(points)
    const all = this.compareAll(dirs)
    const best = all[0]
    return best && best.cost < this.costMax ? best : null
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private deltaPoints(points: PathPoint[]): PathPoint[] {
    if (points.length < 2) return points.slice()

    const threshold = this.deltaMove * this.deltaMove
    let current = points[0]
    const result: PathPoint[] = [current]

    for (const point of points) {
      const dx = point.x - current.x
      const dy = point.y - current.y
      if (dx * dx + dy * dy >= threshold) {
        current = point
        result.push(current)
      }
    }

    const last = points[points.length - 1]
    if (result[result.length - 1] !== last) result.push(last)

    return result
  }

  private directions(dpts: PathPoint[]): number[] {
    if (dpts.length < 2) return []

    const result: number[] = []
    const sliceAngle = (Math.PI * 2) / this.sliceCount

    for (let i = 0; i < dpts.length - 1; i++) {
      let angle = Math.atan2(dpts[i + 1].y - dpts[i].y, dpts[i + 1].x - dpts[i].x)
      if (angle < 0) angle += Math.PI * 2

      if (angle < sliceAngle / 2 || angle > Math.PI * 2 - sliceAngle) {
        result.push(0)
      } else {
        result.push(Math.round(angle / sliceAngle))
      }
    }

    return result
  }

  private directionCost(a: number, b: number): number {
    let dif = Math.abs(a - b)
    // Wrap-around: direction 0 and direction 7 are adjacent
    if (dif > this.sliceCount / 2) dif = this.sliceCount - dif
    return dif
  }

  // Levenshtein-DTW variant faithful to the Swift original.
  // Asymmetric: a=model, b=input. The last element of b is ignored
  // (intentional — the stroke lift-off can produce a spurious last direction).
  private costLeven(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 32767
    // With b.length === 1 the inner loops don't run → result is SAFE_MAX
    if (b.length < 2) return 32767

    const cols = a.length + 1
    const rows = b.length + 1
    const SAFE_MAX = 32767

    const td = new Array<number>(cols * rows).fill(0)
    const tw = new Array<number>(cols * rows).fill(0)

    const idx = (col: number, row: number) => cols * row + col

    // Build direction-cost table (note: y < b.length, last b element excluded)
    for (let x = 1; x <= a.length; x++) {
      for (let y = 1; y < b.length; y++) {
        td[idx(x, y)] = this.directionCost(a[x - 1], b[y - 1])
      }
    }

    // Boundary conditions: unreachable walls
    for (let i = 1; i <= b.length; i++) tw[idx(0, i)] = SAFE_MAX
    for (let i = 1; i <= a.length; i++) tw[idx(i, 0)] = SAFE_MAX
    tw[idx(0, 0)] = 0

    // DTW fill
    for (let x = 1; x <= a.length; x++) {
      for (let y = 1; y < b.length; y++) {
        const cost = td[idx(x, y)]
        const pa = tw[idx(x - 1, y)] + cost
        const pb = tw[idx(x, y - 1)] + cost
        const pc = tw[idx(x - 1, y - 1)] + cost
        tw[idx(x, y)] = Math.min(pa, pb, pc)
      }
    }

    return tw[idx(a.length, b.length - 1)]
  }
}
