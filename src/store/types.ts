export interface Channel {
  id: number
  name: string
  steps: number[]
  color: string
  vol: number
  pan: number
  mute: boolean
  solo: boolean
  sendA: number
  sendB: number
  preset: string
}

export interface NoteEvent {
  offsetSteps: number
  durationSteps: number
  velocity: number
}

export interface Pattern {
  id: number
  name: string
  notes: string[]
  noteEvents?: Record<string, NoteEvent[]>
  lengthSteps?: number
  midiChannel?: number
  midiProgram?: number
}

export type ReturnKind = 'reverb' | 'delay'

export interface ReturnTrack {
  id: number
  name: string
  kind: ReturnKind
  vol: number
  pan: number
  mute: boolean
  color: string
}

export interface Clip {
  id: number
  track: number
  startBar: number
  lengthBars: number
  patternId: number
}

export interface AudioClip {
  id: number
  name: string
  assetId: string
  track: number
  startBar: number
  lengthBars: number
  duration: number
  color: string
}

export interface WindowLayout {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export interface AppState {
  isPlaying: boolean
  playStart: number
  bpm: number
  swing: number
  currentPattern: number
  patternMode: boolean
  metronome: boolean
  patterns: Pattern[]
  channels: Channel[]
  pianoPreset: string
  masterVolume: number
  returnTracks: ReturnTrack[]
  maxZIndex: number
  windowLayout: Record<string, WindowLayout>
  playlistClips: Clip[]
  playlistLength: number
  windowVisibility: Record<string, boolean>
  audioClips: AudioClip[]
  currentStep: number
  playheadRow: number
}

export type PartialState = Partial<AppState> | ((state: StoreState) => Partial<AppState>)

export interface StoreState extends AppState {
  listeners: Set<(state: StoreState) => void>
  setState: (partial: PartialState) => void
}

export interface PersistedProject extends Partial<AppState> {
  version?: number
  pianoNotes?: string[]
}
