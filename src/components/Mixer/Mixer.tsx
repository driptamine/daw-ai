import { styled } from '@linaria/react'
import { useStore } from '../../store/useStore'
import { getChannelLevel, getMasterLevel, getReturnLevel, resumeAudio, setMasterVolume, stopAllAudio } from '../../audio/engine'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Channel, ReturnTrack } from '../../store/types'

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const formatDb = (value: number): string => value <= 0 ? '−∞ dB' : `${(20 * Math.log10(value / 100)).toFixed(1)} dB`
const formatPan = (value: number): string => value === 64 ? 'C' : `${value < 64 ? 'L' : 'R'}${Math.round(Math.abs(value - 64) / 64 * 100)}`
interface MeterState { levels: Record<string, number>; peaks: Record<string, number> }
const EMPTY_METERS: MeterState = { levels: {}, peaks: {} }

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #b8b8b5;
  color: #292927;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  user-select: none;
  border: 5px solid #777773;
  border-radius: 7px;
  color-scheme: light;
`
const Overview = styled.div`
  position: relative;
  height: 22px;
  margin: 1px 2px 9px;
  flex-shrink: 0;
  border: 1px solid #8b8b85;
  background: repeating-linear-gradient(90deg, transparent 0 7.6%, #92928b 7.6% 7.7%), #d0d0c8;
  overflow: hidden;
`
const OverviewClip = styled.div`
  position: absolute;
  height: 2px;
  opacity: 0.8;
`
const Strips = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`
const ChannelColumns = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  scrollbar-color: #353532 #b3b3b0;
  scrollbar-width: auto;
  &::-webkit-scrollbar { height: 14px; width: 10px; }
  &::-webkit-scrollbar-track { background: #b3b3b0; }
  &::-webkit-scrollbar-thumb { background: #353532; border: 3px solid #b3b3b0; border-radius: 0; }
`
const Strip = styled.div<{ $master?: boolean }>`
  display: flex;
  flex-direction: column;
  flex: ${({ $master }) => $master ? '0 0 100px' : '1 0 86px'};
  min-width: 86px;
  min-height: 540px;
  border-right: 3px solid #888885;
  background: #bdbdbb;
  position: relative;
  border-left: ${({ $master }) => $master ? '3px solid #888885' : 'none'};
`
const StripName = styled.div<{ $color?: string }>`
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 5px;
  border-bottom: 3px solid #8c8c88;
  background: ${({ $color }) => $color || '#c2c2c0'};
  font-size: 12px;
  font-weight: 700;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`
const Scenes = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 240px;
  background: #c7c7c5;
`
const Slot = styled.div`
  flex: 1;
  min-height: 20px;
  display: flex;
  align-items: center;
  padding: 1px 3px;
  border-bottom: 2px solid #a1a19d;
  overflow: hidden;
`
const Square = styled.span`
  display: block;
  width: 10px;
  height: 10px;
  border: 1.5px solid #8b8b85;
  margin-left: 2px;
`
const ClipLaunch = styled.button<{ $color: string }>`
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 15px;
  padding: 0;
  border: 1px solid #777772;
  background: ${({ $color }) => $color};
  font: bold 10px Arial, sans-serif;
  color: #292927;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
  &:hover { filter: brightness(1.12); }
`
const Triangle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 100%;
  flex-shrink: 0;
  border-right: 1px solid #7d7d76;
  background: #d2d2cb;
  color: #66665f;
  font-size: 12px;
`
const StopRow = styled.div`
  display: flex;
  align-items: center;
  height: 27px;
  flex-shrink: 0;
  border-top: 3px solid #858581;
  border-bottom: 2px solid #888884;
  padding: 0 5px;
  gap: 7px;
  font-size: 10px;
  font-weight: 700;
`
const StopButton = styled.button`
  border: 1px solid #888881;
  width: 11px;
  height: 11px;
  background: #b6b6b0;
  cursor: pointer;
  flex-shrink: 0;
  &:hover { background: #e4e4db; }
`
const Sends = styled.div`
  height: 77px;
  flex-shrink: 0;
  position: relative;
  border-bottom: 2px solid #888884;
`
const SendsLabel = styled.span`
  position: absolute;
  top: 5px;
  right: 8px;
  font-size: 11px;
  font-weight: 700;
`
const KnobRoot = styled.div`
  width: 38px;
  height: 38px;
  position: relative;
  cursor: ns-resize;
  touch-action: none;
  flex-shrink: 0;
  &:focus-visible { outline: 1px solid #777; }
`
const KnobLetter = styled.span`
  position: absolute;
  bottom: 0;
  right: 3px;
  font-size: 11px;
  font-style: italic;
  font-weight: 700;
  pointer-events: none;
`
const PostTag = styled.span`
  background: #edf52d;
  border: 1px solid #9f9f55;
  padding: 0 2px;
  font-size: 10px;
  font-weight: 700;
`
const Lower = styled.div`
  display: flex;
  position: relative;
  height: 143px;
  flex-shrink: 0;
  padding: 4px 7px 4px 5px;
  gap: 4px;
`
const Controls = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
  flex-shrink: 0;
  gap: 4px;
`
const Activator = styled.button<{ $active: boolean }>`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid #89897c;
  background: ${({ $active }) => $active ? '#f1ff27' : '#a9a9a4'};
  box-shadow: inset 0 0 0 1px #ffffff33;
  color: #25251e;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
`
const SmallButton = styled.button<{ $active?: boolean }>`
  width: 30px;
  height: 17px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid #898984;
  border-radius: 0;
  background: ${({ $active }) => $active ? '#88bed9' : '#b9b9b4'};
  color: #292927;
  font: 11px Arial, sans-serif;
  line-height: 1;
  cursor: pointer;
  &:hover { border-color: #4d4d47; }
`
const Meter = styled.div`
  position: relative;
  width: 15px;
  min-height: 100%;
  flex-shrink: 0;
  background: linear-gradient(90deg, #11120e 0 44%, #9a9a8f 44% 53%, #11120e 53%);
  border: 1px solid #82827a;
  overflow: hidden;
`
const MeterFill = styled.div<{ $value: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${({ $value }) => clamp($value, 0, 100)}%;
  background: repeating-linear-gradient(to top, transparent 0 3px, #0004 3px 4px), linear-gradient(to top, #46b72e 0%, #b2d546 75%, #f0d03b 90%, #e36836 100%);
  &::after { content: ''; position: absolute; left: 45%; width: 2px; top: 0; bottom: 0; background: #333; }
`
const Peak = styled.div<{ $value: number }>`
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  bottom: ${({ $value }) => clamp($value, 0, 99)}%;
  background: #cbec80;
`
const FaderSlot = styled.div`
  position: relative;
  flex: 1;
  min-width: 11px;
  cursor: ns-resize;
  touch-action: none;
`
const FaderCap = styled.div<{ $value: number }>`
  position: absolute;
  left: 0;
  bottom: calc(4px + (100% - 12px) * ${({ $value }) => clamp($value, 0, 100) / 100});
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right: 9px solid #71716a;
  &::after { content: ''; position: absolute; top: -3px; left: 3px; border-top: 3px solid transparent; border-bottom: 3px solid transparent; border-right: 5px solid #c8c8be; }
`

function Knob({ value, onChange, max = 100, defaultValue = 0, letter, color = '#363630', title, disabled = false }: {
  value: number; onChange?: (value: number) => void; max?: number; defaultValue?: number; letter?: string; color?: string; title: string; disabled?: boolean
}) {
  const angle = -135 + clamp(value / max, 0, 1) * 270
  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled || !onChange || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startY = event.clientY
    const onMove = (move: MouseEvent) => onChange(clamp(Math.round(value + (startY - move.clientY) * max / 110), 0, max))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return <KnobRoot role="slider" tabIndex={disabled ? -1 : 0} aria-label={title} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-disabled={disabled} title={title}
    style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : undefined }} onMouseDown={startDrag}
    onDoubleClick={() => onChange?.(defaultValue)} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); onChange?.(clamp(value + (event.key === 'ArrowUp' ? 1 : -1), 0, max)) } }}>
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
      <path d="M 9 30 A 15 15 0 1 1 29 30" fill="none" stroke={disabled ? '#74746c' : color} strokeWidth="2.4" />
      <line x1="19" y1="19" x2="19" y2="6" stroke={color} strokeWidth="2.2" transform={`rotate(${angle} 19 19)`} />
    </svg>
    {letter && <KnobLetter>{letter}</KnobLetter>}
  </KnobRoot>
}

function Fader({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const apply = (y: number) => onChange(clamp(Math.round((1 - (y - rect.top) / rect.height) * 100), 0, 100))
    apply(event.clientY)
    const onMove = (move: MouseEvent) => apply(move.clientY)
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return <FaderSlot role="slider" tabIndex={0} aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} title={formatDb(value)}
    onMouseDown={startDrag} onDoubleClick={() => onChange(100)} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); onChange(clamp(value + (event.key === 'ArrowUp' ? 1 : -1), 0, 100)) } }}>
    <FaderCap $value={value} />
  </FaderSlot>
}

function LevelMeter({ level, peak }: { level: number; peak: number }) {
  return <Meter title={`${Math.round(level)}%`}><MeterFill $value={level} />{peak > 0 && <Peak $value={peak} />}</Meter>
}

export default function Mixer() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null)
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

  const sceneBars = [...new Set([...state.playlistClips, ...state.audioClips].map((clip) => clip.startBar))].sort((a, b) => a - b)
  const rows = Array.from({ length: Math.max(12, sceneBars.length) }, (_, index) => sceneBars[index])
  const stop = () => { getState().setState({ isPlaying: false }); stopAllAudio() }
  const launch = (bar: number, patternId?: number) => {
    resumeAudio()
    getState().setState({ playStart: Math.round(bar * 16), patternMode: false, isPlaying: true, ...(patternId !== undefined ? { currentPattern: patternId } : {}) })
  }

  return <Container aria-label="Mixer">
    <Overview aria-hidden="true">
      {[...state.playlistClips, ...state.audioClips].map((clip) => <OverviewClip key={`${'assetId' in clip ? 'a' : 'p'}${clip.id}`} style={{ left: `${clip.startBar / state.playlistLength * 100}%`, width: `${clip.lengthBars / state.playlistLength * 100}%`, top: 2 + clip.track % 5 * 3, background: 'color' in clip ? clip.color : channels[clip.track]?.color }} />)}
    </Overview>
    <Strips>
      <ChannelColumns>
      {channels.map((channel, index) => <Strip key={channel.id} style={{ boxShadow: selectedChannel === channel.id ? 'inset 0 0 0 1px #f3f825' : undefined }}>
        <StripName $color={channel.color} title={channel.name}>{channel.name}</StripName>
        <Scenes>{rows.map((bar, row) => {
          const patternClip = state.playlistClips.find((clip) => clip.track === index && clip.startBar === bar)
          const audioClip = state.audioClips.find((clip) => clip.track === index && clip.startBar === bar)
          const name = audioClip?.name ?? state.patterns.find((pattern) => pattern.id === patternClip?.patternId)?.name
          return <Slot key={row}>{bar !== undefined && (patternClip || audioClip) ? <ClipLaunch $color={audioClip?.color ?? channel.color} title={`Воспроизвести аранжировку с такта ${bar + 1}: ${name}`} onClick={() => launch(bar, patternClip?.patternId)}><Triangle>▷</Triangle><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span></ClipLaunch> : <Square />}</Slot>
        })}</Scenes>
        <StopRow><StopButton title="Остановить воспроизведение" aria-label="Stop playback" onClick={stop} /><span style={{ flex: 1, textAlign: 'center', color: '#696961' }}>│</span></StopRow>
        <Sends><SendsLabel>Sends</SendsLabel>
          <div style={{ position: 'absolute', top: 2, left: 4 }}><Knob value={channel.sendA} onChange={(value) => updateChannel(channel.id, { sendA: value })} letter="A" color={channel.sendA > 0 ? '#d78b48' : '#363630'} title={`Send A · Reverb: ${channel.sendA}%`} /></div>
          <div style={{ position: 'absolute', bottom: 2, right: 7 }}><Knob value={channel.sendB} onChange={(value) => updateChannel(channel.id, { sendB: value })} letter="B" color={channel.sendB > 0 ? '#d78b48' : '#363630'} title={`Send B · Delay: ${channel.sendB}%`} /></div>
        </Sends>
        <Lower><Controls>
          <div style={{ position: 'relative' }}><span style={{ position: 'absolute', top: -4, left: 14, color: channel.pan === 64 ? '#74746d' : '#d78b48', fontSize: 12 }}>▼</span><Knob value={channel.pan} max={127} defaultValue={64} onChange={(value) => updateChannel(channel.id, { pan: value })} title={`Pan: ${formatPan(channel.pan)}`} /></div>
          <Activator $active={!channel.mute} aria-pressed={!channel.mute} title="Track Activator" onClick={() => updateChannel(channel.id, { mute: !channel.mute })}>{index + 1}</Activator>
          <SmallButton $active={channel.solo} aria-pressed={channel.solo} title="Solo" onClick={() => updateChannel(channel.id, { solo: !channel.solo })}>S</SmallButton>
          <SmallButton $active={selectedChannel === channel.id} aria-pressed={selectedChannel === channel.id} title="Выбрать канал" onClick={() => setSelectedChannel(channel.id)}>●</SmallButton>
        </Controls><LevelMeter level={meters.levels[`c${channel.id}`] ?? 0} peak={meters.peaks[`c${channel.id}`] ?? 0} /><Fader value={channel.vol} onChange={(value) => updateChannel(channel.id, { vol: value })} /></Lower>
      </Strip>)}
      {returnTracks.map((track, index) => <Strip key={`r${track.id}`}>
        <StripName>{String.fromCharCode(65 + index)} {track.name.replace(/^[A-Z] /, '')}</StripName>
        <Scenes>{rows.map((_, row) => <Slot key={row} />)}</Scenes>
        <StopRow />
        <Sends><SendsLabel>Sends</SendsLabel><div style={{ position: 'absolute', top: 2, left: 4 }}><Knob value={0} letter="A" disabled title="Send A" /></div><div style={{ position: 'absolute', bottom: 2, right: 7 }}><Knob value={0} letter="B" disabled title="Send B" /></div></Sends>
        <Lower><Controls><div style={{ position: 'relative' }}><span style={{ position: 'absolute', top: -4, left: 14, color: '#d78b48', fontSize: 12 }}>▼</span><Knob value={track.pan} max={127} defaultValue={64} onChange={(value) => updateReturn(track.id, { pan: value })} title={`Pan: ${formatPan(track.pan)}`} /></div>
          <Activator $active={!track.mute} aria-pressed={!track.mute} title="Return Activator" onClick={() => updateReturn(track.id, { mute: !track.mute })}>{String.fromCharCode(65 + index)}</Activator>
        </Controls><LevelMeter level={meters.levels[`r${track.id}`] ?? 0} peak={meters.peaks[`r${track.id}`] ?? 0} /><Fader value={track.vol} onChange={(value) => updateReturn(track.id, { vol: value })} /></Lower>
      </Strip>)}
      </ChannelColumns>
      <Strip $master>
        <StripName>Master</StripName>
        <Scenes>{rows.map((bar, index) => <Slot key={index}>{bar !== undefined ? <ClipLaunch $color="#c7c7c5" title={`Воспроизвести с такта ${bar + 1}`} onClick={() => launch(bar)} style={{ border: 'none', fontStyle: 'italic' }}><Triangle style={{ border: 'none', background: 'transparent' }}>▷</Triangle><span style={{ flex: 1, textAlign: 'center' }}>{index + 1}</span></ClipLaunch> : null}</Slot>)}</Scenes>
        <StopRow><StopButton onClick={stop} title="Stop Clips" aria-label="Stop all clips" /><span>Stop Clips</span></StopRow>
        <Sends><SendsLabel>Sends</SendsLabel><div style={{ position: 'absolute', left: 7, top: 17 }}><PostTag>Post</PostTag></div><div style={{ position: 'absolute', right: 7, bottom: 14 }}><PostTag>Post</PostTag></div></Sends>
        <Lower><Controls><div style={{ color: '#74746d', height: 38, position: 'relative' }}><span style={{ position: 'absolute', top: -4, left: 14, fontSize: 12 }}>▽</span><Knob value={Math.round(masterVolume * 100)} onChange={updateMaster} defaultValue={100} title={`Master: ${formatDb(masterVolume * 100)}`} /></div>
          <span style={{ height: 30 }} />
          <SmallButton title="Снять Solo со всех каналов" onClick={() => getState().setState({ channels: getState().channels.map((channel) => ({ ...channel, solo: false })) })}>Solo</SmallButton>
          <Knob value={Math.round(masterVolume * 100)} onChange={updateMaster} defaultValue={100} color="#54b3d9" title={`Выходная громкость: ${formatDb(masterVolume * 100)}`} />
        </Controls><LevelMeter level={meters.levels.master ?? 0} peak={meters.peaks.master ?? 0} /><Fader value={Math.round(masterVolume * 100)} onChange={updateMaster} /></Lower>
      </Strip>
    </Strips>
  </Container>
}
