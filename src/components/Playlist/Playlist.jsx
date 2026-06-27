import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useEffect, useState, useCallback, useRef } from 'react'

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
  height: 720px;
  overflow: hidden;
`

const TrackLabels = styled.div`
  flex-shrink: 0;
  width: ${LABEL_WIDTH}px;
  background: ${theme.surface};
  border-right: 1px solid ${theme.panelBorder};
  overflow: hidden;
  padding-top: ${HEADER_HEIGHT}px;
`

const TrackLabel = styled.div`
  height: ${ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: ${fontSize.xs};
  color: ${theme.text};
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${({ $even }) => ($even ? theme.panelBg : theme.surface)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const TrackLabelDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  margin-right: 6px;
  flex-shrink: 0;
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

const BarMarker = styled.div`
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
`

const TracksContainer = styled.div`
  position: relative;
  min-width: 100%;
`

const TrackRow = styled.div`
  display: flex;
  height: ${ROW_HEIGHT}px;
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${({ $even }) => ($even ? theme.panelBg : theme.surface)};
  position: relative;
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

const ClipBlock = styled.div`
  position: absolute;
  top: 2px;
  height: ${ROW_HEIGHT - 4}px;
  border-radius: 4px;
  background: ${({ $color }) => $color}33;
  border-left: 3px solid ${({ $color }) => $color};
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: ${fontSize.xs};
  color: ${theme.textBright};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 1;
  user-select: none;
  transition: opacity 0.1s;

  &:hover {
    opacity: 0.85;
  }
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

const ModeBtn = styled.button`
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
  const scrollRef = useRef(null)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { channels, patterns, playlistClips, playlistLength, currentPattern, isPlaying, currentStep, patternMode } = state

  const totalBars = playlistLength || 64
  const barWidth = BAR_WIDTH

  const currentPatternObj = patterns.find((p) => p.id === currentPattern)

  const handlePlaceClip = useCallback((trackIdx, bar) => {
    if (!currentPatternObj) return
    const s = getState()

    const existingClip = s.playlistClips.find(
      (c) => c.track === trackIdx && c.startBar === bar,
    )
    if (existingClip) return

    const newClip = {
      id: Date.now(),
      track: trackIdx,
      startBar: bar,
      lengthBars: 4,
      patternId: currentPatternObj.id,
    }
    s.setState({
      playlistClips: [...s.playlistClips, newClip],
    })
  }, [getState, currentPatternObj])

  const handleRemoveClip = useCallback((clipId) => {
    const s = getState()
    s.setState({
      playlistClips: s.playlistClips.filter((c) => c.id !== clipId),
    })
  }, [getState])

  const getClipStyle = (clip) => ({
    left: clip.startBar * barWidth,
    width: clip.lengthBars * barWidth,
  })

  const getPatternName = (patternId) => {
    const p = patterns.find((pat) => pat.id === patternId)
    return p ? p.name : `Pattern ${patternId}`
  }

  const getClipColor = (patternId) => {
    const p = patterns.find((pat) => pat.id === patternId)
    if (!p) return theme.accent
    const idx = patterns.indexOf(p)
    return theme.stepColors[idx % theme.stepColors.length]
  }

  const playheadBar = currentStep >= 0 ? currentStep / 4 : -1

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
      </div>

      <GridArea>
        <TrackLabels>
          {channels.map((ch, i) => (
            <TrackLabel key={ch.id} $even={i % 2 === 0}>
              <TrackLabelDot $color={ch.color} />
              {ch.name}
            </TrackLabel>
          ))}
        </TrackLabels>

        <ScrollRight ref={scrollRef}>
          <div style={{ minWidth: totalBars * barWidth, position: 'relative' }}>
            <Ruler>
              {Array.from({ length: totalBars }, (_, i) => (
                <BarMarker key={i} $beat={(i + 1) % 4 === 0}>
                  {(i + 1) % 4 === 0 ? i + 1 : ''}
                </BarMarker>
              ))}
            </Ruler>

            <TracksContainer>
              {channels.map((ch, trackIdx) => (
                <TrackRow key={ch.id} $even={trackIdx % 2 === 0}>
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
                        $color={getClipColor(clip.patternId)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handleRemoveClip(clip.id)
                        }}
                      >
                        {getPatternName(clip.patternId)}
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
