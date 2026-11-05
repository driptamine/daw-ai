import { useCallback } from 'react'
import { loadPersisted, schedulePersist } from './persist'
import type {
  AppState,
  Channel,
  Clip,
  PartialState,
  Pattern,
  PersistedProject,
  ReturnTrack,
  StoreState,
} from './types'

const defaultChannelList: Channel[] = [
  { id: 1, name: 'Kick', steps: Array<number>(16).fill(0), color: '#4ade80', vol: 100, pan: 64, mute: false, solo: false, sendA: 0, sendB: 0, preset: 'kick' },
  { id: 2, name: 'Snare', steps: Array<number>(16).fill(0), color: '#60a5fa', vol: 90, pan: 64, mute: false, solo: false, sendA: 22, sendB: 8, preset: 'snare' },
  { id: 3, name: 'HiHat Closed', steps: Array<number>(16).fill(0), color: '#facc15', vol: 85, pan: 64, mute: false, solo: false, sendA: 8, sendB: 0, preset: 'hihatClosed' },
  { id: 4, name: 'HiHat Open', steps: Array<number>(16).fill(0), color: '#f87171', vol: 80, pan: 64, mute: false, solo: false, sendA: 16, sendB: 12, preset: 'hihatOpen' },
  { id: 5, name: 'Clap', steps: Array<number>(16).fill(0), color: '#a78bfa', vol: 85, pan: 64, mute: false, solo: false, sendA: 28, sendB: 14, preset: 'clap' },
  { id: 6, name: 'Bass', steps: Array<number>(16).fill(0), color: '#fb923c', vol: 95, pan: 64, mute: false, solo: false, sendA: 0, sendB: 0, preset: 'bass' },
  { id: 7, name: 'Synth', steps: Array<number>(16).fill(0), color: '#2dd4bf', vol: 75, pan: 64, mute: false, solo: false, sendA: 24, sendB: 20, preset: 'synth' },
  { id: 8, name: 'FX', steps: Array<number>(16).fill(0), color: '#e879f9', vol: 70, pan: 64, mute: false, solo: false, sendA: 30, sendB: 32, preset: 'fx' },
]

const defaultReturnTracks: ReturnTrack[] = [
  { id: 1, name: 'A Reverb', kind: 'reverb', vol: 68, pan: 64, mute: false, color: '#60a5fa' },
  { id: 2, name: 'B Delay', kind: 'delay', vol: 58, pan: 64, mute: false, color: '#a78bfa' },
]

const defaultStore: AppState = {
  isPlaying: false,
  playStart: 0,
  bpm: 130,
  swing: 0,
  currentPattern: 1,
  patternMode: true,
  metronome: false,
  patterns: [
    { id: 1, name: 'Pattern 1', notes: [] },
    { id: 2, name: 'Pattern 2', notes: [] },
    { id: 3, name: 'Pattern 3', notes: [] },
  ],
  channels: defaultChannelList,
  pianoPreset: 'synth',
  masterVolume: 0.85,
  returnTracks: defaultReturnTracks,
  maxZIndex: 10,
  windowLayout: {
    playlist: { x: 6, y: 6, width: 986, height: 540, zIndex: 1 },
    channelRack: { x: 6, y: 282, width: 380, height: 266, zIndex: 3 },
    pianoRoll: { x: 392, y: 282, width: 600, height: 266, zIndex: 4 },
    mixer: { x: 6, y: 6, width: 986, height: 640, zIndex: 2 },
  },
  playlistClips: [
    { id: 1, track: 0, startBar: 0, lengthBars: 4, patternId: 1 },
    { id: 2, track: 1, startBar: 0, lengthBars: 4, patternId: 2 },
    { id: 3, track: 2, startBar: 4, lengthBars: 2, patternId: 3 },
    { id: 4, track: 0, startBar: 8, lengthBars: 4, patternId: 1 },
  ],
  playlistLength: 64,
  windowVisibility: {
    channelRack: true,
    pianoRoll: true,
    playlist: true,
    mixer: true,
  },
  audioClips: [],
  currentStep: -1,
  playheadRow: -1,
}

function normalizeChannels(channels: unknown): Channel[] {
  if (!Array.isArray(channels) || channels.length === 0) return defaultChannelList
  return (channels as Partial<Channel>[]).map((ch, i) => {
    const base = defaultChannelList[i % defaultChannelList.length]
    return {
      ...base,
      ...ch,
      steps: Array.isArray(ch.steps) && ch.steps.length ? ch.steps : Array<number>(16).fill(0),
      preset: ch.preset || base.preset,
    }
  })
}

function normalizeReturnTracks(tracks: unknown): ReturnTrack[] {
  if (!Array.isArray(tracks) || tracks.length === 0) return defaultReturnTracks
  return (tracks as Partial<ReturnTrack>[]).map((track, i) => {
    const base = defaultReturnTracks[i % defaultReturnTracks.length]
    return {
      ...base,
      ...track,
      kind: track.kind === 'delay' ? 'delay' : track.kind === 'reverb' ? 'reverb' : base.kind,
    }
  })
}

