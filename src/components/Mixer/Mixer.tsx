import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import {
  getChannelLevel,
  getMasterLevel,
  getReturnLevel,
  setMasterVolume,
} from '../../audio/engine'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Channel, ReturnTrack } from '../../store/types'

const SOLO_COLOR = '#f2c94c'
const ON_COLOR = '#6fcf8d'
const PAN_COLOR = '#d8d8d8'

interface MeterState {
  levels: Record<string, number>
  peaks: Record<string, number>
}

const EMPTY_METERS: MeterState = { levels: {}, peaks: {} }

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const formatDb = (vol: number): string => {
  if (vol <= 0) return '-∞ dB'
  return `${(20 * Math.log10(vol / 100)).toFixed(1)} dB`
}

const formatDbShort = (vol: number): string => {
  if (vol <= 0) return '-∞'
  return (20 * Math.log10(vol / 100)).toFixed(1)
}

const formatPan = (pan: number): string => {
  if (pan === 64) return 'C'
  const amount = Math.round((Math.abs(pan - 64) / 64) * 100)
  return `${pan < 64 ? 'L' : 'R'}${amount}`
}

const Container = styled.div`
  background: #141414;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  user-select: none;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 10px;
  min-height: 20px;
  background: linear-gradient(180deg, #262626, #1d1d1d);
  border-bottom: 1px solid ${theme.panelBorder};
  flex-shrink: 0;
  font-size: ${fontSize.xs};
  color: ${theme.textDim};
  white-space: nowrap;
  overflow: hidden;
`

const HeaderTitle = styled.span`
  color: ${theme.text};
  font-weight: 700;
  letter-spacing: 0.08em;
`

const Legend = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
`

const HeaderSpacer = styled.div`
  flex: 1;
`

const Strips = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: stretch;
  gap: 3px;
  padding: 4px 6px;
  overflow: auto;
`

const Group = styled.div`
  display: flex;
  align-items: stretch;
  gap: 3px;
  flex-shrink: 0;
`

const Divider = styled.div`
  width: 1px;
  margin: 2px 4px;
  background: ${theme.panelBorder};
  flex-shrink: 0;
`

const Strip = styled.div<{ $accent: string; $master?: boolean }>`
  width: ${({ $master }) => ($master ? '94px' : '80px')};
  min-width: ${({ $master }) => ($master ? '94px' : '80px')};
  min-height: 196px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  border-radius: 3px;
  border: 1px solid #2c2c2c;
  border-top: 2px solid ${({ $accent }) => $accent};
  background: linear-gradient(180deg, #242424 0%, #1b1b1b 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
`

const StripName = styled.div<{ $color: string; $muted?: boolean }>`
  height: 17px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 4px;
  border-radius: 2px;
  background: ${({ $color }) => $color};
  color: #0b0b0b;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: ${({ $muted }) => ($muted ? 0.35 : 1)};
`

const Knobs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
`

const KnobRow = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 1px;
  border-radius: 2px;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
`

const KnobRoot = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
`

const KnobMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
  min-width: 0;
  font-size: 8px;
  color: ${theme.textDim};
  letter-spacing: 0.04em;
`

const KnobValue = styled.span`
  color: ${theme.text};
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const About = styled.div<{ $compact?: boolean }>`
  height: ${({ $compact }) => ($compact ? '51px' : '78px')};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid #262626;
  border-radius: 2px;
  background: #191919;
  font-size: 8px;
  line-height: 1.1;
  color: ${theme.textDim};
  text-align: center;
  letter-spacing: 0.05em;
`

const FaderArea = styled.div`
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-height: 52px;
  padding: 3px 0;
`

const MeterShell = styled.div`
  width: 8px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  border-radius: 2px;
  border: 1px solid #000;
  background: #0a0a0a;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.9);
`

const MeterFill = styled.div<{ $value: number }>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${({ $value }) => clamp($value, 0, 100)}%;
  background: linear-gradient(
    to top,
    #379c5a 0%,
    #4fc96f 45%,
    #9fd94a 62%,
    #f2d33c 78%,
    #f29c3c 89%,
    #f05252 100%
  );
`

const MeterPeak = styled.div<{ $value: number }>`
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  bottom: ${({ $value }) => clamp($value, 0, 100)}%;
  background: #ececec;
  opacity: 0.8;
`

const FaderSlot = styled.div`
  position: relative;
  width: 22px;
  flex-shrink: 0;
  cursor: ns-resize;
  touch-action: none;
`

const FaderRail = styled.div`
  position: absolute;
  left: 50%;
  top: 7px;
  bottom: 7px;
  width: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: #0b0b0b;
  box-shadow: inset 0 0 0 1px #050505;
`

