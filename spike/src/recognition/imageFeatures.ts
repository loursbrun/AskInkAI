const SIZE = 28
const ZONE_COUNT = 4  // 4×4 grid → 16 zones
const ZONE_SIZE = SIZE / ZONE_COUNT  // 7px per zone

export interface ImageFeatures {
  projH: number[]   // 28 row sums, normalized to [0,1]
  projV: number[]   // 28 col sums, normalized to [0,1]
  zones: number[]   // 16 zone average intensities [0,1]
}

export function extractImageFeatures(tensor: Float32Array): ImageFeatures {
  const projH = new Array<number>(SIZE).fill(0)
  const projV = new Array<number>(SIZE).fill(0)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = tensor[y * SIZE + x]
      projH[y] += v
      projV[x] += v
    }
  }

  const maxH = Math.max(...projH) || 1
  const maxV = Math.max(...projV) || 1

  const zones: number[] = []
  for (let zy = 0; zy < ZONE_COUNT; zy++) {
    for (let zx = 0; zx < ZONE_COUNT; zx++) {
      const x0 = Math.round(zx * ZONE_SIZE)
      const x1 = Math.round((zx + 1) * ZONE_SIZE)
      const y0 = Math.round(zy * ZONE_SIZE)
      const y1 = Math.round((zy + 1) * ZONE_SIZE)
      let sum = 0, cnt = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += tensor[y * SIZE + x]
          cnt++
        }
      }
      zones.push(cnt > 0 ? sum / cnt : 0)
    }
  }

  return {
    projH: projH.map(v => v / maxH),
    projV: projV.map(v => v / maxV),
    zones,
  }
}

/**
 * Weighted Euclidean distance between two feature vectors.
 * Projections are weighted 2× (more discriminative than zones).
 */
export function featureDistance(a: ImageFeatures, b: ImageFeatures): number {
  let d = 0
  for (let i = 0; i < SIZE; i++) {
    d += 2 * (a.projH[i] - b.projH[i]) ** 2
    d += 2 * (a.projV[i] - b.projV[i]) ** 2
  }
  for (let i = 0; i < 16; i++) {
    d += (a.zones[i] - b.zones[i]) ** 2
  }
  return Math.sqrt(d)
}