function normalizePatterns(patterns: unknown, legacyNotes: unknown): Pattern[] {
  const list = (Array.isArray(patterns) && patterns.length ? patterns : defaultStore.patterns) as Partial<Pattern>[]
  const normalized: Pattern[] = list.map((p, i) => ({
    ...p,
    id: p.id ?? i + 1,
    name: p.name || `Pattern ${i + 1}`,
    notes: Array.isArray(p.notes) ? p.notes : [],
  }))
  const legacy = Array.isArray(legacyNotes) ? (legacyNotes as string[]) : []
  if (legacy.length && normalized[0] && normalized[0].notes.length === 0) {
    normalized[0].notes = legacy
  }
  return normalized
}

function normalizeClips(clips: unknown, patterns: Pattern[]): Clip[] {
  if (!Array.isArray(clips)) return defaultStore.playlistClips
  const fallbackId = (patterns[0] && patterns[0].id) || 1
  return (clips as Partial<Clip>[]).map((c, i) => ({
    id: c.id ?? Date.now() + i,
    track: c.track ?? 0,
    startBar: c.startBar ?? 0,
    lengthBars: c.lengthBars ?? 2,
    patternId: c.patternId ?? fallbackId,
  }))
}

const persisted = loadPersisted() as PersistedProject | null
const normalizedPatterns = normalizePatterns(persisted && persisted.patterns, persisted && persisted.pianoNotes)
const normalizedCurrent = normalizedPatterns.some((p) => p.id === (persisted && persisted.currentPattern))
  ? (persisted as PersistedProject).currentPattern as number
  : normalizedPatterns[0].id

let store: StoreState = {
  ...defaultStore,
  ...(persisted || {}),
  patterns: normalizedPatterns,
  currentPattern: normalizedCurrent,
  channels: normalizeChannels(persisted ? persisted.channels : null),
  returnTracks: normalizeReturnTracks(persisted ? persisted.returnTracks : null),
  playlistClips: normalizeClips(persisted && persisted.playlistClips, normalizedPatterns),
  audioClips: Array.isArray(persisted?.audioClips) ? persisted.audioClips as AppState['audioClips'] : [],
  listeners: new Set(),
  currentStep: -1,
  playheadRow: -1,
  isPlaying: false,
  setState: () => {},
}

const HISTORY_LIMIT = 100
const COALESCE_MS = 500
const TRANSIENT_KEYS = new Set<string>(['isPlaying', 'currentStep', 'playheadRow'])

type HistorySnapshot = Omit<AppState, 'isPlaying' | 'currentStep' | 'playheadRow'>

interface HistoryEntry {
  snapshot: HistorySnapshot
  keys: Set<string>
}

const past: HistoryEntry[] = []
const future: HistoryEntry[] = []
let lastRecordTime = 0
let lastRecordKeys = new Set<string>()

function snapshot(state: StoreState): HistorySnapshot {
  return {
    playStart: state.playStart,
    bpm: state.bpm,
    swing: state.swing,
    currentPattern: state.currentPattern,
    patternMode: state.patternMode,
    metronome: state.metronome,
    patterns: state.patterns,
    channels: state.channels,
    pianoPreset: state.pianoPreset,
    masterVolume: state.masterVolume,
    returnTracks: state.returnTracks,
    maxZIndex: state.maxZIndex,
    windowLayout: state.windowLayout,
    playlistClips: state.playlistClips,
    playlistLength: state.playlistLength,
    windowVisibility: state.windowVisibility,
    audioClips: state.audioClips,
  }
}

function hasSameKeys(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const key of a) {
    if (!b.has(key)) return false
  }
  return true
}

function pushPast(snap: HistorySnapshot, keys: Set<string>): void {
  const now = Date.now()
  if (past.length && hasSameKeys(keys, lastRecordKeys) && now - lastRecordTime < COALESCE_MS) {
    lastRecordTime = now
    future.length = 0
    return
  }
  past.push({ snapshot: snap, keys })
  if (past.length > HISTORY_LIMIT) past.shift()
  lastRecordTime = now
  lastRecordKeys = keys
  future.length = 0
}

function restore(snap: HistorySnapshot): void {
  store = { ...store, ...snap }
  schedulePersist(store)
  store.listeners.forEach((fn) => fn(store))
}

function resetCoalesce(): void {
  lastRecordTime = 0
  lastRecordKeys = new Set()
}

export function undo(): void {
  const entry = past.pop()
  if (!entry) return
  future.push({ snapshot: snapshot(store), keys: new Set() })
  if (future.length > HISTORY_LIMIT) future.shift()
  resetCoalesce()
  restore(entry.snapshot)
}

export function redo(): void {
  const entry = future.pop()
  if (!entry) return
  past.push({ snapshot: snapshot(store), keys: new Set() })
  if (past.length > HISTORY_LIMIT) past.shift()
  resetCoalesce()
  restore(entry.snapshot)
}

function setState(partial: PartialState): void {
  const next = typeof partial === 'function' ? partial(store) : partial
  const changedKeys = Object.keys(next).filter((key) => !TRANSIENT_KEYS.has(key))
  if (changedKeys.length) pushPast(snapshot(store), new Set(changedKeys))
  store = { ...store, ...next }
  schedulePersist(store)
  store.listeners.forEach((fn) => fn(store))
}

store.setState = setState

export function useStore() {
  const subscribe = useCallback((listener: (state: StoreState) => void) => {
    store.listeners.add(listener)
    return () => {
      store.listeners.delete(listener)
    }
  }, [])

  const getState = useCallback(() => store, [])

  return { getState, setState, subscribe }
}

export const defaultChannels = (): Channel[] => store.channels
