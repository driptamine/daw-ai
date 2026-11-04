import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import type { StoreState } from '../store/types'
import { audioStats, getContext, playAudioBuffer, playChannel, playNote, resumeAudio, stopAllAudio, syncMixer } from '../audio/engine'
import { getAudioAsset } from '../audio/assets'

const BAR_STEPS = 16
const PATTERN_STEPS = 32
const SCHEDULE_AHEAD = 0.12
const SCHEDULER_MS = 25

interface QueueItem {
  step: number
  time: number
}

function getPatternNotes(state: StoreState, patternId: number): string[] {
  const pattern = (state.patterns || []).find((p) => p.id === patternId)
  return pattern && pattern.notes ? pattern.notes : []
}

function getLoopRegion(state: StoreState): { start: number; end: number } {
  if (state.patternMode) return { start: 0, end: PATTERN_STEPS }

  const clips = state.playlistClips || []
  const audioClips = state.audioClips || []
  if (!clips.length && !audioClips.length) return { start: 0, end: PATTERN_STEPS }

  let endBar = 0
  clips.forEach((clip) => {
    endBar = Math.max(endBar, clip.startBar + clip.lengthBars)
  })
  audioClips.forEach((clip) => {
    endBar = Math.max(endBar, clip.startBar + clip.lengthBars)
  })
  if (endBar <= 0) return { start: 0, end: PATTERN_STEPS }
  return { start: 0, end: Math.ceil(endBar) * BAR_STEPS }
}

function playPatternNotes(
  state: StoreState,
  notes: string[],
  col: number,
  when: number,
  channelId?: number,
): void {
  notes.forEach((key) => {
    const [noteIndex, noteCol] = key.split('-').map(Number)
    if (noteCol === col) playNote(state.pianoPreset, noteIndex + 36, 0.5, 0.9, when, channelId)
  })
}

function isChannelAudible(state: StoreState, trackIndex: number): boolean {
  const channel = state.channels[trackIndex]
  if (!channel) return true
  if (channel.mute) return false
  return !state.channels.some((ch) => ch.solo) || channel.solo
}

function playAudioClipsAtStep(state: StoreState, step: number, when: number): void {
  if (state.patternMode) return

  state.audioClips.forEach((clip) => {
    const startStep = Math.round(clip.startBar * BAR_STEPS)
    if (startStep !== step) return
    const asset = getAudioAsset(clip.assetId)
    if (asset) playAudioBuffer(asset.buffer, when)
  })
}

function playActiveAudioClips(state: StoreState, startStep: number, when: number): void {
  if (state.patternMode) return

  const secondsPerStep = 60 / state.bpm / 4
  state.audioClips.forEach((clip) => {
    const clipStart = Math.round(clip.startBar * BAR_STEPS)
    if (clipStart >= startStep) return
    const asset = getAudioAsset(clip.assetId)
    if (!asset) return
    const offset = (startStep - clipStart) * secondsPerStep
    if (offset >= asset.duration) return
    playAudioBuffer(asset.buffer, when, offset)
  })
}

export function useTransport(): void {
  const { getState, subscribe } = useStore()
  const playingRef = useRef(false)
  const stepRef = useRef(0)
  const startRef = useRef(0)
  const nextTimeRef = useRef(0)
  const queueRef = useRef<QueueItem[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const expectedRef = useRef(0)

  useEffect(() => {
    syncMixer(getState())

    const clearTimers = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const playStep = (state: StoreState, step: number, when: number) => {
      const channelStep = step % BAR_STEPS
      state.channels.forEach((ch) => {
        if (ch.mute || !ch.steps[channelStep]) return
        if (state.channels.some((c) => c.solo) && !ch.solo) return
        playChannel(ch.preset || 'synth', ((ch.vol ?? 100) / 100) * 0.85, when, ch.id)
      })

      if (state.patternMode) {
        playPatternNotes(state, getPatternNotes(state, state.currentPattern), step % PATTERN_STEPS, when)
        return
      }

      playAudioClipsAtStep(state, step, when)

      const clips = state.playlistClips || []
      clips.forEach((clip) => {
        if (!isChannelAudible(state, clip.track)) return
        const col = step - clip.startBar * BAR_STEPS
        if (col < 0 || col >= clip.lengthBars * BAR_STEPS) return
        const channelId = state.channels[clip.track]?.id
        playPatternNotes(state, getPatternNotes(state, clip.patternId), col, when, channelId)
      })
    }

    const scheduler = () => {
      const state = getState()
      if (!state.isPlaying) {
        clearTimers()
        return
      }
      const now = performance.now()
      audioStats.jitter *= 0.9
      if (expectedRef.current && now - expectedRef.current > audioStats.jitter) {
        audioStats.jitter = now - expectedRef.current
      }
      expectedRef.current = now + SCHEDULER_MS
      const ctx = getContext()
      const region = getLoopRegion(state)
      const secondsPerStep = 60 / state.bpm / 4
      let guard = 0
      while (nextTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD && guard < 500) {
        guard += 1
        const step = stepRef.current
        playStep(state, step, nextTimeRef.current)
        queueRef.current.push({ step, time: nextTimeRef.current })
        nextTimeRef.current += secondsPerStep
        const next = step + 1
        stepRef.current = next >= region.end || next < region.start ? region.start : next
      }
      timerRef.current = setTimeout(scheduler, SCHEDULER_MS)
    }

    const draw = () => {
      const ctx = getContext()
      const queue = queueRef.current
      while (queue.length && queue[0].time <= ctx.currentTime) {
        const item = queue.shift()
        if (item) getState().setState({ currentStep: item.step })
      }
      if (getState().isPlaying) rafRef.current = requestAnimationFrame(draw)
    }

    const startRegionStep = (state: StoreState) => {
      const region = getLoopRegion(state)
      const start = state.playStart ?? 0
      return start >= region.start && start < region.end ? start : region.start
    }

    const startPlayback = (state: StoreState) => {
      resumeAudio()
      const ctx = getContext()
      playingRef.current = true
      startRef.current = state.playStart ?? 0
      stepRef.current = startRegionStep(state)
      nextTimeRef.current = ctx.currentTime + 0.06
      queueRef.current = []
      playActiveAudioClips(state, stepRef.current, nextTimeRef.current)
      scheduler()
      draw()
    }

    const stopPlayback = () => {
      playingRef.current = false
      clearTimers()
      stopAllAudio()
      queueRef.current = []
      expectedRef.current = 0
      audioStats.jitter = 0
      if (getState().currentStep !== -1) {
        getState().setState({ currentStep: -1, playheadRow: -1 })
      }
    }

    const unsubscribe = subscribe(() => {
      const state = getState()
      syncMixer(state)
      const playStart = state.playStart ?? 0
      if (state.isPlaying && !playingRef.current) {
        startPlayback(state)
        return
      }
      if (!state.isPlaying && playingRef.current) {
        stopPlayback()
        return
      }
      if (state.isPlaying && playStart !== startRef.current) {
        const ctx = getContext()
        startRef.current = playStart
        stepRef.current = startRegionStep(state)
        nextTimeRef.current = ctx.currentTime + 0.06
        queueRef.current = []
        stopAllAudio()
        playActiveAudioClips(state, stepRef.current, nextTimeRef.current)
        return
      }
      startRef.current = playStart
    })

    return () => {
      unsubscribe()
      clearTimers()
      stopAllAudio()
    }
  }, [getState, subscribe])
}
