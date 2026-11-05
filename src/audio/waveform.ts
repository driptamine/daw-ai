export interface WaveformEnvelope {
  min: Float32Array
  max: Float32Array
}

const envelopes = new WeakMap<AudioBuffer, WaveformEnvelope>()
const MAX_BUCKETS = 65536

// Keep both signed extrema. Absolute peaks would produce a mirrored silhouette
// and lose the actual shape of asymmetric signals and quiet passages.
export function getWaveformEnvelope(buffer: AudioBuffer, requestedPoints: number): WaveformEnvelope {
  let source = envelopes.get(buffer)
  if (!source) {
    const count = Math.min(MAX_BUCKETS, buffer.length)
    const min = new Float32Array(count).fill(Infinity)
    const max = new Float32Array(count).fill(-Infinity)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel)
      for (let i = 0; i < count; i += 1) {
        const start = Math.floor(i * buffer.length / count)
        const end = Math.floor((i + 1) * buffer.length / count)
        let low = min[i]
        let high = max[i]
        for (let sample = start; sample < end; sample += 1) {
          low = Math.min(low, samples[sample])
          high = Math.max(high, samples[sample])
        }
        min[i] = low
        max[i] = high
      }
    }
    source = { min, max }
    envelopes.set(buffer, source)
  }

  const points = Number.isFinite(requestedPoints) ? Math.floor(requestedPoints) : 128
  const count = Math.min(source.min.length, Math.max(1, points))
  const min = new Float32Array(count)
  const max = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * source.min.length / count)
    const end = Math.floor((i + 1) * source.min.length / count)
    let low = Infinity
    let high = -Infinity
    for (let j = start; j < end; j += 1) {
      low = Math.min(low, source.min[j])
      high = Math.max(high, source.max[j])
    }
    min[i] = low
    max[i] = high
  }
  return { min, max }
}
