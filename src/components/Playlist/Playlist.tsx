import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, UIEvent as ReactUIEvent } from 'react'
import type { Clip } from '../../store/types'

const BAR_WIDTH = 64
const ROW_HEIGHT = 40
const LABEL_WIDTH = 88
const HEADER_HEIGHT = 28

const Container = styled.div`
  background: ${theme.panelBg};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const GridArea = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const TrackLabels = styled.div`
  flex-shrink: 0;
  width: ${LABEL_WIDTH}px;
  background: ${theme.surface};
  border-right: 1px solid ${theme.panelBorder};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const LabelsHeader = styled.div`
  flex-shrink: 0;
  height: ${HEADER_HEIGHT}px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
`

const LabelsViewport = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const TrackLabel = styled.div<{ $muted: boolean }>`
  height: ${ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: ${fontSize.xs};
  color: ${theme.text};
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${theme.panelBg};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: ${({ $muted }) => ($muted ? 0.45 : 1)};
`

const TrackName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const TrackToggleBtn = styled.button<{ $active: boolean }>`
  margin-left: 4px;
  background: ${({ $active }) => ($active ? theme.red : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? theme.red : theme.panelBorder)};
  color: ${({ $active }) => ($active ? '#000' : theme.textDim)};
  cursor: pointer;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  padding: 1px 4px;
  border-radius: 2px;
  flex-shrink: 0;
  transition: all 0.1s;

  &:hover {
    border-color: ${theme.accent};
    color: ${({ $active }) => ($active ? '#000' : theme.accent)};
  }
`

const ScrollRight = styled.div`
  flex: 1;
  overflow: auto;
  min-width: 0;
`

const Ruler = styled.div`
  display: flex;
  height: ${HEADER_HEIGHT}px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
  position: sticky;
  top: 0;
  z-index: 2;
`

const BarMarker = styled.div<{ $beat: boolean }>`
  position: relative;
  width: ${BAR_WIDTH}px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${fontSize.xs};
  color: ${theme.text};
  border-right: 1px solid ${theme.panelBorder};
  font-weight: ${({ $beat }) => ($beat ? 700 : 400)};
  color: ${({ $beat }) => ($beat ? theme.text : theme.textDim)};
  background: ${({ $beat }) => ($beat ? '#252525' : theme.surface)};
  overflow: hidden;
`

const TracksContainer = styled.div`
  position: relative;
  min-width: 100%;
`

const TrackRow = styled.div<{ $muted: boolean }>`
  display: flex;
  height: ${ROW_HEIGHT}px;
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${theme.panelBg};
  position: relative;
  opacity: ${({ $muted }) => ($muted ? 0.5 : 1)};
`

const BarCell = styled.div`
  width: ${BAR_WIDTH}px;
  flex-shrink: 0;
  border-right: 1px solid ${theme.gridLine};
  cursor: pointer;
  position: relative;

  &:hover {
    background: rgba(255, 140, 0, 0.05);
  }
`

const BeatLine = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 100%;
  background: ${theme.panelBorder};
  z-index: 0;
`

const ClipBlock = styled.div<{ $color: string }>`
  position: absolute;
  top: 2px;
  height: ${ROW_HEIGHT - 4}px;
  border-radius: 4px;
  background: ${({ $color }) => $color}33;
  border: 1px solid ${({ $color }) => $color};
  border-left: 3px solid ${({ $color }) => $color};
  cursor: grab;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
  user-select: none;
  transition: opacity 0.1s;

  &:hover {
    opacity: 0.85;
  }

  &:active {
    cursor: grabbing;
  }
`

const ClipHeader = styled.div<{ $color: string }>`
  height: 13px;
  flex-shrink: 0;
  background: ${({ $color }) => $color};
  color: #000;
  font-size: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ClipBody = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`

const PlayheadLine = styled.div`
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: ${theme.accent};
  z-index: 3;
  pointer-events: none;
  opacity: 0.8;
