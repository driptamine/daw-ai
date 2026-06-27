import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useEffect, useState, useCallback } from 'react'

const Container = styled.div`
  background: ${theme.panelBg};
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`

const Strips = styled.div`
  display: flex;
  flex: 1;
  overflow-x: auto;
  padding: 4px;
  gap: 2px;
`

const Strip = styled.div`
  background: ${theme.mixerStrip};
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  max-width: 44px;
  position: relative;
`

const StripName = styled.div`
  font-size: 8px;
  color: ${theme.text};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  padding: 1px 2px;
  background: ${({ $color }) => $color || theme.surface};
  border-radius: 2px;
  color: #000;
  font-weight: 600;
`

const FaderTrack = styled.div`
  width: 4px;
  height: 80px;
  background: #2a2a2a;
  border-radius: 2px;
  position: relative;
  cursor: pointer;
`

const FaderThumb = styled.div`
  position: absolute;
  bottom: ${({ $val }) => ($val / 100) * 70 + 4}px;
  left: -3px;
  width: 10px;
  height: 14px;
  background: ${theme.accent};
  border-radius: 2px;
  cursor: grab;
  border: 1px solid ${theme.accentBright};
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);

  &:hover {
    background: ${theme.accentBright};
  }

  &:active {
    cursor: grabbing;
  }
`

const Meter = styled.div`
  width: 4px;
  height: 24px;
  background: #1a1a1a;
  border-radius: 1px;
  position: relative;
  overflow: hidden;
`

const MeterFill = styled.div`
  position: absolute;
  bottom: 0;
  width: 100%;
  height: ${({ $val }) => Math.min($val * 0.8, 100)}%;
  background: ${({ $val }) => ($val > 80 ? theme.red : $val > 60 ? theme.yellow : theme.green)};
  border-radius: 1px;
`

const StripLabel = styled.span`
  font-size: 8px;
  color: ${theme.textDim};
  text-align: center;
`

const StripBtn = styled.button`
  background: ${({ $active }) => ($active ? theme.accent : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  color: ${({ $active }) => ($active ? '#000' : theme.textDim)};
  border-radius: 2px;
  padding: 1px 4px;
  font-size: 8px;
  cursor: pointer;

  &:hover {
    border-color: ${theme.textDim};
  }
`

const MasterStrip = styled.div`
  background: #1a1a1a;
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  max-width: 44px;
`

export default function Mixer() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { mixerChannels } = state

  const handleFader = useCallback((idx, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const pct = Math.max(0, Math.min(100, Math.round((1 - y / rect.height) * 100)))
    const newChannels = mixerChannels.map((c, i) =>
      i === idx ? { ...c, vol: pct } : c,
    )
    getState().setState({ mixerChannels: newChannels })
  }, [mixerChannels, getState])

  const toggleMute = useCallback((idx) => {
    const newChannels = mixerChannels.map((c, i) =>
      i === idx ? { ...c, mute: !c.mute } : c,
    )
    getState().setState({ mixerChannels: newChannels })
  }, [mixerChannels, getState])

  const toggleSolo = useCallback((idx) => {
    const newChannels = mixerChannels.map((c, i) =>
      i === idx ? { ...c, solo: !c.solo } : c,
    )
    getState().setState({ mixerChannels: newChannels })
  }, [mixerChannels, getState])

  return (
    <Container>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>Master</span>
      </div>

      <Strips>
        {mixerChannels.map((ch, idx) => (
          <Strip key={ch.id}>
            <StripName $color={ch.color}>{ch.name}</StripName>
            <div style={{ display: 'flex', gap: 2 }}>
              <StripBtn $active={ch.mute} onClick={() => toggleMute(idx)}>M</StripBtn>
              <StripBtn $active={ch.solo} onClick={() => toggleSolo(idx)}>S</StripBtn>
            </div>
            <Meter>
              <MeterFill $val={Math.random() * 40 + 10} />
            </Meter>
            <FaderTrack onClick={(e) => handleFader(idx, e)}>
              <FaderThumb $val={ch.vol} />
            </FaderTrack>
            <StripLabel>{ch.vol}</StripLabel>
          </Strip>
        ))}

        <MasterStrip>
          <StripName $color="#686abb">Master</StripName>
          <Meter>
            <MeterFill $val={45} />
          </Meter>
          <FaderTrack>
            <FaderThumb $val={85} />
          </FaderTrack>
          <StripLabel>85</StripLabel>
        </MasterStrip>
      </Strips>
    </Container>
  )
}
