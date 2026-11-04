import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import type { StoreState } from '../store/types'
import { audioStats, getContext, playChannel, playNote, resumeAudio } from '../audio/engine'

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
  if (!clips.length) return { start: 0, end: PATTERN_STEPS }

  let endBar = 0
  clips.forEach((clip) => {
    endBar = Math.max(endBar, clip.startBar + clip.lengthBars)
  })
  if (endBar <= 0) return { start: 0, end: PATTERN_STEPS }
  return { start: 0, end: endBar * BAR_STEPS }
}

function playPatternNotes(state: StoreState, notes: string[], col: number, when: number): void {
  notes.forEach((key) => {
    const [noteIndex, noteCol] = key.split('-').map(Number)
    if (noteCol === col) playNote(state.pianoPreset, noteIndex + 36, 0.5, 0.9, when)
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
        playChannel(ch.preset || 'synth', ((ch.vol ?? 100) / 100) * 0.85, when)
      })

      if (state.patternMode) {
        playPatternNotes(state, getPatternNotes(state, state.currentPattern), step % PATTERN_STEPS, when)
        return
      }

      const clips = state.playlistClips || []
      clips.forEach((clip) => {
        const channel = state.channels[clip.track]
        if (channel && channel.mute) return
        const col = step - clip.startBar * BAR_STEPS
        if (col < 0 || col >= clip.lengthBars * BAR_STEPS) return
        playPatternNotes(state, getPatternNotes(state, clip.patternId), col, when)
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
      scheduler()
      draw()
    }

    const stopPlayback = () => {
      playingRef.current = false
      clearTimers()
      queueRef.current = []
      expectedRef.current = 0
      audioStats.jitter = 0
      if (getState().currentStep !== -1) {
        getState().setState({ currentStep: -1, playheadRow: -1 })
      }
    }

    const unsubscribe = subscribe(() => {
      const state = getState()
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
        return
      }
      startRef.current = playStart
    })

    return () => {
      unsubscribe()
      clearTimers()
    }
  }, [getState, subscribe])
}
