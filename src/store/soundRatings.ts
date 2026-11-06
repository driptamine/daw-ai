import { PRESET_OPTIONS } from '../audio/presets'

const STORAGE_KEY = 'daw-ai:sound-ratings'

function loadRatings(): Record<string, number> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    return Object.fromEntries(Object.entries(saved).filter(([id, rating]) =>
      PRESET_OPTIONS.some((sound) => sound.id === id) && Number.isInteger(rating) && rating >= 1 && rating <= 5))
  } catch { return {} }
}

let ratings = loadRatings()
const listeners = new Set<() => void>()

export const getSoundRatings = () => ratings

export function subscribeSoundRatings(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setSoundRating(id: string, rating: number) {
  if (!PRESET_OPTIONS.some((sound) => sound.id === id) || !Number.isInteger(rating) || rating < 0 || rating > 5) return
  const next = { ...ratings }
  if (rating) next[id] = rating
  else delete next[id]
  ratings = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)) } catch { /* Ratings still work without browser storage. */ }
  listeners.forEach((listener) => listener())
}
