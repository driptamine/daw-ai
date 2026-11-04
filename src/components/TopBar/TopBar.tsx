import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { audioStats, getLatencyMs, resumeAudio } from '../../audio/engine'
import { exportProject, importProject } from '../../store/persist'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import type { StoreState } from '../../store/types'

const Bar = styled.div`
  display: flex;
  flex-direction: column;
  background: ${theme.transportBg};
  border-bottom: 1px solid ${theme.panelBorder};
  user-select: none;
`

const MenuRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 8px;
  height: 24px;
  border-bottom: 1px solid ${theme.panelBorder};
`

const MenuItem = styled.span`
  color: ${theme.text};
  font-size: ${fontSize.sm};
  padding: 2px 10px;
  cursor: pointer;

  &:hover {
    background: ${theme.surfaceRaised};
  }
`

const ToolRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  height: 36px;
`

const Button = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) => ($active ? theme.accent : theme.surface)};
  color: ${({ $active }) => ($active ? '#000' : theme.text)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 2px 8px;
  font-size: ${fontSize.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 28px;
  justify-content: center;

  &:hover {
    background: ${({ $active }) => ($active ? theme.accentBright : theme.surfaceRaised)};
  }

  &:active {
    transform: scale(0.95);
  }
`

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: ${theme.panelBorder};
  margin: 0 2px;
`

const Label = styled.span`
  color: ${theme.textDim};
  font-size: ${fontSize.xs};
  margin-right: 3px;
`

const Value = styled.span`
  color: ${theme.textBright};
  font-size: ${fontSize.sm};
  font-weight: 600;
  min-width: 24px;
  text-align: center;
`

const BpmControl = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`

const BpmInput = styled.input`
  background: ${theme.surface};
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  color: ${theme.textBright};
  font-size: ${fontSize.md};
  font-weight: 600;
  width: 42px;
  text-align: center;
  padding: 1px 3px;
  outline: none;

  &:focus {
    border-color: ${theme.accent};
  }
`

const Position = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${theme.textBright};
  font-size: ${fontSize.sm};
  font-weight: 600;
  font-family: 'Courier New', monospace;
  margin: 0 4px;
`

const PosSegment = styled.span`
  background: ${theme.surface};
  padding: 0 4px;
  border-radius: 2px;
  border: 1px solid ${theme.panelBorder};
  min-width: 18px;
  text-align: center;
`

const Tab = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? theme.accent : 'transparent')};
  color: ${({ $active }) => ($active ? '#000' : theme.text)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 2px 8px;
  font-size: ${fontSize.sm};
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    background: ${({ $active }) => ($active ? theme.accentBright : theme.surfaceRaised)};
  }
`

const AddBtn = styled.button`
  background: transparent;
  border: 1px dashed ${theme.textDim};
  color: ${theme.textDim};
  border-radius: 3px;
  padding: 2px 6px;
  font-size: ${fontSize.sm};
  cursor: pointer;

  &:hover {
    border-color: ${theme.accent};
    color: ${theme.accent};
  }
`

const RightSection = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
`

const windows = [
  { id: 'channelRack', label: 'RACK' },
  { id: 'pianoRoll', label: 'PIANO' },
  { id: 'playlist', label: 'PLAYLIST' },
  { id: 'mixer', label: 'MIX' },
]

function isTopWindow(state: StoreState, id: string) {
  const layers = state.windowLayout || {}
  const mine = layers[id]
  if (!mine) return false
  return Object.entries(state.windowVisibility).every(([wid, visible]) => {
    if (!visible || wid === id) return true
    const other = layers[wid]
    return !other || other.zIndex < mine.zIndex
  })
}

const JIT_LEVELS = [
  { color: theme.green, label: 'зелёный', range: '0 – 8 мс' },
  { color: theme.yellow, label: 'жёлтый', range: '8 – 20 мс' },
  { color: theme.red, label: 'красный', range: 'от 20 мс' },
]

