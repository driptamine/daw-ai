import { SOUND_PRESETS, midiToFreq } from './presets'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let masterVolume = 0.85
const activeSources = new Set<AudioBufferSourceNode>()

export const audioStats = {
  jitter: 0,
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
    master = ctx.createGain()
    master.gain.value = masterVolume
    master.connect(ctx.destination)
  }
  return ctx
}

export function resumeAudio(): AudioContext {
  const context = getContext()
  if (context.state === 'suspended') context.resume()
  return context
}

export function setMasterVolume(value: number): void {
  masterVolume = Math.max(0, Math.min(1, value))
  if (master) master.gain.value = masterVolume
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
): void {
  const context = getContext()
  const source = context.createBufferSource()
  const gain = context.createGain()
  const safeOffset = Math.max(0, Math.min(offset, buffer.duration - 0.001))

  source.buffer = buffer
  gain.gain.value = Math.max(0, Math.min(1, gainValue))
  source.connect(gain).connect(master as GainNode)
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
): void {
  const context = getContext()
  if (context.state === 'suspended') context.resume()
  const preset = SOUND_PRESETS[presetId] || SOUND_PRESETS.synth
  const freq = midiToFreq(midi)
  const time = when != null ? when : context.currentTime + 0.001
  preset.fn(context, master as GainNode, time, freq, duration, Math.max(0, Math.min(1, velocity)))
}

export function playChannel(presetId: string, velocity = 0.9, when?: number): void {
  const preset = SOUND_PRESETS[presetId] || SOUND_PRESETS.synth
  const midi = preset.previewMidi ?? 60
  playNote(presetId, midi, preset.drum ? 0.3 : 0.5, velocity, when)
}
