import { importMidi } from '../audio/midi'
import type { StoreState } from './types'

export async function importMidiIntoProject(file: File, getState: () => StoreState, openEditor = false) {
  const data = await file.arrayBuffer()
  const current = getState()
  const firstId = Math.max(0, ...current.patterns.map((pattern) => pattern.id)) + 1
  const result = importMidi(data, file.name, firstId, current.bpm)
  const zIndex = current.maxZIndex + 1
  current.setState({
    patterns: [...current.patterns, ...result.patterns],
    currentPattern: result.patterns[0].id,
    bpm: result.bpm,
    patternMode: true,
    isPlaying: false,
    playStart: 0,
    currentStep: -1,
    ...(openEditor ? {
      windowVisibility: { ...current.windowVisibility, pianoRoll: true },
      windowLayout: { ...current.windowLayout, pianoRoll: { ...current.windowLayout.pianoRoll, zIndex } },
      maxZIndex: zIndex,
    } : {}),
  })
  return result
}
