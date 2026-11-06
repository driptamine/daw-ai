import { SAMPLED_PRESETS } from './soundfonts'

export type PresetFn = (
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  vel: number,
) => void

export interface SoundPreset {
  label: string
  fn: PresetFn
  previewMidi: number
  drum?: boolean
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

let noiseBuffer: AudioBuffer | null = null

function getNoise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const len = Math.floor(ctx.sampleRate * 2)
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function noiseSource(ctx: AudioContext, time: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  src.start(time)
  return src
}

const kick: PresetFn = (ctx, out, t, _freq, _dur, vel) => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, t)
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  gain.gain.setValueAtTime(vel, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 0.5)
}

const snare: PresetFn = (ctx, out, t, _freq, _dur, vel) => {
  const noise = noiseSource(ctx, t)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1200
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(vel * 0.7, t)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  noise.connect(hp).connect(ng).connect(out)
  noise.stop(t + 0.25)

  const osc = ctx.createOscillator()
  const og = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(180, t)
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.1)
  og.gain.setValueAtTime(vel * 0.5, t)
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
  osc.connect(og).connect(out)
  osc.start(t)
  osc.stop(t + 0.2)
}

function hihat(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  _freq: number,
  _dur: number,
  vel: number,
  open: boolean,
): void {
  const noise = noiseSource(ctx, t)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const gain = ctx.createGain()
  const decay = open ? 0.35 : 0.06
  gain.gain.setValueAtTime(vel * 0.5, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  noise.connect(hp).connect(gain).connect(out)
  noise.stop(t + decay + 0.05)
}

const clap: PresetFn = (ctx, out, t, _freq, _dur, vel) => {
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1500
  bp.Q.value = 1.2
  bp.connect(out)
  const bursts = [0, 0.012, 0.024, 0.04]
  bursts.forEach((offset, i) => {
    const noise = noiseSource(ctx, t + offset)
    const gain = ctx.createGain()
    const last = i === bursts.length - 1
    const amp = vel * (last ? 0.6 : 0.35)
    const decay = last ? 0.18 : 0.03
    gain.gain.setValueAtTime(amp, t + offset)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + decay)
    noise.connect(gain).connect(bp)
    noise.stop(t + offset + decay + 0.05)
  })
}

const bass: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 0.4
  const osc = ctx.createOscillator()
  const sub = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  sub.type = 'sine'
  sub.frequency.value = freq / 2
  filter.type = 'lowpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(Math.min(freq * 8, 4000), t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 120), t + d)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(vel * 0.8, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  osc.connect(filter)
  sub.connect(filter)
  filter.connect(gain).connect(out)
  osc.start(t)
  sub.start(t)
  osc.stop(t + d + 0.05)
  sub.stop(t + d + 0.05)
}

const synth: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 0.5
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  osc2.type = 'square'
  osc2.frequency.value = freq
  osc2.detune.value = 8
  filter.type = 'lowpass'
  filter.Q.value = 4
  filter.frequency.setValueAtTime(600, t)
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 6, 6000), t + 0.15)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(vel * 0.5, t + 0.02)
  gain.gain.setValueAtTime(vel * 0.5, t + d * 0.6)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  osc.connect(filter)
  osc2.connect(filter)
  filter.connect(gain).connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + d + 0.05)
  osc2.stop(t + d + 0.05)
}

const pad: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 1.2
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = Math.min(freq * 8, 4000)
  filter.Q.value = 1
  const detunes = [-8, 0, 8]
  detunes.forEach((detune) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    osc.detune.value = detune
    osc.connect(filter)
    osc.start(t)
    osc.stop(t + d + 0.2)
  })
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(vel * 0.28, t + 0.25)
  gain.gain.setValueAtTime(vel * 0.28, t + d * 0.8)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2)
  filter.connect(gain).connect(out)
}

const piano: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 0.8
  const gain = ctx.createGain()
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const octGain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2
  octGain.gain.value = 0.3
  osc.connect(gain)
  osc2.connect(octGain).connect(gain)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(vel * 0.7, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  gain.connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + d + 0.05)
  osc2.stop(t + d + 0.05)
}

const bell: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 1.2
  const carrier = ctx.createOscillator()
  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  const gain = ctx.createGain()
  carrier.type = 'sine'
  carrier.frequency.value = freq
  mod.type = 'sine'
  mod.frequency.value = freq * 2.5
  modGain.gain.setValueAtTime(freq * 1.2, t)
  modGain.gain.exponentialRampToValueAtTime(1, t + d)
  mod.connect(modGain).connect(carrier.frequency)
  gain.gain.setValueAtTime(vel * 0.6, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  carrier.connect(gain).connect(out)
  carrier.start(t)
  mod.start(t)
  carrier.stop(t + d + 0.05)
  mod.stop(t + d + 0.05)
}

const pluck: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = Math.min(dur || 0.3, 0.5)
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  filter.type = 'lowpass'
  filter.Q.value = 2
  filter.frequency.setValueAtTime(Math.min(freq * 10, 9000), t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq, 200), t + d)
  gain.gain.setValueAtTime(vel * 0.6, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  osc.connect(filter).connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + d + 0.05)
}

const fx: PresetFn = (ctx, out, t, freq, dur, vel) => {
  const d = dur || 0.6
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 4, t + d)
  filter.type = 'bandpass'
  filter.Q.value = 5
  filter.frequency.setValueAtTime(400, t)
  filter.frequency.exponentialRampToValueAtTime(6000, t + d)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(vel * 0.4, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d)
  osc.connect(filter).connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + d + 0.05)
}

export const SOUND_PRESETS: Record<string, SoundPreset> = {
  kick: { label: 'Kick', fn: kick, previewMidi: 36, drum: true },
  snare: { label: 'Snare', fn: snare, previewMidi: 36, drum: true },
  hihatClosed: {
    label: 'Closed Hat',
    fn: (c, o, t, f, d, v) => hihat(c, o, t, f, d, v, false),
    previewMidi: 36,
    drum: true,
  },
  hihatOpen: {
    label: 'Open Hat',
    fn: (c, o, t, f, d, v) => hihat(c, o, t, f, d, v, true),
    previewMidi: 36,
    drum: true,
  },
  clap: { label: 'Clap', fn: clap, previewMidi: 36, drum: true },
  bass: { label: 'Bass', fn: bass, previewMidi: 36 },
  synth: { label: 'Synth Lead', fn: synth, previewMidi: 60 },
  pad: { label: 'Synth Pad', fn: pad, previewMidi: 60 },
  piano: { label: 'Piano', fn: piano, previewMidi: 60 },
  bell: { label: 'Bell', fn: bell, previewMidi: 72 },
  pluck: { label: 'Pluck', fn: pluck, previewMidi: 60 },
  fx: { label: 'FX Riser', fn: fx, previewMidi: 48 },
}

const BUILTIN_OPTIONS = Object.entries(SOUND_PRESETS).map(
  ([id, preset]) => ({ id, label: preset.label }),
)

export const PRESET_GROUPS = [
  { label: 'Built-in synths & drums', options: BUILTIN_OPTIONS },
  { label: 'FluidR3 · General MIDI', options: SAMPLED_PRESETS.filter((preset) => preset.bank === 'FluidR3_GM') },
  { label: 'MusyngKite · General MIDI', options: SAMPLED_PRESETS.filter((preset) => preset.bank === 'MusyngKite') },
]

export const PRESET_OPTIONS: { id: string; label: string }[] = PRESET_GROUPS.flatMap((group) => group.options)
