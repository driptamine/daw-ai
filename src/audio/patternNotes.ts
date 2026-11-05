import type { Pattern } from '../store/types'

export function parseNoteKey(key: string): [number, number] {
  const match = /^(-?\d+)-(\d+)$/.exec(key)
  return match ? [Number(match[1]), Number(match[2])] : [NaN, NaN]
}

export function getNoteEvents(pattern: Pattern | undefined, key: string, bpm: number) {
  return pattern?.noteEvents?.[key] ?? [{ offsetSteps: 0, durationSteps: bpm / 30, velocity: 0.9 }]
}

export function getPatternSteps(pattern?: Pattern): number {
  let end = Math.max(32, pattern?.lengthSteps ?? 0)
  for (const key of pattern?.notes ?? []) {
    const [, step] = parseNoteKey(key)
    if (!Number.isFinite(step)) continue
    end = Math.max(end, step + 1)
    for (const event of pattern?.noteEvents?.[key] ?? []) {
      end = Math.max(end, step + event.offsetSteps + event.durationSteps)
    }
  }
  return Math.ceil(end / 16) * 16
}
