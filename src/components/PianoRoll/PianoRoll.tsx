import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { playNote } from '../../audio/engine'
import { PRESET_OPTIONS } from '../../audio/presets'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

const Container = styled.div`
  background: ${theme.panelBg};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const GridArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
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

const StepHeader = styled.div<{ $beat?: boolean }>`
  width: 24px;
  height: 16px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
  border-right: ${({ $beat }) =>
    $beat ? `2px solid ${theme.textDim}` : `1px solid ${theme.panelBorder}`};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: ${theme.textDim};
  flex-shrink: 0;
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

const GridRow = styled.div`
  display: flex;
  height: 16px;
`

const GridCell = styled.div<{
  $beat: boolean
  $filled: boolean
  $dimmed: boolean
  $selected: boolean
  $selectTool: boolean
}>`
  width: 24px;
  height: 16px;
  border-right: ${({ $beat }) =>
    $beat ? `2px solid ${theme.textDim}` : `1px solid ${theme.gridLine}`};
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${({ $filled, $dimmed, $selected }) =>
    $selected ? theme.textBright : ($filled ? theme.accent : ($dimmed ? '#111' : 'transparent'))};
  box-shadow: ${({ $selected }) => ($selected ? `inset 0 0 0 1px ${theme.accent}` : 'none')};
  cursor: ${({ $selectTool }) => ($selectTool ? 'default' : 'pointer')};
  transition: background 0.05s;

  &:hover {
    background: ${({ $filled, $selected }) =>
      $selected ? theme.textBright : ($filled ? theme.accentBright : theme.selected)};
  }
`

