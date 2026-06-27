import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useState, useEffect, useRef } from 'react'

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

const StepHeader = styled.div`
  width: 24px;
  height: 16px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
  border-right: 1px solid ${theme.panelBorder};
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

const Key = styled.div`
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
`

const GridRows = styled.div`
  flex-shrink: 0;
`

const GridRow = styled.div`
  display: flex;
  height: 16px;
`

const GridCell = styled.div`
  width: 24px;
  height: 16px;
  border-right: 1px solid ${({ $beat }) => ($beat ? theme.gridBeat : theme.gridLine)};
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${({ $filled, $dimmed }) =>
    $filled ? theme.accent : ($dimmed ? '#111' : 'transparent')};
  cursor: pointer;
  transition: background 0.05s;

  &:hover {
    background: ${({ $filled }) => ($filled ? theme.accentBright : theme.selected)};
  }
`

const Playhead = styled.div`
  position: absolute;
  left: ${({ $pos }) => $pos * 24}px;
  top: 0;
  width: 2px;
  height: 100%;
  background: ${theme.accent};
  pointer-events: none;
`

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const TOTAL_KEYS = 48
const TOTAL_STEPS = 32

function getNoteName(index) {
  const octave = Math.floor(index / 12) + 2
  const note = noteNames[index % 12]
  return `${note}${octave}`
}

function isBlackKey(index) {
  return [1, 3, 6, 8, 10].includes(index % 12)
}

export default function PianoRoll() {
  const [notes, setNotes] = useState(new Set())
  const [playheadCol] = useState(-1)
  const [scaleMode, setScaleMode] = useState(null)
  const [scaleOpen, setScaleOpen] = useState(false)
  const [scaleRoot, setScaleRoot] = useState(0)
  const [scrollLock, setScrollLock] = useState(false)
  const scaleRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    if (!scaleOpen) return
    const onDown = (e) => {
      if (scaleRef.current && !scaleRef.current.contains(e.target)) setScaleOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [scaleOpen])

  const scrollByOctave = (dir) => {
    const el = gridRef.current
    if (!el) return
    el.scrollBy({ top: dir * 12 * 16, behavior: 'smooth' })
  }

  const scalePatterns = {
    ionian: { label: 'Ionian', notes: [0, 2, 4, 5, 7, 9, 11] },
    aeolian: { label: 'Aeolian', notes: [0, 2, 3, 5, 7, 8, 10] },
    phrygian: { label: 'Phrygian', notes: [0, 1, 3, 5, 7, 8, 10] },
    locrian: { label: 'Locrian', notes: [0, 1, 3, 5, 6, 8, 10] },
  }
  const activeScale = scaleMode ? scalePatterns[scaleMode] : null
  const activeScaleNotes = activeScale ? activeScale.notes.map((n) => (n + scaleRoot) % 12) : null

  const toggleNote = (row, col) => {
    const key = `${row}-${col}`
    setNotes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Container>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
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
            {scaleMode ? activeScale.label : 'Scale'}
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
                    setScaleMode(scaleMode === key ? null : key)
                    setScaleOpen(false)
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: fontSize.xs,
                    color: scaleMode === key ? theme.accent : theme.text,
                    background: scaleMode === key ? theme.accent + '22' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.target.style.background = theme.panelBg}
                  onMouseLeave={(e) => e.target.style.background = scaleMode === key ? theme.accent + '22' : 'transparent'}
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
      </div>

      <GridArea ref={gridRef}>
        <GridInner>
          <HeaderRow>
            <StepHeader style={{ position: 'sticky', left: 0, zIndex: 4, background: theme.surface }} />
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <StepHeader key={i}>{i + 1}</StepHeader>
            ))}
          </HeaderRow>

          <BodyRow>
            <KeysColumn>
              {Array.from({ length: TOTAL_KEYS }, (_, i) => (
                <Key
                  key={i}
                  $black={isBlackKey(TOTAL_KEYS - 1 - i)}
                  $dimmed={!!(activeScaleNotes && !activeScaleNotes.includes((TOTAL_KEYS - 1 - i) % 12))}
                >
                  {isBlackKey(TOTAL_KEYS - 1 - i) ? '' : getNoteName(TOTAL_KEYS - 1 - i)}
                </Key>
              ))}
            </KeysColumn>

            <GridRows>
              {Array.from({ length: TOTAL_KEYS }, (_, row) => (
                <GridRow key={row}>
                  {Array.from({ length: TOTAL_STEPS }, (_, col) => (
                    <GridCell
                      key={col}
                      $beat={(col + 1) % 4 === 0}
                      $filled={notes.has(`${TOTAL_KEYS - 1 - row}-${col}`)}
                      $dimmed={!!(activeScaleNotes && !activeScaleNotes.includes((TOTAL_KEYS - 1 - row) % 12))}
                      onClick={() => toggleNote(TOTAL_KEYS - 1 - row, col)}
                    />
                  ))}
                </GridRow>
              ))}
              {playheadCol >= 0 && <Playhead $pos={playheadCol} />}
            </GridRows>
          </BodyRow>
        </GridInner>
      </GridArea>
    </Container>
  )
}
