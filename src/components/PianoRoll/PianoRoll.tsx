import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { playNote } from '../../audio/engine'
import { downloadMidi } from '../../audio/midi'
import { importMidiIntoProject } from '../../store/midi'
import { getNoteEvents, getPatternSteps, parseNoteKey } from '../../audio/patternNotes'
import type { Pattern } from '../../store/types'
import SoundSelect from '../SoundSelect/SoundSelect'
import { setPatternSound } from '../../store/instruments'
import { memo, useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react'

const MIN_ZOOM = 0.125
const MAX_ZOOM = 4
const GRID_OPTIONS = ['1/2', '1/4', '1/8', '1/16', '1/32', '1/64'] as const
type GridValue = typeof GRID_OPTIONS[number]

const Container = styled.div`
  background: ${theme.panelBg};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const GridArea = styled.div`
  overflow-anchor: none;
  scroll-behavior: auto;
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  &:focus { outline: none; }
`

const GridInner = styled.div`
  width: max-content;
  min-height: 100%;
`

const HeaderRow = styled.div`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 3;
`

const RulerCorner = styled.div`
  width: 40px;
  height: 20px;
  position: sticky;
  left: 0;
  z-index: 4;
  flex-shrink: 0;
  background: ${theme.surface};
  border-right: 1px solid ${theme.panelBorder};
  border-bottom: 1px solid ${theme.panelBorder};
`

const RulerTrack = styled.div`
  position: relative;
  flex-shrink: 0;
  height: 20px;
  border-bottom: 1px solid ${theme.panelBorder};
  background-color: ${theme.surface};
  background-image: linear-gradient(to right, transparent calc(100% - 1px), #657078 0), linear-gradient(to right, transparent calc(100% - 0.5px), rgba(65, 73, 79, var(--piano-grid-opacity, 1)) 0);
  background-size: calc(var(--piano-step-width, 24px) * 16) 100%, var(--piano-grid-width, 24px) 100%;
`

const BarLabel = styled.span`
  position: absolute;
  top: 3px;
  color: #aeb9bf;
  font-size: 10px;
  line-height: 14px;
  pointer-events: none;
`

const BodyRow = styled.div`
  display: flex;
`

const KeysColumn = styled.div`
  position: sticky;
  left: 0;
  z-index: 2;
  flex-shrink: 0;
`

const Key = styled.div<{ $black: boolean; $dimmed: boolean }>`
  height: 16px;
  width: 40px;
  background: ${({ $black, $dimmed }) =>
    $dimmed ? theme.panelBg : ($black ? theme.keyBlack : theme.keyWhite)};
  border-bottom: 1px solid ${theme.panelBorder};
  border-right: 1px solid ${theme.panelBorder};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: ${({ $black }) => ($black ? '#888' : '#555')};
  cursor: pointer;

  &:hover {
    filter: brightness(1.25);
  }

  &:active {
    filter: brightness(0.85);
  }
`

const GridRows = styled.div`
  position: relative;
  flex-shrink: 0;
`

const GridRow = styled.div<{ $dimmed: boolean; $selectTool: boolean }>`
  height: 16px;
  width: 100%;
  border-bottom: 1px solid ${theme.panelBorder};
  background-color: ${({ $dimmed }) => $dimmed ? '#111' : 'transparent'};
  background-image: linear-gradient(to right, transparent calc(100% - 1px), #657078 0), linear-gradient(to right, transparent calc(100% - 0.5px), rgba(65, 73, 79, var(--piano-grid-opacity, 1)) 0);
  background-size: calc(var(--piano-step-width, 24px) * 16) 100%, var(--piano-grid-width, 24px) 100%;
  cursor: ${({ $selectTool }) => $selectTool ? 'default' : 'pointer'};
`

const Playhead = styled.div<{ $pos: number }>`
  position: absolute;
  left: calc(var(--piano-step-width, 24px) * ${({ $pos }) => $pos});
  top: 0;
  width: 2px;
  height: 100%;
  background: ${theme.accent};
  pointer-events: none;
  z-index: 2;
`

const NoteBlock = styled.div<{ $selected: boolean }>`
  position: absolute;
  height: 13px;
  background: ${({ $selected }) => $selected ? theme.accentBright : theme.accent};
  border: 1px solid ${({ $selected }) => $selected ? theme.textBright : theme.accentBright};
  border-radius: 2px;
  color: ${theme.textBright};
  font-size: 8px;
  line-height: 11px;
  cursor: grab;
  overflow: hidden;
  z-index: 1;
  &:hover { filter: brightness(1.2); }
`

const NoteResizeHandle = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  max-width: 50%;
  cursor: ew-resize;
  border-right: 2px solid #ffffff66;
`

const ToolBtn = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? theme.accent : 'transparent')};
  color: ${({ $active }) => ($active ? '#000' : theme.textDim)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 1px 6px;
  font-size: ${fontSize.xs};
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 3px;

  &:hover {
    border-color: ${theme.accent};
  }
`

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

type ScaleMode = 'ionian' | 'aeolian' | 'phrygian' | 'locrian'
type Tool = 'draw' | 'select'

interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Cell {
  noteIndex: number
  col: number
}

function getNoteName(index: number) {
  const octave = Math.floor(index / 12) + 2
  const note = noteNames[((index % 12) + 12) % 12]
  return `${note}${octave}`
}

function isBlackKey(index: number) {
  return [1, 3, 6, 8, 10].includes(((index % 12) + 12) % 12)
}

const GridBackground = memo(function GridBackground({ totalKeys, highestNote, selectTool, scaleMask }: {
  totalKeys: number; highestNote: number; selectTool: boolean; scaleMask: number
}) {
  return <>{Array.from({ length: totalKeys }, (_, row) => {
    const noteIndex = highestNote - row
    const pitchClass = ((noteIndex % 12) + 12) % 12
    return <GridRow key={row}
      data-piano-row={noteIndex}
      $selectTool={selectTool}
      $dimmed={scaleMask !== 0 && !(scaleMask & (1 << pitchClass))}
    />
  })}</>
})

export default function PianoRoll() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const midiInputRef = useRef<HTMLInputElement | null>(null)
  const displayedPattern = useRef<number | undefined>(undefined)
  const [midiBusy, setMidiBusy] = useState(false)
  const [midiStatus, setMidiStatus] = useState('')
  const [viewport, setViewport] = useState({ left: 0, width: 600 })
  const [timelineSteps, setTimelineSteps] = useState(128)
  const [scaleMode, setScaleMode] = useState<ScaleMode | null>('ionian')
  const [scaleOpen, setScaleOpen] = useState(false)
  const [scaleRoot, setScaleRoot] = useState(0)
  const [scrollLock, setScrollLock] = useState(false)
  const [lengthSnap, setLengthSnap] = useState<'1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64' | 'off'>(() => {
    try {
      const saved = localStorage.getItem('daw-ai:piano-length-snap')
      return saved === 'off' || saved === '1/2' || saved === '1/4' || saved === '1/8' || saved === '1/32' || saved === '1/64' ? saved : '1/16'
    } catch { return '1/16' }
  })
  const [gridValue, setGridValue] = useState<GridValue>(() => {
    try {
      const saved = localStorage.getItem('daw-ai:piano-grid')
      if (GRID_OPTIONS.includes(saved as GridValue)) return saved as GridValue
    } catch { /* Storage is optional. */ }
    return lengthSnap === 'off' ? '1/16' : lengthSnap
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [tool, setTool] = useState<Tool>('draw')
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const scaleRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const gridRowsRef = useRef<HTMLDivElement | null>(null)
  const resizeCleanup = useRef<(() => void) | null>(null)
  const pendingZoomScroll = useRef<number | null>(null)
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('daw-ai:piano-zoom')) || 1
      return Number.isFinite(saved) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, saved)) : 1
    } catch { return 1 }
  })
  const stepWidth = 24 * zoom
  const newNoteLengthSteps = lengthSnap === 'off' ? 1 : 16 / Number(lengthSnap.slice(2))
  const gridDivisions = Number(gridValue.slice(2)) / 16
  const gridWidth = stepWidth / gridDivisions
  const gridOpacity = Math.max(0, Math.min(1, (gridWidth - 1.5) / 2.5))

  useEffect(() => () => resizeCleanup.current?.(), [])

  const renderedZoom = useRef(zoom)
  const targetZoom = useRef(zoom)
  const zoomFrame = useRef(0)
  const zoomAnchor = useRef({ step: 0, x: 0 })

  const changeZoom = useCallback((requested: number, anchorX?: number) => {
    const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requested))
    if (target === targetZoom.current) return
    const grid = gridRef.current
    if (grid) {
      const x = Math.max(40, Math.min(grid.clientWidth, anchorX ?? (grid.clientWidth + 40) / 2))
      zoomAnchor.current = { x, step: (grid.scrollLeft + x - 40) / (24 * renderedZoom.current) }
    }
    targetZoom.current = target
    if (zoomFrame.current) return
    let lastTime = performance.now()
    const tick = (time: number) => {
      const elapsed = Math.max(1, time - lastTime)
      lastTime = time
      const current = renderedZoom.current
      const remaining = targetZoom.current - current
      const interpolated = current + remaining * (1 - Math.exp(-elapsed / 65))
      const next = Math.abs(targetZoom.current - interpolated) < 0.0005 ? targetZoom.current : interpolated
      const scroller = gridRef.current
      if (scroller) {
        const { step, x } = zoomAnchor.current
        const contentWidth = (gridRowsRef.current?.offsetWidth ?? 0) * next / current + 40
        const left = Math.max(0, Math.min(Math.max(0, contentWidth - scroller.clientWidth), step * 24 * next + 40 - x))
        pendingZoomScroll.current = left
        setViewport({ left, width: scroller.clientWidth })
      }
      renderedZoom.current = next
      setZoom(next)
      zoomFrame.current = next === targetZoom.current ? 0 : requestAnimationFrame(tick)
    }
    zoomFrame.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(zoomFrame.current)
    zoomFrame.current = 0
  }, [])

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (grid && pendingZoomScroll.current !== null) {
      grid.scrollLeft = pendingZoomScroll.current
      pendingZoomScroll.current = null
    }
  }, [zoom])

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem('daw-ai:piano-zoom', String(zoom)) } catch { /* Storage is optional. */ }
    }, 200)
    return () => clearTimeout(timer)
  }, [zoom])

  useEffect(() => {
    try { localStorage.setItem('daw-ai:piano-length-snap', lengthSnap) } catch { /* Storage is optional. */ }
  }, [lengthSnap])

  useEffect(() => {
    try { localStorage.setItem('daw-ai:piano-grid', gridValue) } catch { /* Storage is optional. */ }
  }, [gridValue])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      event.stopPropagation()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? grid.clientHeight : 1
      const delta = Math.max(-120, Math.min(120, event.deltaY * unit))
      changeZoom(targetZoom.current * Math.exp(-delta * 0.003), event.clientX - grid.getBoundingClientRect().left)
    }
    grid.addEventListener('wheel', onWheel, { passive: false })
    return () => grid.removeEventListener('wheel', onWheel)
  }, [changeZoom])

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const currentPattern = state.patterns.find((p) => p.id === state.currentPattern) || state.patterns[0]
  const notes = useMemo(() => new Set(currentPattern?.notes ?? []), [currentPattern?.notes])
  const pianoPreset = currentPattern?.soundPreset ?? state.pianoPreset
  const patternSteps = getPatternSteps(currentPattern)
  const totalSteps = Math.max(timelineSteps, patternSteps + 64)
  const pitches = useMemo(() => [...notes].map((key) => parseNoteKey(key)[0]).filter(Number.isFinite), [notes])
  const lowestNote = Math.max(-36, Math.min(0, ...pitches))
  const highestNote = Math.min(91, Math.max(47, ...pitches))
  const totalKeys = highestNote - lowestNote + 1
  const playheadCol = state.currentStep >= 0 ? state.currentStep % patternSteps : -1
  const firstCol = Math.max(0, Math.min(totalSteps - 1, Math.floor(((viewport.left - 40) / stepWidth - 8) / 8) * 8))
  const lastCol = Math.min(totalSteps, Math.ceil((firstCol + viewport.width / stepWidth + 18) / 8) * 8)
  const firstBar = Math.floor(firstCol / 16)
  const visibleBars = Array.from({ length: Math.ceil(lastCol / 16) - firstBar }, (_, index) => firstBar + index)

  useEffect(() => {
    const visibleEnd = (viewport.left + viewport.width) / stepWidth
    const reserve = Math.max(32, Math.ceil(viewport.width / stepWidth))
    if (totalSteps - visibleEnd < reserve) {
      setTimelineSteps(Math.ceil((visibleEnd + reserve + 64) / 64) * 64)
    }
  }, [viewport.left, viewport.width, stepWidth, totalSteps])

  useEffect(() => {
    if (!currentPattern || displayedPattern.current === currentPattern.id || !gridRef.current) return
    displayedPattern.current = currentPattern.id
    const firstPitch = currentPattern.notes.length ? parseNoteKey(currentPattern.notes[0])[0] : 24
    const pitch = Number.isFinite(firstPitch) ? firstPitch : 24
    gridRef.current.scrollTop = Math.max(0, (highestNote - pitch) * 16 - gridRef.current.clientHeight / 2)
    gridRef.current.scrollLeft = 0
    setSelected(new Set())
  }, [currentPattern, highestNote])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const observer = new ResizeObserver(() => setViewport({ left: grid.scrollLeft, width: grid.clientWidth }))
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const getNotes = useCallback(() => {
    const s = getState()
    const p = s.patterns.find((pp) => pp.id === s.currentPattern) || s.patterns[0]
    return p && p.notes ? p.notes : []
  }, [getState])

  const getCurrentSound = useCallback(() => {
    const current = getState()
    return current.patterns.find((pattern) => pattern.id === current.currentPattern)?.soundPreset ?? current.pianoPreset
  }, [getState])

  const setNotes = useCallback((arr: string[], eventOverride?: Pattern['noteEvents']) => {
    const s = getState()
    const pid = s.currentPattern
    s.setState({ patterns: s.patterns.map((p) => {
      if (p.id !== pid) return p
      const source = eventOverride ?? p.noteEvents
      const existing = new Set(p.notes)
      const noteEvents = Object.fromEntries(arr.map((key) => [key, source?.[key] ?? (existing.has(key) ? getNoteEvents(p, key, s.bpm) : [{ offsetSteps: 0, durationSteps: newNoteLengthSteps, velocity: 0.9 }])]))
      return { ...p, notes: arr, noteEvents }
    }) })
  }, [getState, newNoteLengthSteps])

  useEffect(() => {
    if (!scaleOpen) return
    const onDown = (e: MouseEvent) => {
      if (scaleRef.current && !scaleRef.current.contains(e.target as Node)) setScaleOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [scaleOpen])

  const scrollByOctave = (dir: number) => {
    const el = gridRef.current
    if (!el) return
    el.scrollBy({ top: dir * 12 * 16, behavior: 'smooth' })
  }

  const scalePatterns: Record<ScaleMode, { label: string; notes: number[] }> = {
    ionian: { label: 'Ionian', notes: [0, 2, 4, 5, 7, 9, 11] },
    aeolian: { label: 'Aeolian', notes: [0, 2, 3, 5, 7, 8, 10] },
    phrygian: { label: 'Phrygian', notes: [0, 1, 3, 5, 7, 8, 10] },
    locrian: { label: 'Locrian', notes: [0, 1, 3, 5, 6, 8, 10] },
  }
  const activeScale = scaleMode ? scalePatterns[scaleMode] : null
  const activeScaleNotes = activeScale ? activeScale.notes.map((n) => (n + scaleRoot) % 12) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(new Set())
        return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target as HTMLElement | null
      const tag = t && t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
      if (!selected.size) return
      e.preventDefault()
      const next = new Set(getNotes())
      selected.forEach((k) => next.delete(k))
      setNotes([...next])
      setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, getNotes, setNotes])

  const startMove = (originKeys: Set<string>, startX: number, startY: number) => {
    resizeCleanup.current?.()
    const originalPattern = getState().patterns.find((pattern) => pattern.id === getState().currentPattern)
    const originalEvents = Object.fromEntries((originalPattern?.notes ?? []).map((key) => [key, getNoteEvents(originalPattern, key, getState().bpm)]))
    const origin = new Map<string, { r: number; c: number }>()
    originKeys.forEach((key) => {
      const [r, c] = parseNoteKey(key)
      origin.set(key, { r, c })
    })
    if (!origin.size) return
    const base = getNotes().filter((key) => !origin.has(key))
    const minimumCol = Math.min(...[...origin.values()].map((note) => note.c))
    const minimumPitch = Math.min(...[...origin.values()].map((note) => note.r))
    const maximumPitch = Math.max(...[...origin.values()].map((note) => note.r))
    const startScrollX = gridRef.current?.scrollLeft ?? 0
    const startScrollY = gridRef.current?.scrollTop ?? 0
    const previousCursor = document.body.style.cursor
    let pointerX = startX
    let pointerY = startY
    let lastCols = 0
    let lastRows = 0
    let dragging = false
    let frame = 0

    const apply = () => {
      const grid = gridRef.current
      const deltaCols = Math.max(-minimumCol, Math.round((pointerX - startX + (grid?.scrollLeft ?? 0) - startScrollX) / stepWidth))
      const deltaRows = Math.max(lowestNote - minimumPitch, Math.min(highestNote - maximumPitch,
        Math.round((startY - pointerY - ((grid?.scrollTop ?? 0) - startScrollY)) / 16)))
      if (deltaCols === lastCols && deltaRows === lastRows) return
      lastCols = deltaCols
      lastRows = deltaRows
      const result = new Set(base)
      const nextSelected = new Set<string>()
      const nextEvents: NonNullable<Pattern['noteEvents']> = Object.fromEntries(base.filter((key) => originalEvents[key]).map((key) => [key, originalEvents[key]]))
      origin.forEach(({ r, c }, originalKey) => {
        const key = `${r + deltaRows}-${c + deltaCols}`
        nextSelected.add(key)
        result.add(key)
        if (originalEvents[originalKey]) nextEvents[key] = [...(nextEvents[key] ?? []), ...originalEvents[originalKey]]
      })
      setNotes([...result], nextEvents)
      setSelected(nextSelected)
    }
    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      if (!dragging && Math.abs(pointerX - startX) + Math.abs(pointerY - startY) < 3) return
      dragging = true
      document.body.style.cursor = 'grabbing'
      apply()
    }
    const tick = () => {
      const grid = gridRef.current
      if (grid && dragging) {
        const rect = grid.getBoundingClientRect()
        const before = grid.scrollLeft
        if (pointerX > rect.right - 24) grid.scrollLeft += 12
        else if (pointerX < rect.left + 64) grid.scrollLeft -= 12
        if (grid.scrollLeft !== before) apply()
      }
      frame = requestAnimationFrame(tick)
    }
    const onUp = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = previousCursor
      resizeCleanup.current = null
    }
    resizeCleanup.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    frame = requestAnimationFrame(tick)
  }

  const cellFromEvent = (clientX: number, clientY: number): Cell | null => {
    const el = gridRowsRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((clientX - rect.left) / stepWidth)
    const row = Math.floor((clientY - rect.top) / 16)
    if (col < 0 || col >= totalSteps || row < 0 || row >= totalKeys) return null
    return { noteIndex: highestNote - row, col }
  }

  const startPaint = (mode: 'add' | 'erase', startKey: string) => {
    let lastKey = startKey
    const onMove = (me: MouseEvent) => {
      const cell = cellFromEvent(me.clientX, me.clientY)
      if (!cell) return
      const key = `${cell.noteIndex}-${cell.col}`
      if (key === lastKey) return
      lastKey = key
      const s = getState()
      const set = new Set(getNotes())
      if (mode === 'add') {
        if (!set.has(key)) {
          set.add(key)
          playNote(getCurrentSound(), cell.noteIndex + 36, newNoteLengthSteps * 60 / s.bpm / 4, 0.9)
          setNotes([...set])
        }
      } else if (set.has(key)) {
        set.delete(key)
        setNotes([...set])
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const startMarquee = (startX: number, startY: number, additive: boolean, tapKey: string | null) => {
    const el = gridRowsRef.current
    if (!el) return
    const rect0 = el.getBoundingClientRect()
    const ox = startX - rect0.left
    const oy = startY - rect0.top
    setMarquee({ x0: ox, y0: oy, x1: ox, y1: oy })
    let moved = false
    const onMove = (me: MouseEvent) => {
      moved = true
      const rect = el.getBoundingClientRect()
      setMarquee((m) => (m ? { ...m, x1: me.clientX - rect.left, y1: me.clientY - rect.top } : m))
    }
    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setMarquee(null)
      if (!moved) {
        if (tapKey) {
          const next = new Set(additive ? selected : [])
          if (next.has(tapKey)) {
            if (additive) next.delete(tapKey)
          } else {
            next.add(tapKey)
            playNote(getCurrentSound(), parseNoteKey(tapKey)[0] + 36, 0.5, 0.9)
          }
          setSelected(next)
        } else if (!additive) {
          setSelected(new Set())
        }
        return
      }
      const rect = el.getBoundingClientRect()
      const ex = me.clientX - rect.left
      const ey = me.clientY - rect.top
      const left = Math.min(ox, ex)
      const right = Math.max(ox, ex)
      const top = Math.min(oy, ey)
      const bottom = Math.max(oy, ey)
      const picked = new Set(additive ? selected : [])
      getNotes().forEach((k) => {
        const [noteIndex, c] = parseNoteKey(k)
        const row = highestNote - noteIndex
        const pattern = getState().patterns.find((pattern) => pattern.id === getState().currentPattern)
        const intersects = getNoteEvents(pattern, k, getState().bpm).some((note) => {
          const x = (c + note.offsetSteps) * stepWidth
          return x <= right && x + note.durationSteps * stepWidth >= left && row * 16 + 14 >= top && row * 16 + 1 <= bottom
        })
        if (intersects) picked.add(k)
      })
      setSelected(picked)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleCellMouseDown = (
    noteIndex: number,
    col: number,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    const key = `${noteIndex}-${col}`
    const s = getState()

    if (tool === 'draw') {
      const set = new Set(getNotes())
      let mode: 'add' | 'erase'
      if (set.has(key)) {
        set.delete(key)
        mode = 'erase'
      } else {
        set.add(key)
        mode = 'add'
        playNote(getCurrentSound(), noteIndex + 36, newNoteLengthSteps * 60 / s.bpm / 4, 0.9)
      }
      setNotes([...set])
      setSelected(new Set())
      startPaint(mode, key)
      return
    }

    const hasNote = getNotes().includes(key)
    const multi = e.shiftKey || e.ctrlKey || e.metaKey

    if (hasNote && selected.has(key) && !multi) {
      startMove(selected, e.clientX, e.clientY)
      return
    }

    startMarquee(e.clientX, e.clientY, multi, hasNote ? key : null)
  }

  const handleCellContextMenu = (
    noteIndex: number,
    col: number,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault()
    const key = `${noteIndex}-${col}`
    if (!getNotes().includes(key)) return
    const next = new Set(getNotes())
    next.delete(key)
    setNotes([...next])
    if (selected.has(key)) {
      const ns = new Set(selected)
      ns.delete(key)
      setSelected(ns)
    }
  }

  const startNoteResize = (key: string, eventIndex: number, event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizeCleanup.current?.()
    const state = getState()
    const pattern = state.patterns.find((item) => item.id === state.currentPattern)
    if (!pattern) return
    const original = getNoteEvents(pattern, key, state.bpm)[eventIndex]
    if (!original) return
    if (!selected.has(key)) setSelected(new Set([key]))
    const startX = event.clientX
    const startScroll = gridRef.current?.scrollLeft ?? 0
    const previousCursor = document.body.style.cursor
    let pointerX = startX
    let fine = lengthSnap === 'off' || event.altKey
    let frame = 0
    let previousDuration = original.durationSteps
    let started = false
    document.body.style.cursor = 'ew-resize'
    const apply = () => {
      const delta = (pointerX - startX + (gridRef.current?.scrollLeft ?? 0) - startScroll) / stepWidth
      if (!started && Math.abs(delta * stepWidth) < 2) return
      started = true
      const raw = original.durationSteps + delta
      const snapSteps = newNoteLengthSteps
      const durationSteps = fine ? Math.max(1 / 16, raw) : Math.max(snapSteps, Math.round(raw / snapSteps) * snapSteps)
      if (durationSteps === previousDuration) return
      previousDuration = durationSteps
      const current = getState()
      current.setState({ patterns: current.patterns.map((item) => {
        if (item.id !== pattern.id || !item.notes.includes(key)) return item
        const events = [...getNoteEvents(item, key, current.bpm)]
        if (!events[eventIndex]) return item
        events[eventIndex] = { ...events[eventIndex], durationSteps }
        return { ...item, noteEvents: { ...item.noteEvents, [key]: events } }
      }) })
    }
    const onMove = (move: MouseEvent) => { pointerX = move.clientX; fine = lengthSnap === 'off' || move.altKey; apply() }
    const tick = () => {
      const grid = gridRef.current
      if (grid) {
        const rect = grid.getBoundingClientRect()
        const before = grid.scrollLeft
        if (pointerX > rect.right - 24) grid.scrollLeft += 12
        else if (pointerX < rect.left + 64) grid.scrollLeft -= 12
        if (grid.scrollLeft !== before) apply()
      }
      frame = requestAnimationFrame(tick)
    }
    const onUp = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = previousCursor
      resizeCleanup.current = null
    }
    resizeCleanup.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    frame = requestAnimationFrame(tick)
  }

  const handleMidiImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMidiBusy(true)
    setMidiStatus('')
    try {
      const result = await importMidiIntoProject(file, getState)
      setSelected(new Set())
      if (gridRef.current) gridRef.current.scrollLeft = 0
      setMidiStatus(`Imported ${result.noteCount} notes · ${result.patterns.length} patterns${result.flattenedTempo ? ' · tempo changes converted to fixed BPM' : ''}`)
    } catch (error) {
      setMidiStatus(error instanceof Error ? error.message : 'Не удалось импортировать MIDI.')
    } finally {
      setMidiBusy(false)
    }
  }

  const handleMidiExport = () => {
    try {
      if (!currentPattern) return
      const filename = downloadMidi(currentPattern, getState().bpm)
      setMidiStatus(`Exported ${filename}`)
    } catch (error) {
      setMidiStatus(error instanceof Error ? error.message : 'Не удалось экспортировать MIDI.')
    }
  }

  return (
    <Container aria-label="Piano Roll" style={{ ['--piano-step-width' as string]: `${stepWidth}px`, ['--piano-grid-width' as string]: `${gridWidth}px`, ['--piano-grid-opacity' as string]: gridOpacity }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <ToolBtn $active={tool === 'draw'} title="Draw" onClick={() => setTool('draw')}>
          ✏ Draw
        </ToolBtn>
        <ToolBtn $active={tool === 'select'} title="Select" onClick={() => setTool('select')}>
          ▢ Select
        </ToolBtn>
        <ToolBtn $active={false} disabled={zoom <= MIN_ZOOM} aria-label="Piano roll zoom out" title="Уменьшить ширину сетки" onClick={() => changeZoom(targetZoom.current / 1.25)}>−</ToolBtn>
        <ToolBtn $active={false} title="Сбросить горизонтальный масштаб на 100%" onClick={() => changeZoom(1)} style={{ minWidth: 48, justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{Number((zoom * 100).toFixed(1))}%</ToolBtn>
        <ToolBtn $active={false} disabled={zoom >= MAX_ZOOM} aria-label="Piano roll zoom in" title="Увеличить ширину сетки" onClick={() => changeZoom(targetZoom.current * 1.25)}>+</ToolBtn>
        <button
          onClick={() => scrollByOctave(-1)}
          style={{
            background: 'transparent',
            color: theme.textDim,
            border: '1px solid ' + theme.panelBorder,
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: fontSize.xs,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ▲
        </button>
        <button
          onClick={() => scrollByOctave(1)}
          style={{
            background: 'transparent',
            color: theme.textDim,
            border: '1px solid ' + theme.panelBorder,
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: fontSize.xs,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ▼
        </button>
        <button
          onClick={() => setScrollLock((v) => !v)}
          style={{
            background: scrollLock ? theme.accent : 'transparent',
            color: scrollLock ? '#000' : theme.textDim,
            border: '1px solid ' + (scrollLock ? theme.accent : theme.panelBorder),
            borderRadius: '3px',
            padding: '1px 5px',
            fontSize: fontSize.xs,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          🔒
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: fontSize.xs, color: theme.textDim }}>
          Grid
          <select
            aria-label="Piano roll grid"
            value={gridValue}
            title="Плотность линий сетки"
            onChange={(event) => {
              const value = event.target.value as GridValue
              if (GRID_OPTIONS.includes(value)) {
                setGridValue(value)
                event.currentTarget.blur()
                gridRef.current?.focus({ preventScroll: true })
              }
            }}
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, padding: '1px 4px', fontSize: fontSize.xs, cursor: 'pointer' }}
          >
            {GRID_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: fontSize.xs, color: theme.textDim }}>
          Snap
          <select
            aria-label="Note length snap"
            value={lengthSnap}
            title="Note length snap. Hold Alt for free resizing."
            onChange={(event) => {
              const value = event.target.value
              if (value === '1/2' || value === '1/4' || value === '1/8' || value === '1/16' || value === '1/32' || value === '1/64' || value === 'off') {
                setLengthSnap(value)
                event.currentTarget.blur()
                gridRef.current?.focus({ preventScroll: true })
              }
            }}
            style={{
              background: theme.surface,
              color: lengthSnap === 'off' ? theme.textDim : theme.text,
              border: `1px solid ${lengthSnap === 'off' ? theme.panelBorder : theme.accent}`,
              borderRadius: 3,
              padding: '1px 4px',
              fontSize: fontSize.xs,
              cursor: 'pointer',
            }}
          >
            <option value="1/2">1/2</option>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
            <option value="1/32">1/32</option>
            <option value="1/64">1/64</option>
            <option value="off">Off</option>
          </select>
        </label>
        <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>Velocity: 100</span>
        <div ref={scaleRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setScaleOpen((o) => !o)}
            style={{
              background: scaleMode ? theme.accent : 'transparent',
              color: scaleMode ? '#fff' : theme.textDim,
              border: '1px solid ' + (scaleMode ? theme.accent : theme.panelBorder),
              borderRadius: '3px',
              padding: '1px 6px',
              fontSize: fontSize.xs,
              cursor: 'pointer',
            }}
          >
            {scaleMode ? activeScale?.label : 'Scale'}
          </button>
          {scaleOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '2px',
              background: theme.surfaceRaised,
              border: '1px solid ' + theme.panelBorder,
              borderRadius: '4px',
              overflow: 'hidden',
              zIndex: 100,
              minWidth: '90px',
            }}>
              {Object.entries(scalePatterns).map(([key, { label }]) => (
                <div
                  key={key}
                  onClick={() => {
                    setScaleMode(scaleMode === key ? null : (key as ScaleMode))
                    setScaleOpen(false)
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: fontSize.xs,
                    color: scaleMode === key ? theme.accent : theme.text,
                    background: scaleMode === key ? theme.accent + '22' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.panelBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = scaleMode === key ? theme.accent + '22' : 'transparent' }}
                >
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
        {scaleMode && ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n, i) => (
          <span
            key={n}
            onClick={() => setScaleRoot(i)}
            style={{
              fontSize: fontSize.xs,
              color: scaleRoot === i ? theme.accent : theme.textDim,
              fontWeight: scaleRoot === i ? 700 : 400,
              cursor: 'pointer',
              padding: '0 3px',
            }}
          >
            {n}
          </span>
        ))}
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>Sound</span>
          <SoundSelect
            value={pianoPreset}
            onFocusReturn={() => gridRef.current?.focus({ preventScroll: true })}
            onChange={(preset) => {
              setPatternSound(getState(), preset)
              playNote(preset, 60, 0.5, 0.9)
            }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '4px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <input ref={midiInputRef} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={handleMidiImport} />
        <ToolBtn $active={false} disabled={midiBusy} onClick={() => midiInputRef.current?.click()} title="Импортировать MIDI-треки в новые паттерны">{midiBusy ? 'Importing…' : 'Import MIDI'}</ToolBtn>
        <ToolBtn $active={false} disabled={!currentPattern?.notes.length || midiBusy} onClick={handleMidiExport} title="Экспортировать ноты выбранного паттерна в .mid">Export MIDI</ToolBtn>
        {midiStatus && <span role="status" style={{ color: theme.text, fontSize: fontSize.xs }}>{midiStatus}</span>}
      </div>
      <GridArea data-piano-grid tabIndex={-1} ref={gridRef} onScroll={(event) => { const grid = event.currentTarget; setViewport((previous) => Math.abs(previous.left - grid.scrollLeft) < 1 && previous.width === grid.clientWidth ? previous : { left: grid.scrollLeft, width: grid.clientWidth }) }}>
        <GridInner>
          <HeaderRow>
            <RulerCorner />
            <RulerTrack data-piano-ruler style={{ width: totalSteps * stepWidth }}>
              {visibleBars.map((bar) => (
                <BarLabel key={bar} style={{ left: bar * 16 * stepWidth + 4 }} title={`Такт ${bar + 1}`}>{bar + 1}</BarLabel>
              ))}
            </RulerTrack>
          </HeaderRow>

          <BodyRow>
            <KeysColumn>
              {Array.from({ length: totalKeys }, (_, i) => (
                <Key
                  key={i}
                  $black={isBlackKey(highestNote - i)}
                  $dimmed={!!(activeScaleNotes && !activeScaleNotes.includes((((highestNote - i) % 12) + 12) % 12))}
                  onMouseDown={() => playNote(pianoPreset, (highestNote - i) + 36, 0.6, 0.9)}
                >
                  {isBlackKey(highestNote - i) ? '' : getNoteName(highestNote - i)}
                </Key>
              ))}
            </KeysColumn>

            <GridRows ref={gridRowsRef} style={{ width: totalSteps * stepWidth }}
              onMouseDown={(event) => {
                const cell = cellFromEvent(event.clientX, event.clientY)
                if (cell) handleCellMouseDown(cell.noteIndex, cell.col, event)
              }}
              onContextMenu={(event) => {
                const cell = cellFromEvent(event.clientX, event.clientY)
                if (cell) handleCellContextMenu(cell.noteIndex, cell.col, event)
              }}
            >
              <GridBackground
                totalKeys={totalKeys}
                highestNote={highestNote}
                selectTool={tool === 'select'}
                scaleMask={activeScaleNotes ? activeScaleNotes.reduce((mask, pitch) => mask | (1 << pitch), 0) : 0}
              />
              {[...notes].flatMap((key) => {
                const [noteIndex, col] = parseNoteKey(key)
                if (!Number.isFinite(noteIndex) || !Number.isFinite(col)) return []
                return getNoteEvents(currentPattern, key, state.bpm).map((note, index) => {
                  const start = col + note.offsetSteps
                  if (start + note.durationSteps < firstCol || start > lastCol) return null
                  return (
                    <NoteBlock
                      key={`${key}:${index}`}
                      data-note-key={key}
                      data-note-event={index}
                      data-duration-steps={note.durationSteps}
                      $selected={selected.has(key)}
                      style={{ left: start * stepWidth, top: (highestNote - noteIndex) * 16 + 1, width: Math.max(3, note.durationSteps * stepWidth - 1) }}
                      title={`${getNoteName(noteIndex)} · ${Number(note.durationSteps.toFixed(2))} steps · drag right edge to resize`}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return
                        event.stopPropagation()
                        if (tool === 'select') handleCellMouseDown(noteIndex, col, event)
                        else {
                          event.preventDefault()
                          setSelected(new Set([key]))
                          startMove(new Set([key]), event.clientX, event.clientY)
                        }
                      }}
                      onContextMenu={(event) => { event.stopPropagation(); handleCellContextMenu(noteIndex, col, event) }}
                    >
                      <span style={{ paddingLeft: 3, pointerEvents: 'none' }}>{getNoteName(noteIndex)}</span>
                      <NoteResizeHandle data-resize-note={key} title="Изменить длину ноты · Alt — без привязки" onMouseDown={(event) => startNoteResize(key, index, event)} />
                    </NoteBlock>
                  )
                })
              })}
              {playheadCol >= 0 && <Playhead $pos={playheadCol} />}
              {marquee && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                    border: `1px solid ${theme.accent}`,
                    background: theme.selected,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              )}
            </GridRows>
          </BodyRow>
        </GridInner>
      </GridArea>
    </Container>
  )
}
