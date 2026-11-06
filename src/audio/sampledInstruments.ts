import { CacheStorage, Soundfont } from 'smplr'
import { SAMPLED_PRESET_MAP } from './soundfonts'

export interface SoundStatus {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  loaded: number
  total: number
}

const IDLE: SoundStatus = { phase: 'idle', loaded: 0, total: 0 }
const READY: SoundStatus = { phase: 'ready', loaded: 0, total: 0 }
const statuses = new Map<string, SoundStatus>()
const listeners = new Set<() => void>()
type InstrumentEntry = { presetId: string; instrument: Soundfont; ready: Promise<void>; loaded: boolean; lastUsed: number; evict: () => void }
const destinations = new WeakMap<AudioNode, Map<string, InstrumentEntry>>()
const instruments = new Set<InstrumentEntry>()
let storage: ReturnType<typeof CacheStorage> | undefined
let stopVersion = 0
let previewVersion = 0
let activePresets = new Set<string>()

function trimIdleInstruments(keep?: InstrumentEntry) {
  const idle = [...instruments].filter((entry) => entry.loaded && entry !== keep && !activePresets.has(entry.presetId))
    .sort((a, b) => a.lastUsed - b.lastUsed)
  while (instruments.size > 8 && idle.length) idle.shift()?.evict()
}

export function pinSampledInstruments(ids: Iterable<string>) {
  activePresets = new Set(ids)
  trimIdleInstruments()
}

function setStatus(id: string, status: SoundStatus) {
  statuses.set(id, status)
  listeners.forEach((listener) => listener())
}

export function subscribeSoundStatus(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getSoundStatus(id: string): SoundStatus {
  return statuses.get(id) ?? (SAMPLED_PRESET_MAP.has(id) ? IDLE : READY)
}

function getEntry(id: string, context: AudioContext, destination: AudioNode): InstrumentEntry | undefined {
  const preset = SAMPLED_PRESET_MAP.get(id)
  if (!preset) return
  let cache = destinations.get(destination)
  if (!cache) { cache = new Map(); destinations.set(destination, cache) }
  const existing = cache.get(id)
  if (existing) { existing.lastUsed = performance.now(); return existing }
  storage ??= CacheStorage('dawdex-instrument-samples-v1')
  setStatus(id, { phase: 'loading', loaded: 0, total: 0 })
  const instrument = Soundfont(context, {
    instrument: preset.instrument,
    kit: preset.bank,
    storage,
    destination,
    onLoadProgress: ({ loaded, total }) => setStatus(id, { phase: 'loading', loaded, total }),
  })
  const entry: InstrumentEntry = {
    presetId: id, instrument, ready: Promise.resolve(), loaded: false, lastUsed: performance.now(),
    evict: () => { cache.delete(id); instruments.delete(entry); instrument.dispose() },
  }
  entry.ready = instrument.ready.then(() => {
    if (!instrument.loadProgress.total) throw new Error('No instrument samples were loaded')
    entry.loaded = true
    setStatus(id, { phase: 'ready', ...instrument.loadProgress })
    trimIdleInstruments(entry)
  }).catch((error: unknown) => {
    cache.delete(id)
    instruments.delete(entry)
    instrument.dispose()
    setStatus(id, { phase: 'error', loaded: 0, total: 0 })
    throw error
  })
  cache.set(id, entry)
  instruments.add(entry)
  return entry
}

export async function prepareSampledInstrument(id: string, context: AudioContext, destination: AudioNode) {
  await getEntry(id, context, destination)?.ready
}

export function cancelSampledPreview() { previewVersion += 1 }

export function playSampledInstrument(id: string, context: AudioContext, destination: AudioNode, midi: number, duration: number, velocity: number, when?: number) {
  const entry = getEntry(id, context, destination)
  if (!entry) return
  const stopped = stopVersion
  const preview = previewVersion
  const play = () => entry.instrument.start({ note: midi, duration, velocity: Math.round(velocity * 127), time: Math.max(when ?? context.currentTime + 0.001, context.currentTime) })
  if (entry.loaded) { play(); return }
  void entry.ready.then(() => {
    if (stopped !== stopVersion || (when === undefined && preview !== previewVersion)) return
    if (when !== undefined && when < context.currentTime - 0.03) return
    play()
  }).catch(() => { /* The picker displays loading errors and allows retrying. */ })
}

export function stopSampledInstruments() {
  stopVersion += 1
  previewVersion += 1
  activePresets.clear()
  instruments.forEach(({ instrument }) => {
    instrument.scheduler.stop()
    instrument.stop()
  })
}
