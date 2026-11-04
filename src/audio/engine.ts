import { SOUND_PRESETS, midiToFreq } from './presets'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let masterAnalyser: AnalyserNode | null = null
let masterVolume = 0.85

let sendBusA: GainNode | null = null
let sendBusB: GainNode | null = null

export type ReturnKind = 'reverb' | 'delay'

interface ChannelStrip {
  input: GainNode
  volume: GainNode
  panner: StereoPannerNode
  analyser: AnalyserNode
  sendA: GainNode
  sendB: GainNode
}

interface ReturnStrip {
  id: number
  kind: ReturnKind
  input: GainNode
  volume: GainNode
  panner: StereoPannerNode
  analyser: AnalyserNode
  delay?: DelayNode
  feedback?: GainNode
}

export interface MixerChannelState {
  id: number
  vol: number
  pan: number
  mute: boolean
  solo: boolean
  sendA: number
  sendB: number
}

export interface MixerReturnState {
  id: number
  kind: ReturnKind
  vol: number
  pan: number
  mute: boolean
}

export interface MixerState {
  channels: MixerChannelState[]
  returnTracks: MixerReturnState[]
  masterVolume: number
  bpm: number
}

const channelStrips = new Map<number, ChannelStrip>()
const returnStrips = new Map<number, ReturnStrip>()
const activeSources = new Set<AudioBufferSourceNode>()
const meterBuffer = new Float32Array(1024)

let lastMixer: MixerState | null = null

export const audioStats = {
  jitter: 0,
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

function panToStereo(pan: number): number {
  return Math.max(-1, Math.min(1, (pan - 64) / 64))
}

function createReverbImpulse(context: AudioContext): AudioBuffer {
  const seconds = 2.4
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const impulse = context.createBuffer(2, length, rate)

  for (let ch = 0; ch < impulse.numberOfChannels; ch += 1) {
    const data = impulse.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.pow(1 - i / length, 2.8)
      data[i] = (Math.random() * 2 - 1) * envelope
    }
  }

  return impulse
}

function makeAnalyser(context: AudioContext): AnalyserNode {
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.35
  return analyser
}

function createReturnStrip(
  context: AudioContext,
  id: number,
  kind: ReturnKind,
): ReturnStrip {
  const input = context.createGain()
  const volume = context.createGain()
  const panner = context.createStereoPanner()
  const analyser = makeAnalyser(context)

  volume.connect(panner)
  panner.connect(analyser)
  analyser.connect(master as GainNode)

  const strip: ReturnStrip = { id, kind, input, volume, panner, analyser }

  if (kind === 'delay') {
    const delay = context.createDelay(2)
    const feedback = context.createGain()
    delay.delayTime.value = 0.345
    feedback.gain.value = 0.34
    input.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(volume)
    strip.delay = delay
    strip.feedback = feedback
  } else {
    const convolver = context.createConvolver()
    convolver.buffer = createReverbImpulse(context)
    input.connect(convolver)
    convolver.connect(volume)
  }

  returnStrips.set(id, strip)
  return strip
}

function findReturn(kind: ReturnKind): ReturnStrip | null {
  for (const strip of returnStrips.values()) {
    if (strip.kind === kind) return strip
  }
  return null
}

function getReturnStrip(context: AudioContext, id: number, kind: ReturnKind): ReturnStrip {
  const existing = returnStrips.get(id)
  if (existing) return existing
  const strip = createReturnStrip(context, id, kind)
  connectSendBuses()
  return strip
}

function connectSendBuses(): void {
  if (sendBusA) {
    sendBusA.disconnect()
    const reverb = findReturn('reverb')
    if (reverb) sendBusA.connect(reverb.input)
  }
  if (sendBusB) {
    sendBusB.disconnect()
    const delay = findReturn('delay')
    if (delay) sendBusB.connect(delay.input)
  }
}

