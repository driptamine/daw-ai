import { Midi } from '@tonejs/midi'
import type { NoteEvent, Pattern } from '../store/types'
import { getNoteEvents, getPatternSteps, parseNoteKey } from './patternNotes'

export function importMidi(data: ArrayBuffer, name: string, firstId: number, fallbackBpm = 120) {
  const bytes = new Uint8Array(data)
  if (bytes.length < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') {
    throw new Error('Файл не является стандартным MIDI (.mid).')
  }
  if (bytes[12] & 0x80) throw new Error('MIDI с временной шкалой SMPTE пока не поддерживается.')
  const midi = new Midi(data)
  const bpm = midi.header.tempos[0]?.bpm ?? fallbackBpm
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('Некорректный темп MIDI.')
  const stepsPerSecond = bpm / 60 * 4
  let noteCount = 0
  const patterns: Pattern[] = []
  for (const track of midi.tracks) {
    if (!track.notes.length) continue
    const noteEvents: Record<string, NoteEvent[]> = {}
    let end = 0
    for (const note of track.notes) {
      const start = note.time * stepsPerSecond
      const durationSteps = Math.max(1 / 960, note.duration * stepsPerSecond)
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(durationSteps)) {
        throw new Error('MIDI содержит некорректное время нот.')
      }
      const step = Math.floor(start + 1e-8)
      const key = `${note.midi - 36}-${step}`
      ;(noteEvents[key] ??= []).push({ offsetSteps: Math.max(0, start - step), durationSteps, velocity: note.velocity })
      end = Math.max(end, start + durationSteps)
      noteCount += 1
    }
    patterns.push({
      id: firstId + patterns.length,
      name: track.name.trim() || `${name.replace(/\.(mid|midi)$/i, '')} ${patterns.length + 1}`,
      notes: Object.keys(noteEvents),
      noteEvents,
      lengthSteps: Math.max(32, Math.ceil(end / 16) * 16),
      midiChannel: track.channel,
      midiProgram: track.instrument.number,
    })
  }
  if (!patterns.length) throw new Error('В этом MIDI-файле нет нот.')
  return { patterns, bpm, noteCount, flattenedTempo: midi.header.tempos.length > 1 }
}

export function exportMidi(pattern: Pattern, bpm: number): Uint8Array {
  if (!pattern.notes.length) throw new Error('В выбранном паттерне нет нот для экспорта.')
  const midi = new Midi()
  midi.name = pattern.name
  midi.header.setTempo(bpm)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4], measures: 0 })
  const track = midi.addTrack()
  track.name = pattern.name
  track.channel = pattern.midiChannel ?? 0
  track.instrument.number = pattern.midiProgram ?? 0
  const ticksPerStep = midi.header.ppq / 4
  for (const key of pattern.notes) {
    const [index, step] = parseNoteKey(key)
    if (!Number.isInteger(index) || index < -36 || index > 91 || !Number.isInteger(step)) continue
    const events = getNoteEvents(pattern, key, bpm)
    for (const event of events) {
      track.addNote({
        midi: index + 36,
        ticks: Math.max(0, Math.round((step + event.offsetSteps) * ticksPerStep)),
        durationTicks: Math.max(1, Math.round(event.durationSteps * ticksPerStep)),
        velocity: event.velocity,
      })
    }
  }
  track.endOfTrackTicks = Math.round(getPatternSteps(pattern) * ticksPerStep)
  return midi.toArray()
}

export function downloadMidi(pattern: Pattern, bpm: number): string {
  const bytes = exportMidi(pattern, bpm)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'audio/midi' }))
  const filename = `${pattern.name.replace(/[\\/:*?"<>|]/g, '_') || 'pattern'}.mid`
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
