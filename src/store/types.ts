export interface Channel {
  id: number
  name: string
  steps: number[]
  color: string
  vol: number
  pan: number
  mute: boolean
  preset: string
}

export interface Pattern {
  id: number
  name: string
  notes: string[]
}

export interface MixerChannel {
  id: number
  name: string
  vol: number
  pan: number
  mute: boolean
  solo: boolean
  color: string
}

export interface Clip {
  id: number
  track: number
  startBar: number
  lengthBars: number
  patternId: number
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
  mixerChannels: MixerChannel[]
  maxZIndex: number
  windowLayout: Record<string, WindowLayout>
  playlistClips: Clip[]
  playlistLength: number
  windowVisibility: Record<string, boolean>
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