const FaderTravel = styled.div<{ $value: number }>`
  position: absolute;
  left: 50%;
  bottom: 7px;
  width: 4px;
  transform: translateX(-50%);
  height: calc((100% - 14px) * ${({ $value }) => clamp($value, 0, 100) / 100});
  border-radius: 2px;
  background: #3f3f3f;
`

const FaderCap = styled.div<{ $value: number; $color: string }>`
  position: absolute;
  left: 50%;
  bottom: calc((100% - 14px) * ${({ $value }) => clamp($value, 0, 100) / 100});
  transform: translateX(-50%);
  width: 22px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid #5a5a5a;
  background: linear-gradient(180deg, #4d4d4d 0%, #2b2b2b 55%, #363636 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);

  &::after {
    content: '';
    position: absolute;
    left: 3px;
    right: 3px;
    top: 6px;
    height: 2px;
    border-radius: 1px;
    background: ${({ $color }) => $color};
    opacity: 0.9;
  }
`

const Readout = styled.div`
  flex-shrink: 0;
  text-align: center;
  font-size: 8px;
  line-height: 1;
  color: ${theme.textDim};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
`

const ButtonRow = styled.div`
  display: flex;
  gap: 3px;
  flex-shrink: 0;
`

const StripBtn = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  min-width: 0;
  height: 16px;
  padding: 0;
  border-radius: 2px;
  border: 1px solid ${({ $active, $color }) => ($active ? $color : '#383838')};
  background: ${({ $active, $color }) => ($active ? $color : '#1c1c1c')};
  color: ${({ $active }) => ($active ? '#0b0b0b' : theme.textDim)};
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;

  &:hover {
    border-color: ${({ $active, $color }) => ($active ? $color : theme.textDim)};
    color: ${({ $active }) => ($active ? '#0b0b0b' : theme.text)};
  }
