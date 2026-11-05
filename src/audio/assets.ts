export interface AudioAsset {
  id: string
  name: string
  buffer: AudioBuffer
  peaks: number[]
  duration: number
}

const assets = new Map<string, AudioAsset>()
const DB_NAME = 'daw-ai-audio'
const STORE_NAME = 'assets'

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveAudioFile(id: string, file: File): Promise<void> {
  const db = await openAssetDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadAudioFile(id: string): Promise<Blob | null> {
  const db = await openAssetDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

export function registerAudioAsset(asset: AudioAsset): void {
  assets.set(asset.id, asset)
}

export function getAudioAsset(id: string): AudioAsset | null {
  return assets.get(id) ?? null
}

export function removeAudioAsset(id: string): void {
  assets.delete(id)
  void openAssetDb().then((db) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => db.close()
  }).catch(() => undefined)
}

export function computePeaks(buffer: AudioBuffer, count = 256): number[] {
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
