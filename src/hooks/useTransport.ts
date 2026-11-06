import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import type { Pattern, StoreState } from '../store/types'
import { getPatternSteps, parseNoteKey } from '../audio/patternNotes'
import { audioStats, getContext, playAudioBuffer, playChannel, playNote, preparePlaybackSounds, resumeAudio, stopAllAudio, syncMixer } from '../audio/engine'
import { getAudioAsset } from '../audio/assets'

const BAR_STEPS = 16
const PATTERN_STEPS = 32
const SCHEDULE_AHEAD = 0.12
const SCHEDULER_MS = 25

interface QueueItem {
  step: number
  time: number
}

function getPattern(state: StoreState, patternId: number): Pattern | undefined {
  return state.patterns.find((pattern) => pattern.id === patternId)
}

function getLoopRegion(state: StoreState): { start: number; end: number } {
  if (state.patternMode) return { start: 0, end: getPatternSteps(getPattern(state, state.currentPattern)) }

  const clips = state.playlistClips || []
  const audioClips = state.audioClips || []
  let endBar = 0
  clips.forEach((clip) => {
    endBar = Math.max(endBar, clip.startBar + clip.lengthBars)
  })
  audioClips.forEach((clip) => {
    endBar = Math.max(endBar, clip.startBar + clip.lengthBars)
  })
  const cursorBar = Math.max(0, state.playStart) / BAR_STEPS
  if (cursorBar >= endBar) {
    endBar = Math.max(state.playlistLength || 64, Math.floor(cursorBar) + 1)
  }
  if (endBar <= 0) return { start: 0, end: PATTERN_STEPS }
  return { start: 0, end: Math.ceil(endBar) * BAR_STEPS }
}

function playPatternNotes(
  state: StoreState,
  pattern: Pattern | undefined,
  col: number,
  when: number,
  channelId?: number,
  fromOffset = 0,
): void {
  const secondsPerStep = 60 / state.bpm / 4
  pattern?.notes.forEach((key) => {
    const [noteIndex, noteCol] = parseNoteKey(key)
    if (noteIndex < -36 || noteIndex > 91 || noteCol + 1 <= col + fromOffset || noteCol >= col + 1) return
    const events = pattern.noteEvents?.[key]
    if (!events) {
      const offset = noteCol - col
      if (offset < fromOffset || offset >= 1) return
      playNote(pattern.soundPreset ?? state.pianoPreset, noteIndex + 36, 0.5, 0.9, when + offset * secondsPerStep, channelId)
      return
    }
    for (const event of events) {
      const offset = noteCol + event.offsetSteps - col
      if (offset < fromOffset || offset >= 1) continue
      playNote(pattern.soundPreset ?? state.pianoPreset, noteIndex + 36, event.durationSteps * secondsPerStep,
        event.velocity, when + offset * secondsPerStep, channelId)
    }
  })
}

function isChannelAudible(state: StoreState, trackIndex: number): boolean {
  const channel = state.channels[trackIndex]
  if (!channel) return true
  if (channel.mute) return false
  return !state.channels.some((ch) => ch.solo) || channel.solo
}

function playAudioClipsAtStep(state: StoreState, step: number, when: number, fromOffset = 0): void {
  if (state.patternMode) return

  state.audioClips.forEach((clip) => {
    const offset = clip.startBar * BAR_STEPS - step
    if (offset < fromOffset || offset >= 1) return
    const track = clip.track ?? 0
    if (!isChannelAudible(state, track)) return
    const asset = getAudioAsset(clip.assetId)
    if (asset) playAudioBuffer(asset.buffer, when + offset * 60 / state.bpm / 4, 0, 0.9, state.channels[track]?.id)
  })
}

function playActiveAudioClips(state: StoreState, startStep: number, when: number): void {
  if (state.patternMode) return

  const secondsPerStep = 60 / state.bpm / 4
  state.audioClips.forEach((clip) => {
    const clipStart = clip.startBar * BAR_STEPS
    if (clipStart >= startStep) return
    const track = clip.track ?? 0
    if (!isChannelAudible(state, track)) return
    const asset = getAudioAsset(clip.assetId)
    if (!asset) return
    const offset = (startStep - clipStart) * secondsPerStep
    if (offset >= asset.duration) return
    playAudioBuffer(asset.buffer, when, offset, 0.9, state.channels[track]?.id)
  })
}

