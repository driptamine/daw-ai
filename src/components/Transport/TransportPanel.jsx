import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useState, useEffect, useCallback } from 'react'

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: ${theme.transportBg};
  border-bottom: 1px solid ${theme.panelBorder};
  height: 44px;
`

const Button = styled.button`
  background: ${({ $active }) => ($active ? theme.accent : theme.surface)};
  color: ${({ $active }) => ($active ? '#000' : theme.text)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 4px 10px;
  font-size: ${fontSize.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 32px;
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
  height: 24px;
  background: ${theme.panelBorder};
  margin: 0 4px;
`

const Label = styled.span`
  color: ${theme.textDim};
  font-size: ${fontSize.xs};
  margin-right: 4px;
`

const Value = styled.span`
  color: ${theme.textBright};
  font-size: ${fontSize.md};
  font-weight: 600;
  min-width: 32px;
  text-align: center;
`

const Knob = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid ${theme.panelBorder};
  background: ${theme.surface};
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    content: '';
    position: absolute;
    width: 2px;
    height: 7px;
    background: ${theme.text};
    border-radius: 1px;
    transform-origin: bottom center;
    transform: ${({ $angle }) => `rotate(${$angle || 0}deg)`};
    bottom: 4px;
  }

  &:hover {
    border-color: ${theme.textDim};
  }
`

const BpmControl = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const Input = styled.input`
  background: ${theme.surface};
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  color: ${theme.textBright};
  font-size: ${fontSize.md};
  font-weight: 600;
  width: 48px;
  text-align: center;
  padding: 2px 4px;
  outline: none;

  &:focus {
    border-color: ${theme.accent};
  }
`

export default function TransportPanel() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { bpm, patternMode, swing, currentPattern, patterns } = state
  const patternName = patterns.find((p) => p.id === currentPattern)?.name || `Pattern ${currentPattern}`
  const setState = getState().setState

  const handleBpmChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 20 && val <= 999) {
      setState({ bpm: val })
    }
  }, [setState])

  return (
    <Container>
      <Button $active title="Play">
        ▶
      </Button>
      <Button title="Stop">■</Button>
      <Button title="Pause">❚❚</Button>
      <Button title="Record">●</Button>

      <Divider />

      <BpmControl>
        <Label>BPM</Label>
        <Input type="text" value={bpm} onChange={handleBpmChange} />
      </BpmControl>

      <Divider />

      <Button
        $active={patternMode}
        title="Pattern mode"
        onClick={() => setState({ patternMode: true })}
      >
        PAT
      </Button>
      <Button
        $active={!patternMode}
        title="Song mode"
        onClick={() => setState({ patternMode: false })}
      >
        SONG
      </Button>

      <Divider />

      <Button title="Metronome">♪</Button>
      <Button title="Swing">
        <Label style={{ margin: 0 }}>SWING</Label>
        <Value>{swing}%</Value>
      </Button>

      <Divider />

      <Button title="Snap to grid">⚡</Button>
      <Button title="Piano roll">⌨</Button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Label>{patternName}</Label>
        <Knob $angle={45} />
      </div>
    </Container>
  )
}