function TimingIndicator() {
  const [, setTick] = useState(0)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  const latency = Math.round(getLatencyMs())
  const jitter = Math.round(audioStats.jitter)
  const latText = String(latency).padStart(3, '\u00A0')
  const jitText = String(jitter).padStart(3, '\u00A0')
  const color = jitter < 8 ? theme.green : jitter < 20 ? theme.yellow : theme.red

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: fontSize.xs,
        color: theme.textDim,
        marginRight: 4,
        width: 138,
        justifyContent: 'flex-end',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ minWidth: 64, textAlign: 'right', fontFamily: 'monospace' }}>{`LAT ${latText}ms`}</span>
      <span style={{ minWidth: 58, textAlign: 'right', fontFamily: 'monospace' }}>{`JIT ${jitText}ms`}</span>

      {hover && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            background: theme.surfaceRaised,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: 4,
            padding: '6px 8px',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            color: theme.text,
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            textAlign: 'left',
          }}
        >
          <div style={{ color: theme.textDim, marginBottom: 4 }}>Джиттер планировщика (JIT)</div>
          {JIT_LEVELS.map((lvl) => (
            <div key={lvl.label} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: lvl.color, flexShrink: 0 }} />
              <span style={{ minWidth: 56 }}>{lvl.label}</span>
              <span style={{ color: theme.textDim }}>{lvl.range}</span>
            </div>
          ))}
          <div style={{ color: theme.textDim, marginTop: 6, borderTop: `1px solid ${theme.panelBorder}`, paddingTop: 4 }}>
            LAT — задержка звукового тракта
          </div>
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const { getState, setState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { bpm, patternMode, swing, currentPattern, patterns, windowVisibility, isPlaying } = state
  const patternName = patterns.find((p) => p.id === currentPattern)?.name || `Pattern ${currentPattern}`
  const [bpmText, setBpmText] = useState(String(bpm))

  useEffect(() => {
    setBpmText(String(bpm))
  }, [bpm])

  const handleBpmChange = useCallback((e: ReactChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setBpmText(raw)
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val >= 20 && val <= 999) {
      setState({ bpm: val })
    }
  }, [setState])

  const commitBpm = useCallback(() => {
    const val = parseInt(bpmText, 10)
    if (isNaN(val)) {
      setBpmText(String(getState().bpm))
      return
    }
    const clamped = Math.max(20, Math.min(999, val))
    setState({ bpm: clamped })
    setBpmText(String(clamped))
  }, [bpmText, getState, setState])

  const handlePlay = useCallback(() => {
    resumeAudio()
    setState({ isPlaying: true })
  }, [setState])

  const handleStop = useCallback(() => {
    setState({ isPlaying: false, currentStep: -1, playheadRow: -1 })
  }, [setState])

  const handlePause = useCallback(() => {
    setState({ isPlaying: false })
  }, [setState])

  const handleSave = useCallback(() => {
    exportProject(getState())
  }, [getState])

  const handleLoad = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleWindowToggle = useCallback((id: string) => {
    const s = getState()
    const visible = !!s.windowVisibility[id]
    if (visible && isTopWindow(s, id)) {
      setState({ windowVisibility: { ...s.windowVisibility, [id]: false } })
      return
    }
    const newZ = (s.maxZIndex || 10) + 1
    const layouts = { ...s.windowLayout }
    const layout = layouts[id]
    if (layout) {
      const availH = window.innerHeight - 60
      const y = layout.y > availH - 40 ? Math.max(0, availH - layout.height) : layout.y
      layouts[id] = { ...layout, y, zIndex: newZ }
    }
    setState({
      windowVisibility: { ...s.windowVisibility, [id]: true },
      windowLayout: layouts,
      maxZIndex: newZ,
    })
  }, [getState, setState])

  const handleFileChange = useCallback(async (e: ReactChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const patch = await importProject(file)
      if (Object.keys(patch).length) setState(patch)
    } catch {
      return null
    }
    e.target.value = ''
    return null
  }, [setState])

  return (
    <Bar>
      <MenuRow>
        <MenuItem>File</MenuItem>
        <MenuItem>Edit</MenuItem>
        <MenuItem>Add</MenuItem>
        <MenuItem>Patterns</MenuItem>
        <MenuItem>View</MenuItem>
        <MenuItem>Options</MenuItem>
        <MenuItem>Tools</MenuItem>
      </MenuRow>
      <ToolRow>
        <Button $active={isPlaying} title="Play" onClick={handlePlay}>▶</Button>
        <Button title="Stop" onClick={handleStop}>■</Button>
        <Button title="Pause" onClick={handlePause}>❚❚</Button>
        <Button title="Record">●</Button>

        <Divider />

        <BpmControl>
          <Label>BPM</Label>
          <BpmInput
            type="text"
            inputMode="numeric"
            value={bpmText}
            onChange={handleBpmChange}
            onBlur={commitBpm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        </BpmControl>

        <Divider />

        <Position>
          <PosSegment>1</PosSegment>
          <span>:</span>
          <PosSegment>1</PosSegment>
          <span>:</span>
          <PosSegment>1</PosSegment>
        </Position>

        <Divider />

        <Button $active={patternMode} onClick={() => setState({ patternMode: true })}>
          PAT
        </Button>
        <Button $active={!patternMode} onClick={() => setState({ patternMode: false })}>
          SONG
        </Button>

        <Divider />

        <Button title="Metronome">♪</Button>
        <Button title="Swing">
          <Label style={{ margin: 0 }}>SWING</Label>
          <Value>{swing}%</Value>
        </Button>

        <Divider />

        <Button title="Snap">⚡</Button>
        <Button title="Keyboard">⌨</Button>

        <Divider />

        {windows.map((w) => (
          <Button
            key={w.id}
            $active={windowVisibility[w.id]}
            onClick={() => handleWindowToggle(w.id)}
            style={{ fontSize: '9px', padding: '2px 5px' }}
          >
            {w.label}
          </Button>
        ))}

        <Divider />

        <Label>Pattern</Label>
        {patterns.map((p) => (
          <Tab
            key={p.id}
            $active={p.id === currentPattern}
            onClick={() => setState({ currentPattern: p.id })}
          >
            {p.name}
          </Tab>
        ))}
        <AddBtn>+</AddBtn>

        <RightSection>
          <TimingIndicator />
          <Button title="Save project" onClick={handleSave}>SAVE</Button>
          <Button title="Load project" onClick={handleLoad}>LOAD</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Label>{patternName}</Label>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: `2px solid ${theme.panelBorder}`,
              background: theme.surface,
              cursor: 'pointer',
            }}
          />
        </RightSection>
      </ToolRow>
    </Bar>
  )
}
