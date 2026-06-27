import { useState, useCallback } from 'react'

let store = {
  isPlaying: false,
  bpm: 130,
  swing: 0,
  currentPattern: 1,
  patternMode: true,
  metronome: false,
  patterns: [
    { id: 1, name: 'Pattern 1', channels: [] },
    { id: 2, name: 'Pattern 2', channels: [] },
    { id: 3, name: 'Pattern 3', channels: [] },
  ],
  channels: [
    { id: 1, name: 'Kick', steps: Array(16).fill(0), color: '#4ade80', vol: 100, pan: 64, mute: false },
    { id: 2, name: 'Snare', steps: Array(16).fill(0), color: '#60a5fa', vol: 90, pan: 64, mute: false },
    { id: 3, name: 'HiHat Closed', steps: Array(16).fill(0), color: '#facc15', vol: 85, pan: 64, mute: false },
    { id: 4, name: 'HiHat Open', steps: Array(16).fill(0), color: '#f87171', vol: 80, pan: 64, mute: false },
    { id: 5, name: 'Clap', steps: Array(16).fill(0), color: '#a78bfa', vol: 85, pan: 64, mute: false },
    { id: 6, name: 'Bass', steps: Array(16).fill(0), color: '#fb923c', vol: 95, pan: 64, mute: false },
    { id: 7, name: 'Synth', steps: Array(16).fill(0), color: '#2dd4bf', vol: 75, pan: 64, mute: false },
    { id: 8, name: 'FX', steps: Array(16).fill(0), color: '#e879f9', vol: 70, pan: 64, mute: false },
  ],
  mixerChannels: [
    { id: 1, name: 'Kick', vol: 80, pan: 64, mute: false, solo: false, color: '#4ade80' },
    { id: 2, name: 'Snare', vol: 75, pan: 64, mute: false, solo: false, color: '#60a5fa' },
    { id: 3, name: 'HiHat', vol: 70, pan: 64, mute: false, solo: false, color: '#facc15' },
    { id: 4, name: 'Perc', vol: 70, pan: 64, mute: false, solo: false, color: '#f87171' },
    { id: 5, name: 'Bass', vol: 85, pan: 64, mute: false, solo: false, color: '#fb923c' },
    { id: 6, name: 'Synth', vol: 65, pan: 64, mute: false, solo: false, color: '#2dd4bf' },
    { id: 7, name: 'FX', vol: 60, pan: 64, mute: false, solo: false, color: '#e879f9' },
  ],
  maxZIndex: 10,
  windowLayout: {
    channelRack: { x: 6, y: 6, width: 380, height: 340, zIndex: 4 },
    pianoRoll: { x: 392, y: 6, width: 600, height: 340, zIndex: 3 },
    playlist: { x: 6, y: 352, width: 986, height: 720, zIndex: 2 },
    mixer: { x: 6, y: 678, width: 986, height: 180, zIndex: 1 },
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
  listeners: new Set(),
  currentStep: -1,
  playheadRow: -1,
}

export function useStore() {
  const [, setTick] = useState(0)

  const subscribe = useCallback((listener) => {
    store.listeners.add(listener)
    return () => store.listeners.delete(listener)
  }, [])

  const getState = useCallback(() => store, [])

  const setState = useCallback((partial) => {
    if (typeof partial === 'function') {
      store = { ...store, ...partial(store) }
    } else {
      store = { ...store, ...partial }
    }
    store.listeners.forEach((fn) => fn(store))
    setTick((t) => t + 1)
  }, [])

  return { getState, setState, subscribe }
}

export const defaultChannels = () => store.channels
