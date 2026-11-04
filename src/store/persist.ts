import type { AppState, StoreState } from './types'

const STORAGE_KEY = 'daw-ai:project:v1'

export const PERSIST_KEYS = [
  'bpm',
  'swing',
  'currentPattern',
  'patternMode',
  'metronome',
  'patterns',
  'channels',
  'returnTracks',
  'playlistClips',
  'playlistLength',
  'pianoPreset',
  'masterVolume',
] as const

type PersistKey = (typeof PERSIST_KEYS)[number]

export function loadPersisted(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export function schedulePersist(state: StoreState): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      const data: Record<string, unknown> = { version: 1 }
      for (const key of PERSIST_KEYS) data[key] = state[key]
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      return null
    }
    return null
  }, 300)
}

function serialize(state: StoreState): Record<string, unknown> {
  const data: Record<string, unknown> = { version: 1 }
  for (const key of PERSIST_KEYS) data[key] = state[key]
  return data
}

export function exportProject(state: StoreState): void {
  const data = serialize(state)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `daw-project-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function importProject(file: File): Promise<Partial<AppState>> {
  return file.text().then((text) => {
    const data = JSON.parse(text) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of PERSIST_KEYS) {
      if (data[key] !== undefined) patch[key] = data[key]
    }
    return patch as Partial<AppState>
  })
}

export type { PersistKey }