`

const Skimmer = styled.div`
  position: absolute;
  top: 0;
  height: ${HEADER_HEIGHT}px;
  width: 2px;
  background: ${theme.accent};
  z-index: 4;
  cursor: ew-resize;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -5px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 9px solid ${theme.accent};
  }
`

const AddTrackBtn = styled.button`
  background: transparent;
  border: 1px dashed ${theme.textDim};
  color: ${theme.textDim};
  border-radius: 3px;
  padding: 1px 8px;
  font-size: ${fontSize.xs};
  cursor: pointer;
  transition: all 0.1s;

  &:hover {
    border-color: ${theme.accent};
    color: ${theme.accent};
  }
`

const ModeBtn = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? theme.accent : 'transparent')};
  color: ${({ $active }) => ($active ? '#fff' : theme.textDim)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 1px 6px;
  font-size: ${fontSize.xs};
  cursor: pointer;
  transition: all 0.1s;

  &:hover {
    border-color: ${theme.accent};
    color: ${theme.text};
  }
`

export default function Playlist() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const labelsInnerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { channels, patterns, playlistClips, playlistLength, currentStep, patternMode, isPlaying, playStart } = state

  const totalBars = playlistLength || 64
  const barWidth = BAR_WIDTH

  const handlePlaceClip = useCallback((trackIdx: number, bar: number) => {
    const s = getState()

    const existingClip = s.playlistClips.find(
      (c) => c.track === trackIdx && c.startBar === bar,
    )
    if (existingClip) return

    const newClip = {
      id: Date.now(),
      track: trackIdx,
      startBar: bar,
      lengthBars: 2,
      patternId: s.currentPattern,
    }
    s.setState({
      playlistClips: [...s.playlistClips, newClip],
    })
  }, [getState])

  const handleRemoveClip = useCallback((clipId: number) => {
    const s = getState()
    s.setState({
      playlistClips: s.playlistClips.filter((c) => c.id !== clipId),
    })
  }, [getState])

  const handleClipDoubleClick = useCallback((clip: Clip) => {
    const s = getState()
    if (clip.patternId == null) return
    const newZ = (s.maxZIndex || 10) + 1
    const layouts = { ...s.windowLayout }
    if (layouts.pianoRoll) layouts.pianoRoll = { ...layouts.pianoRoll, zIndex: newZ }
    s.setState({
      currentPattern: clip.patternId,
      windowVisibility: { ...s.windowVisibility, pianoRoll: true },
      windowLayout: layouts,
      maxZIndex: newZ,
    })
  }, [getState])

  const handleToggleTrack = useCallback((trackIdx: number) => {
    const s = getState()
    const newChannels = s.channels.map((c, i) =>
      i === trackIdx ? { ...c, mute: !c.mute } : c,
    )
    s.setState({ channels: newChannels })
  }, [getState])

  const handleClipMouseDown = useCallback((clip: Clip, e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()

    const s = getState()
    const totalBars = s.playlistLength || 64
    const maxTrack = Math.max(0, (s.channels.length || 1) - 1)
    const startX = e.clientX
    const startY = e.clientY
    const origStartBar = clip.startBar
    const origTrack = clip.track
    const maxStartBar = Math.max(0, totalBars - clip.lengthBars)
    let moved = false

    const onMove = (me: MouseEvent) => {
      const deltaBars = Math.round((me.clientX - startX) / BAR_WIDTH)
      const deltaRows = Math.round((me.clientY - startY) / ROW_HEIGHT)
      if (deltaBars === 0 && deltaRows === 0) return
      moved = true
      const newStartBar = Math.max(0, Math.min(maxStartBar, origStartBar + deltaBars))
      const newTrack = Math.max(0, Math.min(maxTrack, origTrack + deltaRows))
      const cur = getState()
      const nextClips = cur.playlistClips.map((c) =>
        c.id === clip.id ? { ...c, startBar: newStartBar, track: newTrack } : c,
      )
      cur.setState({ playlistClips: nextClips })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!moved && clip.patternId != null) {
        const cur = getState()
        cur.setState({ currentPattern: clip.patternId, playStart: clip.startBar * 16 })
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getState])

  const handleTimelineScroll = useCallback((e: ReactUIEvent<HTMLDivElement>) => {
    if (labelsInnerRef.current) {
      labelsInnerRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`
    }
  }, [])

  const handleClipResize = useCallback(
    (clip: Clip, edge: 'left' | 'right', e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()

    const s = getState()
    const totalBars = s.playlistLength || 64
    const startX = e.clientX
    const origStart = clip.startBar
    const origLength = clip.lengthBars
    const minLen = 1

    const onMove = (me: MouseEvent) => {
      const deltaBars = Math.round((me.clientX - startX) / BAR_WIDTH)
      let startBar = origStart
      let lengthBars = origLength
      if (edge === 'right') {
        lengthBars = Math.max(minLen, Math.min(totalBars - origStart, origLength + deltaBars))
      } else {
        const fixedRight = origStart + origLength
        startBar = Math.max(0, Math.min(fixedRight - minLen, origStart + deltaBars))
        lengthBars = fixedRight - startBar
      }
      const cur = getState()
      const next = cur.playlistClips.map((c) =>
        c.id === clip.id ? { ...c, startBar, lengthBars } : c,
      )
      cur.setState({ playlistClips: next })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getState])

  const handleAddTrack = useCallback(() => {
    const s = getState()
    const index = s.channels.length
    const newChannel = {
      id: Date.now(),
      name: `Track ${index + 1}`,
      steps: Array(16).fill(0),
      color: theme.stepColors[index % theme.stepColors.length],
      vol: 100,
      pan: 64,
      mute: false,
      preset: s.pianoPreset || 'synth',
    }
    s.setState({ channels: [...s.channels, newChannel] })
  }, [getState])

  const seekFromClientX = useCallback((clientX: number) => {
    const el = timelineRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const step = Math.round((x / BAR_WIDTH) * 16)
    getState().setState({ playStart: step })
  }, [getState])

  const handleTimelineDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    seekFromClientX(e.clientX)
    const onMove = (me: MouseEvent) => seekFromClientX(me.clientX)
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [seekFromClientX])

  const getClipStyle = (clip: Clip) => ({
    left: clip.startBar * barWidth,
    width: clip.lengthBars * barWidth,
  })

  const getPatternName = (patternId: number) => {
    const p = patterns.find((pat) => pat.id === patternId)
    return p ? p.name : `Pattern ${patternId}`
  }

  const getPattern = (patternId: number) => patterns.find((pat) => pat.id === patternId)

  const getClipColor = (clip: Clip) => {
    const p = getPattern(clip.patternId)
    if (!p) return theme.accent
    const idx = patterns.indexOf(p)
    return theme.stepColors[idx % theme.stepColors.length]
  }

  const displayStep = isPlaying && currentStep >= 0 ? currentStep : playStart
  const playheadBar = displayStep / 16

  return (
    <Container>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <ModeBtn
          $active={!patternMode}
          onClick={() => getState().setState({ patternMode: false })}
        >
          Song
        </ModeBtn>
        <ModeBtn
          $active={patternMode}
          onClick={() => getState().setState({ patternMode: true })}
        >
          Pattern
        </ModeBtn>
        <AddTrackBtn onClick={handleAddTrack}>+ Track</AddTrackBtn>
      </div>

      <GridArea>
        <TrackLabels
          onWheel={(e) => {
            if (scrollRef.current) scrollRef.current.scrollTop += e.deltaY
          }}
        >
          <LabelsHeader />
          <LabelsViewport>
            <div ref={labelsInnerRef}>
              {channels.map((ch, i) => (
                <TrackLabel key={ch.id} $muted={ch.mute}>
                  <TrackName>Track {i + 1}</TrackName>
                  <TrackToggleBtn
                    $active={ch.mute}
                    title={ch.mute ? 'Включить дорожку' : 'Отключить дорожку'}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleTrack(i)
                    }}
                  >
                    {ch.mute ? 'OFF' : 'ON'}
                  </TrackToggleBtn>
                </TrackLabel>
              ))}
            </div>
          </LabelsViewport>
        </TrackLabels>

        <ScrollRight ref={scrollRef} onScroll={handleTimelineScroll}>
          <div ref={timelineRef} style={{ minWidth: totalBars * barWidth, position: 'relative' }}>
            <Ruler onMouseDown={handleTimelineDown}>
              {Array.from({ length: totalBars }, (_, i) => (
                <BarMarker key={i} $beat={i % 4 === 0}>
                  <span style={{ position: 'relative', zIndex: 1 }}>{i % 4 === 0 ? i + 1 : ''}</span>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      pointerEvents: 'none',
                    }}
                  >
                    {[0, 1, 2, 3].map((s) => (
                      <div
                        key={s}
                        style={{
                          flex: 1,
                          borderRight: s < 3 ? `1px solid ${theme.gridLine}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </BarMarker>
              ))}
            </Ruler>
            <Skimmer
              style={{ left: playheadBar * barWidth }}
              onMouseDown={handleTimelineDown}
            />

            <TracksContainer>
              {channels.map((ch, trackIdx) => (
                <TrackRow key={ch.id} $muted={ch.mute}>
                  {Array.from({ length: totalBars }, (_, bar) => (
                    <BarCell
                      key={bar}
                      onClick={() => handlePlaceClip(trackIdx, bar)}
                    >
                      {(bar + 1) % 4 === 0 && (
                        <BeatLine />
                      )}
                    </BarCell>
                  ))}

                  {playlistClips
                    .filter((clip) => clip.track === trackIdx)
                    .map((clip) => (
                      <ClipBlock
                        key={clip.id}
                        style={getClipStyle(clip)}
                        $color={getClipColor(clip)}
                        title="Перетащи, чтобы переместить. Двойной клик — удалить."
                        onMouseDown={(e) => handleClipMouseDown(clip, e)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveClip(clip.id)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handleClipDoubleClick(clip)
                        }}
                      >
                        <ClipHeader $color={getClipColor(clip)}>
                          {getPatternName(clip.patternId)}
                        </ClipHeader>
                        <ClipBody>
                          {(getPattern(clip.patternId)?.notes || []).map((key, i) => {
                            const [noteIndex, col] = key.split('-').map(Number)
                            return (
                              <div
                                key={i}
                                style={{
                                  position: 'absolute',
                                  left: col * (BAR_WIDTH / 16),
                                  width: Math.max(2, BAR_WIDTH / 16),
                                  height: 3,
                                  top: `${(1 - noteIndex / 47) * 80 + 10}%`,
                                  background: `hsl(${Math.round((noteIndex / 47) * 300)}, 85%, 62%)`,
                                  borderRadius: 1,
                                  opacity: 1,
                                }}
                              />
                            )
                          })}
                        </ClipBody>
                        <div
                          title="Потяни, чтобы изменить длину"
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            cursor: 'ew-resize',
                            zIndex: 3,
                          }}
                          onMouseDown={(e) => handleClipResize(clip, 'left', e)}
                        />
                        <div
                          title="Потяни, чтобы изменить длину"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: 6,
                            cursor: 'ew-resize',
                            zIndex: 3,
                          }}
                          onMouseDown={(e) => handleClipResize(clip, 'right', e)}
                        />
                      </ClipBlock>
                    ))}
                </TrackRow>
              ))}

              {playheadBar >= 0 && (
                <PlayheadLine style={{ left: playheadBar * barWidth }} />
              )}
            </TracksContainer>
          </div>
        </ScrollRight>
      </GridArea>
    </Container>
  )
}
