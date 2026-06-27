import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useState, useEffect, useCallback } from 'react'

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

const Button = styled.button`
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

const Tab = styled.button`
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

export default function TopBar() {
  const { getState, setState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { bpm, patternMode, swing, currentPattern, patterns, windowVisibility } = state
  const patternName = patterns.find((p) => p.id === currentPattern)?.name || `Pattern ${currentPattern}`

  const handleBpmChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 20 && val <= 999) {
      setState({ bpm: val })
    }
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
        <Button $active title="Play">▶</Button>
        <Button title="Stop">■</Button>
        <Button title="Pause">❚❚</Button>
        <Button title="Record">●</Button>

        <Divider />

        <BpmControl>
          <Label>BPM</Label>
          <BpmInput type="text" value={bpm} onChange={handleBpmChange} />
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
            onClick={() => setState({ windowVisibility: { ...windowVisibility, [w.id]: !windowVisibility[w.id] } })}
            style={{ fontSize: '9px', padding: '2px 5px' }}
          >
            {w.label}
          </Button>
        ))}

        <Divider />

        <Label>Pattern</Label>
        {patterns.map((p) => (
          <Tab key={p.id} $active={p.id === currentPattern}>
            {p.name}
          </Tab>
        ))}
        <AddBtn>+</AddBtn>

        <RightSection>
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
