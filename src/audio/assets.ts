export interface AudioAsset {
  id: string
  name: string
  buffer: AudioBuffer
  peaks: number[]
  duration: number
}

const assets = new Map<string, AudioAsset>()

export function registerAudioAsset(asset: AudioAsset): void {
  assets.set(asset.id, asset)
}

export function getAudioAsset(id: string): AudioAsset | null {
  return assets.get(id) ?? null
}

export function removeAudioAsset(id: string): void {
  assets.delete(id)
}

export function computePeaks(buffer: AudioBuffer, count = 96): number[] {
  const data = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(data.length / count))
  const peaks: number[] = []

  for (let i = 0; i < count; i++) {
    const start = i * blockSize
    const end = Math.min(data.length, start + blockSize)
    let peak = 0
    for (let j = start; j < end; j++) {
      const value = Math.abs(data[j])
      if (value > peak) peak = value
    }
    peaks.push(peak)
  }

  const max = Math.max(...peaks, 0.0001)
  return peaks.map((peak) => Math.max(0.04, peak / max))
}