function ensureGraph(context: AudioContext): void {
  if (master) return

  master = context.createGain()
  master.gain.value = masterVolume
  masterAnalyser = makeAnalyser(context)
  master.connect(masterAnalyser)
  masterAnalyser.connect(context.destination)

  sendBusA = context.createGain()
  sendBusB = context.createGain()

  if (lastMixer) {
    lastMixer.returnTracks.forEach((ret) => getReturnStrip(context, ret.id, ret.kind))
  }
}

function getChannelStrip(context: AudioContext, channelId: number): ChannelStrip {
  ensureGraph(context)

  const existing = channelStrips.get(channelId)
  if (existing) return existing

  const input = context.createGain()
  const volume = context.createGain()
  const panner = context.createStereoPanner()
  const analyser = makeAnalyser(context)
  const a = context.createGain()
  const b = context.createGain()

  input.connect(volume)
  volume.connect(panner)
  panner.connect(analyser)
  analyser.connect(master as GainNode)
  volume.connect(a)
  volume.connect(b)
  if (sendBusA) a.connect(sendBusA)
  if (sendBusB) b.connect(sendBusB)

  const strip: ChannelStrip = {
    input,
    volume,
    panner,
    analyser,
    sendA: a,
    sendB: b,
  }
  channelStrips.set(channelId, strip)

  const preset = lastMixer?.channels.find((ch) => ch.id === channelId)
  if (preset) {
    strip.volume.gain.value = preset.mute ? 0 : clamp01(preset.vol / 100)
    strip.panner.pan.value = panToStereo(preset.pan)
    strip.sendA.gain.value = clamp01(preset.sendA / 100)
    strip.sendB.gain.value = clamp01(preset.sendB / 100)
  }

  return strip
}

function pruneStrips(): void {
  if (!lastMixer) return

  const channelIds = new Set(lastMixer.channels.map((ch) => ch.id))
  channelStrips.forEach((strip, id) => {
    if (channelIds.has(id)) return
    strip.input.disconnect()
    strip.volume.disconnect()
    strip.panner.disconnect()
    strip.analyser.disconnect()
    strip.sendA.disconnect()
    strip.sendB.disconnect()
    channelStrips.delete(id)
  })

  const returnIds = new Set(lastMixer.returnTracks.map((ret) => ret.id))
  returnStrips.forEach((strip, id) => {
    if (returnIds.has(id)) return
    strip.input.disconnect()
    strip.volume.disconnect()
    strip.panner.disconnect()
    strip.analyser.disconnect()
    strip.delay?.disconnect()
    strip.feedback?.disconnect()
    returnStrips.delete(id)
  })
}

function applyMixerState(state: MixerState): void {
  if (!ctx || !master) return

  const now = ctx.currentTime
  master.gain.setTargetAtTime(clamp01(state.masterVolume), now, 0.01)

  const delayStrip = findReturn('delay')
  if (delayStrip?.delay) {
    const bpm = Math.max(40, state.bpm || 120)
    delayStrip.delay.delayTime.setTargetAtTime(Math.min(1.9, (60 / bpm) * 0.75), now, 0.05)
  }

  const anySolo = state.channels.some((ch) => ch.solo)

  state.channels.forEach((ch) => {
    const strip = getChannelStrip(ctx as AudioContext, ch.id)
    const gain = ch.mute || (anySolo && !ch.solo) ? 0 : clamp01(ch.vol / 100)
    strip.volume.gain.setTargetAtTime(gain, now, 0.012)
    strip.panner.pan.setTargetAtTime(panToStereo(ch.pan), now, 0.012)
    strip.sendA.gain.setTargetAtTime(clamp01(ch.sendA / 100), now, 0.02)
    strip.sendB.gain.setTargetAtTime(clamp01(ch.sendB / 100), now, 0.02)
  })

  state.returnTracks.forEach((ret) => {
    const strip = getReturnStrip(ctx as AudioContext, ret.id, ret.kind)
    const gain = ret.mute ? 0 : clamp01(ret.vol / 100)
    strip.volume.gain.setTargetAtTime(gain, now, 0.012)
    strip.panner.pan.setTargetAtTime(panToStereo(ret.pan), now, 0.012)
  })

  pruneStrips()
}

