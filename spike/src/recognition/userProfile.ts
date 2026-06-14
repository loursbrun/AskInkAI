import { strokesToEMNISTTensor } from './preprocessor'
import { extractImageFeatures, type ImageFeatures } from './imageFeatures'
import type { Point } from '../types'

const STORAGE_KEY = 'askink_user_profile_v1'

export interface ProfileSample {
  features: ImageFeatures
  addedAt: number
}

export interface UserProfile {
  version: 1
  createdAt: number
  updatedAt: number
  alphabet: Partial<Record<string, ProfileSample[]>>
}

export const TARGET_SAMPLES = 5   // target per letter
export const MIN_SAMPLES = 3      // minimum to consider a letter "trained"
export const MAX_SAMPLES = 10     // cap per letter

export function createEmptyProfile(): UserProfile {
  return {
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    alphabet: {},
  }
}

export function addSample(
  profile: UserProfile,
  letter: string,
  strokes: Point[][],
): UserProfile {
  const tensor = strokesToEMNISTTensor(strokes)
  const features = extractImageFeatures(tensor)
  const existing = profile.alphabet[letter] ?? []

  if (existing.length >= MAX_SAMPLES) return profile  // already capped

  return {
    ...profile,
    updatedAt: Date.now(),
    alphabet: {
      ...profile.alphabet,
      [letter]: [...existing, { features, addedAt: Date.now() }],
    },
  }
}

export function removeLastSample(profile: UserProfile, letter: string): UserProfile {
  const existing = profile.alphabet[letter] ?? []
  if (existing.length === 0) return profile
  return {
    ...profile,
    updatedAt: Date.now(),
    alphabet: {
      ...profile.alphabet,
      [letter]: existing.slice(0, -1),
    },
  }
}

export function clearLetter(profile: UserProfile, letter: string): UserProfile {
  const next = { ...profile.alphabet }
  delete next[letter]
  return { ...profile, updatedAt: Date.now(), alphabet: next }
}

export function sampleCount(profile: UserProfile, letter: string): number {
  return profile.alphabet[letter]?.length ?? 0
}

/** Letters with at least MIN_SAMPLES examples */
export function trainedLetters(profile: UserProfile): string[] {
  return Object.entries(profile.alphabet)
    .filter(([, samples]) => (samples?.length ?? 0) >= MIN_SAMPLES)
    .map(([letter]) => letter)
    .sort()
}

/** True when all 26 letters have at least MIN_SAMPLES */
export function isComplete(profile: UserProfile): boolean {
  for (let i = 0; i < 26; i++) {
    if (sampleCount(profile, String.fromCharCode(65 + i)) < MIN_SAMPLES) return false
  }
  return true
}

export function totalSamples(profile: UserProfile): number {
  return Object.values(profile.alphabet).reduce((acc, s) => acc + (s?.length ?? 0), 0)
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function deleteProfile(): void {
  localStorage.removeItem(STORAGE_KEY)
}
