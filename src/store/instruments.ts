import type { StoreState } from './types'
import type { SoundfontBank } from '../audio/soundfonts'

export const SOUND_WINDOWS = [
  { id: 'fluidR3Vst', bank: 'FluidR3_GM', title: 'FluidR3 VST', label: 'FLUIDR3' },
  { id: 'musyngKiteVst', bank: 'MusyngKite', title: 'MusyngKite VST', label: 'MUSYNGKITE' },
] as const

export function setPatternSound(state: StoreState, preset: string) {
  state.setState({
    pianoPreset: preset,
    patterns: state.patterns.map((pattern) => ({
      ...pattern,
      soundPreset: pattern.id === state.currentPattern ? preset : pattern.soundPreset ?? state.pianoPreset,
    })),
  })
}

export function openSoundBrowser(state: StoreState, bank: SoundfontBank, channelId?: number) {
  const window = SOUND_WINDOWS.find((item) => item.bank === bank)!
  const zIndex = state.maxZIndex + 1
  state.setState({
    soundBrowserTargets: { ...state.soundBrowserTargets, [bank]: channelId === undefined ? { kind: 'pattern' } : { kind: 'channel', channelId } },
    windowVisibility: { ...state.windowVisibility, [window.id]: true },
    windowLayout: { ...state.windowLayout, [window.id]: { ...state.windowLayout[window.id], zIndex } },
    maxZIndex: zIndex,
  })
}