export function useTransport(): void {
  const { getState, subscribe } = useStore()
  const playingRef = useRef(false)
  const loadVersion = useRef(0)
  const soundRef = useRef('')
  const stepRef = useRef(0)
  const startRef = useRef(0)
  const modeRef = useRef(getState().patternMode)
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

    const playStep = (state: StoreState, step: number, when: number, fromOffset = 0) => {
      const channelStep = step % BAR_STEPS
      state.channels.forEach((ch) => {
        if (fromOffset > 0) return
        if (ch.mute || !ch.steps[channelStep]) return
        if (state.channels.some((c) => c.solo) && !ch.solo) return
        playChannel(ch.preset || 'synth', ((ch.vol ?? 100) / 100) * 0.85, when, ch.id)
      })

      if (state.patternMode) {
        const pattern = getPattern(state, state.currentPattern)
        playPatternNotes(state, pattern, step % getPatternSteps(pattern), when, undefined, fromOffset)
        return
      }

      playAudioClipsAtStep(state, step, when, fromOffset)

      const clips = state.playlistClips || []
      clips.forEach((clip) => {
        if (!isChannelAudible(state, clip.track)) return
        const col = step - clip.startBar * BAR_STEPS
        if (col + 1 <= 0 || col >= clip.lengthBars * BAR_STEPS) return
        const channelId = state.channels[clip.track]?.id
        playPatternNotes(state, getPattern(state, clip.patternId), col, when, channelId, fromOffset)
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

    const soundSignature = (state: StoreState) => JSON.stringify([
      state.pianoPreset,
      state.patterns.map((pattern) => [pattern.id, pattern.soundPreset]),
      state.channels.map((channel) => [channel.id, channel.preset]),
    ])

    const startPlayback = (state: StoreState, resumeStep?: number) => {
      resumeAudio()
      clearTimers()
      stopAllAudio()
      const version = ++loadVersion.current
      playingRef.current = true
      startRef.current = state.playStart ?? 0
      modeRef.current = state.patternMode
      soundRef.current = soundSignature(state)
      queueRef.current = []
      expectedRef.current = 0
      void preparePlaybackSounds(state).then(() => {
        const current = getState()
        if (version !== loadVersion.current || !current.isPlaying) return
        const ctx = getContext()
        const region = getLoopRegion(current)
        const start = resumeStep !== undefined && resumeStep >= region.start && resumeStep < region.end ? resumeStep : startRegionStep(current)
        const when = ctx.currentTime + 0.06
        const secondsPerStep = 60 / current.bpm / 4
        const nextStep = Math.ceil(start)
        playActiveAudioClips(current, start, when)
        if (nextStep > start) {
          const offset = start - Math.floor(start)
          playStep(current, Math.floor(start), when - offset * secondsPerStep, offset)
          queueRef.current.push({ step: start, time: when })
        }
        stepRef.current = nextStep >= region.end ? region.start : nextStep
        nextTimeRef.current = when + (nextStep - start) * secondsPerStep
        scheduler()
        draw()
      }).catch(() => {
        if (version === loadVersion.current && getState().isPlaying) getState().setState({ isPlaying: false })
      })
    }

    const stopPlayback = () => {
      loadVersion.current += 1
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
      if (state.isPlaying && (playStart !== startRef.current || state.patternMode !== modeRef.current)) {
        startPlayback(state)
        return
      }
      if (state.isPlaying && soundSignature(state) !== soundRef.current) {
        startPlayback(state, state.currentStep >= 0 ? state.currentStep : undefined)
        return
      }
      startRef.current = playStart
      modeRef.current = state.patternMode
    })

    return () => {
      loadVersion.current += 1
      unsubscribe()
      clearTimers()
      stopAllAudio()
    }
  }, [getState, subscribe])
}