const Playhead = styled.div<{ $pos: number }>`
  position: absolute;
  left: ${({ $pos }) => $pos * 24}px;
  top: 0;
  width: 2px;
  height: 100%;
  background: ${theme.accent};
  pointer-events: none;
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
const TOTAL_KEYS = 48
const TOTAL_STEPS = 32

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
  const note = noteNames[index % 12]
  return `${note}${octave}`
}

function isBlackKey(index: number) {
  return [1, 3, 6, 8, 10].includes(index % 12)
}

export default function PianoRoll() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const [scaleMode, setScaleMode] = useState<ScaleMode | null>(null)
  const [scaleOpen, setScaleOpen] = useState(false)
  const [scaleRoot, setScaleRoot] = useState(0)
  const [scrollLock, setScrollLock] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [tool, setTool] = useState<Tool>('draw')
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const scaleRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const gridRowsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const currentPattern = state.patterns.find((p) => p.id === state.currentPattern) || state.patterns[0]
  const notes = new Set(currentPattern ? currentPattern.notes : [])
  const pianoPreset = state.pianoPreset
  const playheadCol = state.currentStep >= 0 ? state.currentStep % TOTAL_STEPS : -1

  const getNotes = useCallback(() => {
    const s = getState()
    const p = s.patterns.find((pp) => pp.id === s.currentPattern) || s.patterns[0]
    return p && p.notes ? p.notes : []
  }, [getState])

  const setNotes = useCallback((arr: string[]) => {
    const s = getState()
    const pid = s.currentPattern
    s.setState({ patterns: s.patterns.map((p) => (p.id === pid ? { ...p, notes: arr } : p)) })
  }, [getState])

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
    const origin = new Map<string, { r: number; c: number }>()
    originKeys.forEach((k) => {
      const [r, c] = k.split('-').map(Number)
      origin.set(k, { r, c })
    })
    if (!origin.size) return
    const base = getNotes().filter((k) => !origin.has(k))

    const onMove = (me: MouseEvent) => {
      const deltaRows = Math.round((startY - me.clientY) / 16)
      const deltaCols = Math.round((me.clientX - startX) / 24)
      const result = new Set(base)
      const nextSelected = new Set<string>()
      origin.forEach(({ r, c }) => {
        const nr = Math.max(0, Math.min(TOTAL_KEYS - 1, r + deltaRows))
        const nc = Math.max(0, Math.min(TOTAL_STEPS - 1, c + deltaCols))
        const nk = `${nr}-${nc}`
        nextSelected.add(nk)
        result.add(nk)
      })
      setNotes([...result])
      setSelected(nextSelected)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const cellFromEvent = (clientX: number, clientY: number): Cell | null => {
    const el = gridRowsRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((clientX - rect.left) / 24)
    const row = Math.floor((clientY - rect.top) / 16)
    if (col < 0 || col >= TOTAL_STEPS || row < 0 || row >= TOTAL_KEYS) return null
    return { noteIndex: TOTAL_KEYS - 1 - row, col }
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
          playNote(s.pianoPreset, cell.noteIndex + 36, 0.5, 0.9)
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
          const s = getState()
          const next = new Set(additive ? selected : [])
          if (next.has(tapKey)) {
            if (additive) next.delete(tapKey)
          } else {
            next.add(tapKey)
            playNote(s.pianoPreset, parseInt(tapKey.split('-')[0], 10) + 36, 0.5, 0.9)
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
        const [noteIndex, c] = k.split('-').map(Number)
        const row = TOTAL_KEYS - 1 - noteIndex
        const cx = c * 24 + 12
        const cy = row * 16 + 8
        if (cx >= left && cx <= right && cy >= top && cy <= bottom) picked.add(k)
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
        playNote(s.pianoPreset, noteIndex + 36, 0.5, 0.9)
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

  return (
    <Container>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <ToolBtn $active={tool === 'draw'} title="Draw" onClick={() => setTool('draw')}>
          ✏ Draw
        </ToolBtn>
        <ToolBtn $active={tool === 'select'} title="Select" onClick={() => setTool('select')}>
          ▢ Select
        </ToolBtn>
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
        <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>Snap: 1/4</span>
        <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>Snap: 1/4</span>
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
          <select
            value={pianoPreset}
            onChange={(e) => {
              getState().setState({ pianoPreset: e.target.value })
              playNote(e.target.value, 60, 0.5, 0.9)
            }}
            style={{
              background: theme.surface,
              color: theme.text,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: '3px',
              fontSize: fontSize.xs,
              padding: '1px 4px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {PRESET_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <GridArea ref={gridRef}>
        <GridInner>
          <HeaderRow>
            <StepHeader style={{ width: 40, position: 'sticky', left: 0, zIndex: 4, background: theme.surface }} />
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <StepHeader key={i} $beat={(i + 1) % 4 === 0}>{i + 1}</StepHeader>
            ))}
          </HeaderRow>

          <BodyRow>
            <KeysColumn>
              {Array.from({ length: TOTAL_KEYS }, (_, i) => (
                <Key
                  key={i}
                  $black={isBlackKey(TOTAL_KEYS - 1 - i)}
                  $dimmed={!!(activeScaleNotes && !activeScaleNotes.includes((TOTAL_KEYS - 1 - i) % 12))}
                  onMouseDown={() => playNote(pianoPreset, (TOTAL_KEYS - 1 - i) + 36, 0.6, 0.9)}
                >
                  {isBlackKey(TOTAL_KEYS - 1 - i) ? '' : getNoteName(TOTAL_KEYS - 1 - i)}
                </Key>
              ))}
            </KeysColumn>

            <GridRows ref={gridRowsRef}>
              {Array.from({ length: TOTAL_KEYS }, (_, row) => (
                <GridRow key={row}>
                  {Array.from({ length: TOTAL_STEPS }, (_, col) => {
                    const noteIndex = TOTAL_KEYS - 1 - row
                    const cellKey = `${noteIndex}-${col}`
                    return (
                      <GridCell
                        key={col}
                        $beat={(col + 1) % 4 === 0}
                        $filled={notes.has(cellKey)}
                        $selected={selected.has(cellKey)}
                        $selectTool={tool === 'select'}
                        $dimmed={!!(activeScaleNotes && !activeScaleNotes.includes(noteIndex % 12))}
                        onMouseDown={(e) => handleCellMouseDown(noteIndex, col, e)}
                        onContextMenu={(e) => handleCellContextMenu(noteIndex, col, e)}
                      />
                    )
                  })}
                </GridRow>
              ))}
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
