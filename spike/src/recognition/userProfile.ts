import type { Point } from '../types'

const STORAGE_KEY = 'askink_user_profile_v2'

// Raw stroke points (x, y only — timestamps not needed for path recognition).
export interface ProfileSample {
  strokes: { x: number; y: number }[][]
  addedAt: number
}

export interface UserProfile {
  version: 2
  createdAt: number
  updatedAt: number
  alphabet: Partial<Record<string, ProfileSample[]>>
}

export const TARGET_SAMPLES = 5
export const MIN_SAMPLES = 3
export const MAX_SAMPLES = 10

export function createEmptyProfile(): UserProfile {
  return {
    version: 2,
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
  const existing = profile.alphabet[letter] ?? []
  if (existing.length >= MAX_SAMPLES) return profile

  // Store raw (x, y) points — no bitmap conversion needed for DBPathRecognizer
  const rawStrokes = strokes.map(s => s.map(p => ({ x: p.x, y: p.y })))

  return {
    ...profile,
    updatedAt: Date.now(),
    alphabet: {
      ...profile.alphabet,
      [letter]: [...existing, { strokes: rawStrokes, addedAt: Date.now() }],
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

export function trainedLetters(profile: UserProfile): string[] {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(
    l => (profile.alphabet[l]?.length ?? 0) >= MIN_SAMPLES
  )
}

export function trainedDigits(profile: UserProfile): string[] {
  return '0123456789'.split('').filter(
    d => (profile.alphabet[d]?.length ?? 0) >= MIN_SAMPLES
  )
}

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
    // localStorage full or unavailable
  }
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    if (parsed.version !== 2) return null
    return parsed
  } catch {
    return null
  }
}

export function deleteProfile(): void {
  localStorage.removeItem(STORAGE_KEY)
  // Also clean up any v1 profile that might exist
  localStorage.removeItem('askink_user_profile_v1')
}