export function syncMixer(state: MixerState): void {
  lastMixer = state
  masterVolume = clamp01(state.masterVolume)

  if (!ctx) return
  ensureGraph(ctx)
  applyMixerState(state)
}

function readLevel(analyser: AnalyserNode | null): number {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(meterBuffer)
  let sum = 0
  for (let i = 0; i < meterBuffer.length; i += 1) sum += meterBuffer[i] * meterBuffer[i]
  const rms = Math.sqrt(sum / meterBuffer.length)
  if (rms <= 0.00001) return 0
  const db = 20 * Math.log10(rms)
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100))
}

export function getChannelLevel(channelId: number): number {
  return readLevel(channelStrips.get(channelId)?.analyser ?? null)
}

export function getReturnLevel(returnId: number): number {
  return readLevel(returnStrips.get(returnId)?.analyser ?? null)
}

export function getMasterLevel(): number {
  return readLevel(masterAnalyser)
}

export function getLatencyMs(): number {
  if (!ctx) return 0
  const ext = ctx as AudioContext & { outputLatency?: number }
  const base = ctx.baseLatency || 0
  const output = ext.outputLatency || 0
  return Math.round((base + output) * 1000 * 10) / 10
}

export function getContext(): AudioContext {
  if (!ctx) {
    const win = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    const AudioCtx = win.AudioContext || win.webkitAudioContext
    ctx = new AudioCtx()
    ensureGraph(ctx)
  }
  return ctx
}

export function resumeAudio(): AudioContext {
  const context = getContext()
  if (context.state === 'suspended') context.resume()
  return context
}

export function setMasterVolume(value: number): void {
  masterVolume = clamp01(value)
  if (master && ctx) master.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.01)
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const context = getContext()
  if (context.state === 'suspended') void context.resume()
  const data = await file.arrayBuffer()
  return context.decodeAudioData(data)
}

export function playAudioBuffer(
  buffer: AudioBuffer,
  when: number,
  offset = 0,
  gainValue = 0.9,
  channelId?: number,
): void {
  const context = getContext()
  const source = context.createBufferSource()
  const gain = context.createGain()
  const safeOffset = Math.max(0, Math.min(offset, buffer.duration - 0.001))

  source.buffer = buffer
  gain.gain.value = clamp01(gainValue)
  source.connect(gain)
  const out = channelId != null ? getChannelStrip(context, channelId).input : (master as GainNode)
  gain.connect(out)
  source.onended = () => {
    activeSources.delete(source)
  }
  activeSources.add(source)
  source.start(Math.max(when, context.currentTime), safeOffset)
}

export function stopAllAudio(): void {
  activeSources.forEach((source) => {
    try {
      source.stop()
    } catch {
      // Source may have already stopped.
    }
  })
  activeSources.clear()
}

export function playNote(
  presetId: string,
  midi = 60,
  duration = 0.5,
  velocity = 0.9,
  when?: number,
  channelId?: number,
): void {
  const context = getContext()
  if (context.state === 'suspended') context.resume()
  const preset = SOUND_PRESETS[presetId] || SOUND_PRESETS.synth
  const freq = midiToFreq(midi)
  const time = when != null ? when : context.currentTime + 0.001
  const out = channelId != null ? getChannelStrip(context, channelId).input : (master as GainNode)
  preset.fn(context, out, time, freq, duration, clamp01(velocity))
}

export function playChannel(
  presetId: string,
  velocity = 0.9,
  when?: number,
  channelId?: number,
): void {
  const preset = SOUND_PRESETS[presetId] || SOUND_PRESETS.synth
  const midi = preset.previewMidi ?? 60
  playNote(presetId, midi, preset.drum ? 0.3 : 0.5, velocity, when, channelId)
}