`

interface KnobProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  defaultValue?: number
  size?: number
  color?: string
  title?: string
}

function polarPoint(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: 16 + radius * Math.sin(rad), y: 16 - radius * Math.cos(rad) }
}

function arcPath(from: number, to: number, radius = 12): string {
  const start = polarPoint(from, radius)
  const end = polarPoint(to, radius)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function Knob({
  value,
  onChange,
  min = 0,
  max = 100,
  defaultValue = 0,
  size = 22,
  color = theme.accent,
  title,
}: KnobProps) {
  const ratio = max > min ? clamp((value - min) / (max - min), 0, 1) : 0
  const angle = -135 + ratio * 270
  const pointer = polarPoint(angle, 8)

  const startDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startValue = value
    const range = max - min

    const onMove = (ev: MouseEvent) => {
      const next = startValue + ((startY - ev.clientY) / 110) * range
      onChange(clamp(Math.round(next), min, max))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'ns-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <KnobRoot
      $size={size}
      title={title}
      onMouseDown={startDrag}
      onDoubleClick={(e) => {
        e.preventDefault()
        onChange(defaultValue)
      }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path
          d={arcPath(-135, 135)}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={arcPath(-135, Math.max(-134.9, angle))}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="10.5" fill="#242424" stroke="#141414" strokeWidth="1" />
        <line
          x1="16"
          y1="16"
          x2={pointer.x}
          y2={pointer.y}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </KnobRoot>
  )
}

interface FaderProps {
  value: number
  color: string
  onChange: (value: number) => void
}

function Fader({ value, color, onChange }: FaderProps) {
  const startDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const apply = (clientY: number) => {
      const ratio = 1 - (clientY - rect.top) / Math.max(1, rect.height)
      onChange(clamp(Math.round(ratio * 100), 0, 100))
    }

    const target = e.target as HTMLElement
    if (target.dataset.cap !== 'true') apply(e.clientY)

    const onMove = (ev: MouseEvent) => apply(ev.clientY)
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'ns-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <FaderSlot onMouseDown={startDrag}>
      <FaderRail />
      <FaderTravel $value={value} />
      <FaderCap $value={value} $color={color} data-cap="true" />
    </FaderSlot>
  )
}

function LevelMeter({ value, peak }: { value: number; peak: number }) {
  return (
    <MeterShell title={`${Math.round(value)}%`}>
      <MeterFill $value={value} />
      {peak > 1 && <MeterPeak $value={peak} />}
    </MeterShell>
  )
}

interface ChannelStripProps {
  channel: Channel
  level: number
  peak: number
  onUpdate: (id: number, patch: Partial<Channel>) => void
}

function ChannelStrip({ channel, level, peak, onUpdate }: ChannelStripProps) {
  return (
    <Strip $accent={channel.color}>
      <StripName $color={channel.color} $muted={channel.mute} title={channel.name}>
        {channel.name}
      </StripName>

      <Knobs>
        <KnobRow>
          <Knob
            value={channel.sendA}
            onChange={(value) => onUpdate(channel.id, { sendA: value })}
            color={theme.blue}
            title={`Send A — Reverb: ${channel.sendA}%`}
          />
          <KnobMeta>
            <span style={{ color: theme.blue }}>SEND A</span>
            <KnobValue>{formatDbShort(channel.sendA)}</KnobValue>
          </KnobMeta>
        </KnobRow>

        <KnobRow>
          <Knob
            value={channel.sendB}
            onChange={(value) => onUpdate(channel.id, { sendB: value })}
            color={theme.purple}
            title={`Send B — Delay: ${channel.sendB}%`}
          />
          <KnobMeta>
            <span style={{ color: theme.purple }}>SEND B</span>
            <KnobValue>{formatDbShort(channel.sendB)}</KnobValue>
          </KnobMeta>
        </KnobRow>

        <KnobRow>
          <Knob
            value={channel.pan}
            min={0}
            max={127}
            defaultValue={64}
            onChange={(value) => onUpdate(channel.id, { pan: value })}
            color={PAN_COLOR}
            title={`Pan: ${formatPan(channel.pan)}`}
          />
          <KnobMeta>
            <span>PAN</span>
            <KnobValue>{formatPan(channel.pan)}</KnobValue>
          </KnobMeta>
        </KnobRow>
      </Knobs>

      <FaderArea>
        <LevelMeter value={level} peak={peak} />
        <Fader
          value={channel.vol}
          color={channel.color}
          onChange={(value) => onUpdate(channel.id, { vol: value })}
        />
      </FaderArea>

      <Readout>{formatDb(channel.vol)}</Readout>

      <ButtonRow>
        <StripBtn
          type="button"
          $active={channel.solo}
          $color={SOLO_COLOR}
          aria-pressed={channel.solo}
          onClick={() => onUpdate(channel.id, { solo: !channel.solo })}
          title="Solo"
        >
          S
        </StripBtn>
        <StripBtn
          type="button"
          $active={!channel.mute}
          $color={ON_COLOR}
          aria-pressed={!channel.mute}
          onClick={() => onUpdate(channel.id, { mute: !channel.mute })}
          title={channel.mute ? 'Включить трек' : 'Заглушить трек (Track Activator)'}
        >
          ON
        </StripBtn>
      </ButtonRow>
    </Strip>
  )
}

interface ReturnStripProps {
  track: ReturnTrack
  level: number
  peak: number
  onUpdate: (id: number, patch: Partial<ReturnTrack>) => void
}

function ReturnStrip({ track, level, peak, onUpdate }: ReturnStripProps) {
  return (
    <Strip $accent={track.color}>
      <StripName $color={track.color} $muted={track.mute} title={track.name}>
        {track.name}
      </StripName>

      <Knobs>
        <KnobRow>
          <Knob
            value={track.pan}
            min={0}
            max={127}
            defaultValue={64}
            onChange={(value) => onUpdate(track.id, { pan: value })}
            color={PAN_COLOR}
            title={`Pan: ${formatPan(track.pan)}`}
          />
          <KnobMeta>
            <span>PAN</span>
            <KnobValue>{formatPan(track.pan)}</KnobValue>
          </KnobMeta>
        </KnobRow>

        <About $compact>
          <span style={{ color: track.color, fontWeight: 700 }}>
            {track.kind === 'reverb' ? 'REVERB' : 'DELAY'}
          </span>
          <span>{track.kind === 'reverb' ? 'CONVOLUTION' : 'TEMPO SYNC'}</span>
          <span>{track.kind === 'reverb' ? 'SIZE 2.4 s' : 'TIME 3/16'}</span>
        </About>
      </Knobs>

      <FaderArea>
        <LevelMeter value={level} peak={peak} />
        <Fader
          value={track.vol}
          color={track.color}
          onChange={(value) => onUpdate(track.id, { vol: value })}
        />
      </FaderArea>

      <Readout>{formatDb(track.vol)}</Readout>

      <ButtonRow>
        <StripBtn
          type="button"
          $active={!track.mute}
          $color={ON_COLOR}
          aria-pressed={!track.mute}
          onClick={() => onUpdate(track.id, { mute: !track.mute })}
          title={track.mute ? 'Включить return' : 'Заглушить return'}
        >
          ON
        </StripBtn>
      </ButtonRow>
    </Strip>
  )
}

interface MasterStripProps {
  volume: number
  level: number
  peak: number
  onChange: (value: number) => void
}

function MasterStrip({ volume, level, peak, onChange }: MasterStripProps) {
  return (
    <Strip $accent={theme.accentBright} $master>
      <StripName $color={theme.accent}>Master</StripName>

      <About>
        <span style={{ color: theme.accentBright, fontWeight: 700 }}>STEREO OUT</span>
        <span>OUTPUT 1 / 2</span>
        <span>MASTER BUS</span>
        <span>PEAK {peak > 1 ? `${((peak / 100) * 60 - 60).toFixed(1)} dB` : '-∞'}</span>
      </About>

      <FaderArea>
        <LevelMeter value={level} peak={peak} />
        <Fader value={volume} color={theme.accentBright} onChange={onChange} />
      </FaderArea>

      <Readout>{formatDb(volume)}</Readout>

      <ButtonRow>
        <StripBtn
          type="button"
          $active={false}
          $color={theme.accent}
          onClick={() => onChange(100)}
          title="Установить 0 дБ"
        >
          0 dB
        </StripBtn>
      </ButtonRow>
    </Strip>
  )
}

export default function Mixer() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const [meters, setMeters] = useState<MeterState>(EMPTY_METERS)
  const peaksRef = useRef<Record<string, number>>({})
  const activeRef = useRef(false)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  useEffect(() => {
    let raf = 0
    let last = 0

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick)
      if (time - last < 33) return
      last = time

      const state = getState()
      const levels: Record<string, number> = {}
      state.channels.forEach((channel) => {
        levels[`c${channel.id}`] = getChannelLevel(channel.id)
      })
      state.returnTracks.forEach((track) => {
        levels[`r${track.id}`] = getReturnLevel(track.id)
      })
      levels.master = getMasterLevel()

      const previous = peaksRef.current
      const peaks: Record<string, number> = {}
      Object.keys(levels).forEach((key) => {
        const value = levels[key]
        const prev = previous[key] ?? 0
        peaks[key] = value >= prev ? value : Math.max(0, prev - 2.5)
      })
      peaksRef.current = peaks

      const active =
        Object.values(levels).some((value) => value > 0.4) ||
        Object.values(peaks).some((value) => value > 0.4)
      if (active || activeRef.current) {
        activeRef.current = active
        setMeters({ levels, peaks })
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getState])

  const updateChannel = useCallback(
    (id: number, patch: Partial<Channel>) => {
      const state = getState()
      state.setState({
        channels: state.channels.map((channel) =>
          channel.id === id ? { ...channel, ...patch } : channel,
        ),
      })
    },
    [getState],
  )

  const updateReturn = useCallback(
    (id: number, patch: Partial<ReturnTrack>) => {
      const state = getState()
      state.setState({
        returnTracks: state.returnTracks.map((track) =>
          track.id === id ? { ...track, ...patch } : track,
        ),
      })
    },
    [getState],
  )

  const updateMaster = useCallback(
    (value: number) => {
      const next = clamp(value, 0, 100) / 100
      getState().setState({ masterVolume: next })
      setMasterVolume(next)
    },
    [getState],
  )

  const state = getState()
  const { channels, returnTracks, masterVolume } = state

  const anySolo = channels.some((channel) => channel.solo)

  return (
    <Container>
      <Header>
        <HeaderTitle>MIXER</HeaderTitle>
        <Legend $color={theme.blue}>SEND A · REVERB</Legend>
        <Legend $color={theme.purple}>SEND B · DELAY</Legend>
        {anySolo && <Legend $color={SOLO_COLOR}>SOLO ACTIVE</Legend>}
        <HeaderSpacer />
        <span>Drag knobs / faders · double-click knob to reset</span>
      </Header>

      <Strips>
        <Group>
          {channels.map((channel) => (
            <ChannelStrip
              key={channel.id}
              channel={channel}
              level={meters.levels[`c${channel.id}`] ?? 0}
              peak={meters.peaks[`c${channel.id}`] ?? 0}
              onUpdate={updateChannel}
            />
          ))}
        </Group>

        <Divider />

        <Group>
          {returnTracks.map((track) => (
            <ReturnStrip
              key={track.id}
              track={track}
              level={meters.levels[`r${track.id}`] ?? 0}
              peak={meters.peaks[`r${track.id}`] ?? 0}
              onUpdate={updateReturn}
            />
          ))}
        </Group>

        <Divider />

        <Group>
          <MasterStrip
            volume={Math.round(masterVolume * 100)}
            level={meters.levels.master ?? 0}
            peak={meters.peaks.master ?? 0}
            onChange={updateMaster}
          />
        </Group>
      </Strips>
    </Container>
  )
}
