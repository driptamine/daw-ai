import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { playChannel } from '../../audio/engine'
import { PRESET_OPTIONS } from '../../audio/presets'
import { useEffect, useState, useCallback } from 'react'

const Container = styled.div`
  background: ${theme.panelBg};
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`

const StepNumbers = styled.div`
  display: flex;
  gap: 1px;
  padding: 4px 8px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
  padding-left: 48px;
`

const StepNum = styled.div<{ $beat: boolean; $current: boolean }>`
  width: 24px;
  text-align: center;
  font-size: ${fontSize.xs};
  color: ${theme.textDim};
  font-weight: ${({ $beat }) => ($beat ? 700 : 400)};
  color: ${({ $beat }) => ($beat ? theme.text : theme.textDim)};
  background: ${({ $current }) => ($current ? theme.accentDim : 'transparent')};
  border-radius: 2px;
`

const ScrollArea = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
`

const Row = styled.div<{ $even: boolean }>`
  display: flex;
  align-items: center;
  height: 32px;
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${({ $even }) => ($even ? theme.panelBg : theme.surface)};
  position: relative;

  &:hover {
    background: #252525;
  }
`

const ChannelName = styled.div`
  width: 48px;
  padding: 0 6px;
  font-size: ${fontSize.xs};
  color: ${theme.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  cursor: pointer;

  &:hover {
    color: ${theme.accent};
  }
`

const Steps = styled.div`
  display: flex;
  gap: 1px;
  flex: 1;
  padding: 2px 4px;
`

const Step = styled.div<{ $active: boolean; $color: string; $muted: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 3px;
  background: ${({ $active, $color }) => ($active ? $color : '#2a2a2a')};
  cursor: pointer;
  border: 1px solid ${({ $active, $color }) => ($active ? $color : '#333')};
  transition: all 0.05s;
  opacity: ${({ $muted }) => ($muted ? 0.3 : 1)};

  &:hover {
    border-color: ${theme.textDim};
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.9);
  }
`

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  flex-shrink: 0;
`

const Level = styled.div`
  width: 32px;
  height: 4px;
  background: #2a2a2a;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
`

const LevelFill = styled.div<{ $val: number }>`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${({ $val }) => $val}%;
  background: ${theme.accent};
  border-radius: 2px;
`

const ChanLabel = styled.span`
  font-size: ${fontSize.xs};
  color: ${theme.textDim};
  width: 20px;
  text-align: right;
`

const PresetSelect = styled.select`
  background: ${theme.surface};
  color: ${theme.text};
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  font-size: 8px;
  width: 60px;
  padding: 1px 2px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${theme.accent};
  }
`

export default function ChannelRack() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { channels, currentStep } = state

  const handleToggleStep = useCallback((chIdx: number, stepIdx: number) => {
    const ch = channels[chIdx]
    const newSteps = [...ch.steps]
    const turningOn = !newSteps[stepIdx]
    newSteps[stepIdx] = turningOn ? 1 : 0
    const newChannels = channels.map((c, i) =>
      i === chIdx ? { ...c, steps: newSteps } : c,
    )
    const s = getState()
    s.setState({ channels: newChannels })
    if (turningOn) playChannel(ch.preset || 'synth', ((ch.vol ?? 100) / 100) * 0.9, undefined, ch.id)
  }, [channels, getState])

  const handlePresetChange = useCallback((chIdx: number, presetId: string) => {
    const newChannels = channels.map((c, i) =>
      i === chIdx ? { ...c, preset: presetId } : c,
    )
    getState().setState({ channels: newChannels })
    playChannel(presetId, 0.9, undefined, channels[chIdx]?.id)
  }, [channels, getState])

  const handleMuteToggle = useCallback((chIdx: number) => {
    const newChannels = channels.map((c, i) =>
      i === chIdx ? { ...c, mute: !c.mute } : c,
    )
    getState().setState({ channels: newChannels })
  }, [channels, getState])

  return (
    <Container>
      <StepNumbers>
        {Array.from({ length: 16 }, (_, i) => (
          <StepNum key={i} $beat={(i + 1) % 4 === 0} $current={i === currentStep % 16}>
            {i + 1}
          </StepNum>
        ))}
      </StepNumbers>

      <ScrollArea>
        {channels.map((ch, chIdx) => (
          <Row key={ch.id} $even={chIdx % 2 === 0}>
            <ChannelName onClick={() => handleMuteToggle(chIdx)}>
              {ch.mute && '✕ '}{ch.name}
            </ChannelName>
            <Steps>
              {ch.steps.map((active, stepIdx) => (
                <Step
                  key={stepIdx}
                  $active={active !== 0}
                  $color={ch.color}
                  $muted={ch.mute}
                  onClick={() => handleToggleStep(chIdx, stepIdx)}
                />
              ))}
            </Steps>
            <Controls>
              <PresetSelect
                value={ch.preset || 'synth'}
                onChange={(e) => handlePresetChange(chIdx, e.target.value)}
              >
                {PRESET_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </PresetSelect>
              <ChanLabel>{ch.vol}</ChanLabel>
              <Level onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const pct = ((e.clientX - rect.left) / rect.width) * 100
                const newVol = Math.max(0, Math.min(100, Math.round(pct)))
                const newChannels = channels.map((c, i) =>
                  i === chIdx ? { ...c, vol: newVol } : c,
                )
                getState().setState({ channels: newChannels })
              }}>
                <LevelFill $val={ch.vol} />
              </Level>
            </Controls>
          </Row>
        ))}
      </ScrollArea>
    </Container>
  )
}
