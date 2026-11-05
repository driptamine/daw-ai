import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, UIEvent as ReactUIEvent } from 'react'
import type { AudioClip, Clip } from '../../store/types'
import { decodeAudioFile } from '../../audio/engine'
import { computePeaks, getAudioAsset, loadAudioFile, registerAudioAsset, removeAudioAsset, saveAudioFile } from '../../audio/assets'
import AudioWaveform from './AudioWaveform'
import { getPatternSteps, parseNoteKey } from '../../audio/patternNotes'

const BAR_WIDTH = 64
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const DEFAULT_ROW_HEIGHT = 40
const LABEL_WIDTH = 88
const HEADER_HEIGHT = 28
const AUDIO_CLIP_COLOR = '#2dd4bf'
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']

type SelectionBox = { left: number; top: number; width: number; height: number }

function clipKey(clip: Clip | AudioClip): string {
  return `${'assetId' in clip ? 'audio' : 'pattern'}:${clip.id}`
}

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function hasFileDrag(e: ReactDragEvent<HTMLElement>): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

function startEdgeAutoScroll(
  getScroller: () => HTMLDivElement | null,
  getPointerX: () => number,
  onScroll: () => void,
  getPointerY?: () => number,
): () => void {
  const margin = 32
  const speed = 18
  let raf = 0

  const tick = () => {
    const scroller = getScroller()
    if (scroller) {
      const rect = scroller.getBoundingClientRect()
      const x = getPointerX()
      let delta = 0
      if (x > rect.right - margin) delta = speed
      else if (x < rect.left + margin) delta = -speed
      const beforeX = scroller.scrollLeft
      const beforeY = scroller.scrollTop
      if (delta) scroller.scrollLeft = Math.max(0, beforeX + delta)
      if (getPointerY) {
        const y = getPointerY()
        if (y > rect.bottom - margin) scroller.scrollTop += speed
        else if (y < rect.top + HEADER_HEIGHT + margin) scroller.scrollTop -= speed
      }
      if (scroller.scrollLeft !== beforeX || scroller.scrollTop !== beforeY) onScroll()
    }
    raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

const Container = styled.div`
  position: relative;
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

const TrackLabel = styled.div<{ $muted: boolean; $height: number }>`
  height: ${({ $height }) => $height}px;
  min-height: ${({ $height }) => $height}px;
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
  width: var(--playlist-bar-width, ${BAR_WIDTH}px);
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

const TrackRow = styled.div<{ $muted: boolean; $height: number }>`
  display: flex;
  height: ${({ $height }) => $height}px;
  min-height: ${({ $height }) => $height}px;
  border-bottom: 1px solid ${theme.panelBorder};
  background: ${theme.panelBg};
  position: relative;
  opacity: ${({ $muted }) => ($muted ? 0.5 : 1)};
`

const BarCell = styled.div`
  width: var(--playlist-bar-width, ${BAR_WIDTH}px);
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
  height: calc(var(--track-row-height, ${DEFAULT_ROW_HEIGHT}px) - 4px);
  border-radius: 4px;
  background: ${({ $color }) => $color}33;
  border: 1px solid ${({ $color }) => $color};
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

const CopiedLengthBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid ${theme.accent};
  border-radius: 3px;
  color: ${theme.accent};
  font-size: ${fontSize.xs};
  white-space: nowrap;
`

const CopiedLengthReset = styled.button`
  background: transparent;
  border: none;
  color: ${theme.accent};
  cursor: pointer;
  padding: 0 2px;
  font-size: ${fontSize.sm};
  line-height: 1;

  &:hover {
    color: ${theme.text};
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

const DropOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(104, 106, 187, 0.18);
  border: 2px dashed ${theme.accent};
  color: ${theme.textBright};
  font-size: ${fontSize.md};
  pointer-events: none;
`

export default function Playlist() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const tracksRef = useRef<HTMLDivElement | null>(null)
  const labelsInnerRef = useRef<HTMLDivElement | null>(null)
  const dragDepthRef = useRef(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [copiedLength, setCopiedLength] = useState<number | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [tool, setTool] = useState<'draw' | 'select'>('draw')
  const [selectedClips, setSelectedClips] = useState<Set<string>>(() => new Set())
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const gestureCleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => gestureCleanup.current?.(), [])
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('daw-ai:playlist-zoom')) || 1
      return Number.isFinite(saved) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, saved)) : 1
    } catch {
      return 1
    }
  })
  const pendingScrollLeft = useRef<number | null>(null)
  const [rowHeight, setRowHeight] = useState(() => Number(localStorage.getItem('daw-ai:track-height')) || DEFAULT_ROW_HEIGHT)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  useEffect(() => {
    let cancelled = false
    const restoreAudio = async () => {
      for (const clip of getState().audioClips) {
        if (getAudioAsset(clip.assetId)) continue
        try {
          const file = await loadAudioFile(clip.assetId)
          if (!file || cancelled) continue
          const buffer = await decodeAudioFile(new File([file], `${clip.name}.audio`))
          if (cancelled) continue
          registerAudioAsset({ id: clip.assetId, name: clip.name, buffer, duration: buffer.duration, peaks: computePeaks(buffer) })
          forceUpdate((n) => n + 1)
        } catch (error) {
          console.error(`Не удалось восстановить аудио ${clip.name}`, error)
        }
      }
    }
    void restoreAudio()
    return () => { cancelled = true }
  }, [getState])

  const state = getState()
  const { channels, patterns, playlistClips, playlistLength, currentStep, patternMode, isPlaying, playStart, audioClips } = state

  useEffect(() => {
    const existing = new Set([...playlistClips, ...audioClips].map(clipKey))
    setSelectedClips((selected) => {
      const next = new Set([...selected].filter((key) => existing.has(key)))
      return next.size === selected.size ? selected : next
    })
  }, [playlistClips, audioClips])

  // Keep the scrollable timeline wide enough to reach the end of every clip,
  // including audio clips longer than the stored playlist length.
  const clipEndBar = Math.max(
    0,
    ...playlistClips.map((clip) => clip.startBar + clip.lengthBars),
    ...audioClips.map((clip) => clip.startBar + clip.lengthBars),
  )
  const totalBars = Math.max(playlistLength || 64, Math.ceil(clipEndBar))
  const barWidth = BAR_WIDTH * zoom

  const changeZoom = useCallback((requestedZoom: number, anchorX?: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedZoom))
    if (next === zoom) return
    const scroller = scrollRef.current
    if (scroller) {
      const anchor = anchorX ?? scroller.clientWidth / 2
      const anchorBar = (scroller.scrollLeft + anchor) / barWidth
      pendingScrollLeft.current = Math.max(0, anchorBar * BAR_WIDTH * next - anchor)
    }
    setZoom(next)
  }, [zoom, barWidth])

  useLayoutEffect(() => {
    if (scrollRef.current && pendingScrollLeft.current !== null) {
      scrollRef.current.scrollLeft = pendingScrollLeft.current
      pendingScrollLeft.current = null
    }
  }, [zoom])

  useEffect(() => {
    try {
      localStorage.setItem('daw-ai:playlist-zoom', String(zoom))
    } catch {
      // Zoom still works when browser storage is unavailable.
    }
  }, [zoom])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      event.stopPropagation()
      const anchor = event.clientX - scroller.getBoundingClientRect().left
      changeZoom(zoom * Math.exp(-event.deltaY * 0.01), anchor)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [changeZoom, zoom])

  const handlePlaceClip = useCallback((trackIdx: number, bar: number) => {
    const s = getState()

    const existingClip = s.playlistClips.find(
      (c) => c.track === trackIdx && c.startBar === bar,
    )
    if (existingClip) return

    const lengthBars = copiedLength ?? getPatternSteps(s.patterns.find((pattern) => pattern.id === s.currentPattern)) / 16
    const newClip = {
      id: Date.now(),
      track: trackIdx,
      startBar: bar,
      lengthBars,
      patternId: s.currentPattern,
    }
    s.setState({
      playlistClips: [...s.playlistClips, newClip],
      playlistLength: Math.max(s.playlistLength || 64, bar + lengthBars),
    })
  }, [getState, copiedLength])

  const handleRemoveClip = useCallback((clipId: number) => {
    const s = getState()
    s.setState({
      playlistClips: s.playlistClips.filter((c) => c.id !== clipId),
    })
  }, [getState])

  const handleRemoveAudioClip = useCallback((clipId: number) => {
    const s = getState()
    const removed = s.audioClips.find((clip) => clip.id === clipId)
    const next = s.audioClips.filter((clip) => clip.id !== clipId)
    s.setState({ audioClips: next })
    if (removed && !next.some((clip) => clip.assetId === removed.assetId)) {
      removeAudioAsset(removed.assetId)
    }
  }, [getState])

  const handleDragEnter = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileDrag(e)) return
    e.preventDefault()
    dragDepthRef.current += 1
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFileDrag(e)) return
    e.preventDefault()
    dragDepthRef.current = 0
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(isAudioFile)
    if (!files.length) return

    const snapshot = getState()
    const rect = timelineRef.current?.getBoundingClientRect()
    const tracksRect = tracksRef.current?.getBoundingClientRect()
    const dropBar = rect
      ? Math.max(0, Math.min(totalBars - 1, Math.floor((e.clientX - rect.left) / barWidth)))
      : 0
    const dropTrack = tracksRect
      ? Math.max(
          0,
          Math.min(
            Math.max(0, (snapshot.channels.length || 1) - 1),
            Math.floor((e.clientY - tracksRect.top) / rowHeight),
          ),
        )
      : 0
    const secondsPerBar = (60 / snapshot.bpm) * 4

    setIsImporting(true)
    const newClips: AudioClip[] = []
    let cursor = dropBar

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]
      try {
        const buffer = await decodeAudioFile(file)
        const assetId = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`
        await saveAudioFile(assetId, file)
        const name = file.name.replace(/\.[^.]+$/, '')
        registerAudioAsset({
          id: assetId,
          name,
          buffer,
          duration: buffer.duration,
          peaks: computePeaks(buffer),
        })
        const lengthBars = Math.max(0.25, buffer.duration / secondsPerBar)
        newClips.push({
          id: Date.now() + i,
          name,
          assetId,
          track: dropTrack,
          startBar: cursor,
          lengthBars,
          duration: buffer.duration,
          color: AUDIO_CLIP_COLOR,
        })
        cursor = Math.ceil(cursor + lengthBars)
      } catch (error) {
        console.error(`Не удалось декодировать ${file.name}`, error)
      }
    }

    setIsImporting(false)

    if (!newClips.length) return

    const latest = getState()
    const endBar = Math.max(...newClips.map((clip) => clip.startBar + clip.lengthBars))
    latest.setState({
      audioClips: [...latest.audioClips, ...newClips],
      playlistLength: Math.max(latest.playlistLength, Math.ceil(endBar)),
    })
  }, [getState, barWidth, rowHeight, totalBars])

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

  const handleSelectedClipMouseDown = useCallback((clip: Clip | AudioClip, e: ReactMouseEvent<HTMLDivElement>) => {
    const key = clipKey(clip)
    if (tool !== 'select' && !e.shiftKey && !selectedClips.has(key)) {
      setSelectedClips(new Set())
      return false
    }
    e.preventDefault()
    e.stopPropagation()
    const selection = new Set(selectedClips)
    if (e.shiftKey && selection.has(key)) {
      selection.delete(key)
      setSelectedClips(selection)
      return true
    }
    if (!selection.has(key)) {
      if (!e.shiftKey) selection.clear()
      selection.add(key)
    }
    setSelectedClips(selection)
    const state = getState()
    const group = [...state.playlistClips, ...state.audioClips].filter((item) => selection.has(clipKey(item)))
    const originals = new Map(group.map((item) => [clipKey(item), item]))
    const minBar = Math.min(...group.map((item) => item.startBar))
    const minTrack = Math.min(...group.map((item) => item.track))
    const maxTrack = Math.max(...group.map((item) => item.track))
    const startX = e.clientX
    const startY = e.clientY
    const startScrollX = scrollRef.current?.scrollLeft ?? 0
    const startScrollY = scrollRef.current?.scrollTop ?? 0
    let pointerX = startX
    let pointerY = startY
    let lastBars = 0
    let lastRows = 0
    const applyMove = () => {
      const scroller = scrollRef.current
      const rawBars = (pointerX - startX + (scroller?.scrollLeft ?? 0) - startScrollX) / barWidth
      const bars = Math.max(-minBar, snapEnabled ? Math.round(rawBars) : rawBars)
      const rows = Math.max(-minTrack, Math.min(state.channels.length - 1 - maxTrack,
        Math.round((pointerY - startY + (scroller?.scrollTop ?? 0) - startScrollY) / rowHeight)))
      if (bars === lastBars && rows === lastRows) return
      lastBars = bars
      lastRows = rows
      const move = <T extends Clip | AudioClip>(item: T): T => {
        const original = originals.get(clipKey(item))
        return original ? { ...item, startBar: original.startBar + bars, track: original.track + rows } : item
      }
      const current = getState()
      current.setState({
        playlistClips: current.playlistClips.map(move),
        audioClips: current.audioClips.map(move),
        playlistLength: Math.max(current.playlistLength, ...group.map((item) => Math.ceil(item.startBar + bars + item.lengthBars))),
      })
    }
    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      applyMove()
    }
    gestureCleanup.current?.()
    const stopScroll = startEdgeAutoScroll(() => scrollRef.current, () => pointerX, applyMove, () => pointerY)
    const onUp = () => {
      stopScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      gestureCleanup.current = null
    }
    gestureCleanup.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return true
  }, [tool, selectedClips, getState, barWidth, rowHeight, snapEnabled])

  const handleSelectionBox = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== 'select' || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const tracks = tracksRef.current
    if (!tracks) return
    gestureCleanup.current?.()
    const rect = tracks.getBoundingClientRect()
    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top
    const baseSelection = e.shiftKey ? selectedClips : new Set<string>()
    setSelectedClips(new Set(baseSelection))
    setSelectionBox({ left: startX, top: startY, width: 0, height: 0 })
    let pointerX = e.clientX
    let pointerY = e.clientY
    const update = () => {
      const bounds = tracks.getBoundingClientRect()
      const endX = Math.max(0, Math.min(tracks.scrollWidth, pointerX - bounds.left))
      const endY = Math.max(0, Math.min(tracks.clientHeight, pointerY - bounds.top))
      const box = { left: Math.min(startX, endX), top: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) }
      setSelectionBox(box)
      const state = getState()
      const selection = new Set(baseSelection)
      for (const clip of [...state.playlistClips, ...state.audioClips]) {
        const left = clip.startBar * barWidth
        const top = clip.track * rowHeight + 2
        if (box.width > 0 && box.height > 0 && left < box.left + box.width && left + clip.lengthBars * barWidth > box.left && top < box.top + box.height && top + rowHeight - 4 > box.top) {
          selection.add(clipKey(clip))
        }
      }
      setSelectedClips(selection)
    }
    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      update()
    }
    const stopScroll = startEdgeAutoScroll(() => scrollRef.current, () => pointerX, update, () => pointerY)
    const onUp = () => {
      stopScroll()
      setSelectionBox(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      gestureCleanup.current = null
    }
    gestureCleanup.current = onUp
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [tool, selectedClips, getState, barWidth, rowHeight])

  const handleClipMouseDown = useCallback((clip: Clip, e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (handleSelectedClipMouseDown(clip, e)) return
    e.stopPropagation()
    e.preventDefault()

    const s = getState()
    const maxTrack = Math.max(0, (s.channels.length || 1) - 1)
    const startX = e.clientX
    const startY = e.clientY
    const origStartBar = clip.startBar
    const origTrack = clip.track
    const startScroll = scrollRef.current?.scrollLeft ?? 0
    let pointerX = e.clientX
    let pointerY = e.clientY
    let moved = false

    const applyMove = (clientX: number, clientY: number) => {
      const scrollOffset = (scrollRef.current?.scrollLeft ?? 0) - startScroll
      const rawDeltaBars = (clientX - startX + scrollOffset) / barWidth
      const deltaBars = snapEnabled ? Math.round(rawDeltaBars) : rawDeltaBars
      const deltaRows = Math.round((clientY - startY) / rowHeight)
      if (Math.abs(deltaBars) < 1e-6 && deltaRows === 0) return
      moved = true
      const newStartBar = Math.max(0, origStartBar + deltaBars)
      const newTrack = Math.max(0, Math.min(maxTrack, origTrack + deltaRows))
      const cur = getState()
      const nextClips = cur.playlistClips.map((c) =>
        c.id === clip.id ? { ...c, startBar: newStartBar, track: newTrack } : c,
      )
      cur.setState({
        playlistClips: nextClips,
        playlistLength: Math.max(cur.playlistLength, Math.ceil(newStartBar + clip.lengthBars)),
      })
    }

    const onMove = (me: MouseEvent) => {
      pointerX = me.clientX
      pointerY = me.clientY
      applyMove(pointerX, pointerY)
    }

    const stopAutoScroll = startEdgeAutoScroll(
      () => scrollRef.current,
      () => pointerX,
      () => applyMove(pointerX, pointerY),
    )

    const onUp = () => {
      stopAutoScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!moved) {
        setCopiedLength(clip.lengthBars)
        if (clip.patternId != null) {
          const cur = getState()
          cur.setState({ currentPattern: clip.patternId, playStart: Math.round(clip.startBar * 16) })
        }
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getState, snapEnabled, barWidth, rowHeight, handleSelectedClipMouseDown])

  const handleAudioClipMouseDown = useCallback(
    (clip: AudioClip, e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (handleSelectedClipMouseDown(clip, e)) return
      e.stopPropagation()
      e.preventDefault()

      const s = getState()
      const maxTrack = Math.max(0, (s.channels.length || 1) - 1)
      const startX = e.clientX
      const startY = e.clientY
      const origStartBar = clip.startBar
      const origTrack = clip.track ?? 0
      const startScroll = scrollRef.current?.scrollLeft ?? 0
      let pointerX = e.clientX
      let pointerY = e.clientY
      let moved = false

      const applyMove = (clientX: number, clientY: number) => {
        const scrollOffset = (scrollRef.current?.scrollLeft ?? 0) - startScroll
        const rawDeltaBars = (clientX - startX + scrollOffset) / barWidth
        const deltaBars = snapEnabled ? Math.round(rawDeltaBars) : rawDeltaBars
        const deltaRows = Math.round((clientY - startY) / rowHeight)
        if (!moved && Math.abs(deltaBars) < 1e-6 && deltaRows === 0) return
        moved = true
        const newStartBar = Math.max(0, origStartBar + deltaBars)
        const newTrack = Math.max(0, Math.min(maxTrack, origTrack + deltaRows))
        const cur = getState()
        cur.setState({
          audioClips: cur.audioClips.map((c) =>
            c.id === clip.id ? { ...c, startBar: newStartBar, track: newTrack } : c,
          ),
          playlistLength: Math.max(cur.playlistLength, Math.ceil(newStartBar + clip.lengthBars)),
        })
      }

      const onMove = (me: MouseEvent) => {
        pointerX = me.clientX
        pointerY = me.clientY
        applyMove(pointerX, pointerY)
      }

      const stopAutoScroll = startEdgeAutoScroll(
        () => scrollRef.current,
        () => pointerX,
        () => applyMove(pointerX, pointerY),
      )

      const onUp = () => {
        stopAutoScroll()
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [getState, snapEnabled, barWidth, rowHeight, handleSelectedClipMouseDown],
  )

  const handleTimelineScroll = useCallback((e: ReactUIEvent<HTMLDivElement>) => {
    if (labelsInnerRef.current) {
      labelsInnerRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`
    }
  }, [])

  const handleTrackResize = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = rowHeight
    const onMove = (event: MouseEvent) => {
      const next = Math.max(28, Math.min(160, startHeight + event.clientY - startY))
      setRowHeight(next)
      localStorage.setItem('daw-ai:track-height', String(next))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [rowHeight])

  const handleClipResize = useCallback(
    (clip: Clip, edge: 'left' | 'right', e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (tool === 'select' && handleSelectedClipMouseDown(clip, e)) return
    e.stopPropagation()
    e.preventDefault()

    const startX = e.clientX
    const origStart = clip.startBar
    const origLength = clip.lengthBars
    const minLen = snapEnabled ? 1 : 0.25
    const startScroll = scrollRef.current?.scrollLeft ?? 0
    let pointerX = e.clientX

    const applyResize = (clientX: number) => {
      const scrollOffset = (scrollRef.current?.scrollLeft ?? 0) - startScroll
      const rawDeltaBars = (clientX - startX + scrollOffset) / barWidth
      const deltaBars = snapEnabled ? Math.round(rawDeltaBars) : rawDeltaBars
      let startBar = origStart
      let lengthBars = origLength
      if (edge === 'right') {
        lengthBars = Math.max(minLen, origLength + deltaBars)
      } else {
        const fixedRight = origStart + origLength
        startBar = Math.max(0, Math.min(fixedRight - minLen, origStart + deltaBars))
        lengthBars = fixedRight - startBar
      }
      const cur = getState()
      const next = cur.playlistClips.map((c) =>
        c.id === clip.id ? { ...c, startBar, lengthBars } : c,
      )
      cur.setState({
        playlistClips: next,
        playlistLength: Math.max(cur.playlistLength, Math.ceil(startBar + lengthBars)),
      })
    }

    const onMove = (me: MouseEvent) => {
      pointerX = me.clientX
      applyResize(pointerX)
    }

    const stopAutoScroll = startEdgeAutoScroll(
      () => scrollRef.current,
      () => pointerX,
      () => applyResize(pointerX),
    )

    const onUp = () => {
      stopAutoScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getState, snapEnabled, barWidth, tool, handleSelectedClipMouseDown])

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
      solo: false,
      sendA: 0,
      sendB: 0,
      preset: s.pianoPreset || 'synth',
    }
    s.setState({ channels: [...s.channels, newChannel] })
  }, [getState])

  const seekFromClientX = useCallback((clientX: number) => {
    const el = timelineRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const step = Math.round((x / barWidth) * 16)
    getState().setState({ playStart: step, patternMode: false })
  }, [getState, barWidth])

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

  const getClipStyle = (clip: Clip | AudioClip) => ({
    left: clip.startBar * barWidth,
    width: clip.lengthBars * barWidth,
    height: rowHeight - 4,
    outline: selectedClips.has(clipKey(clip)) ? `2px solid ${theme.textBright}` : undefined,
    outlineOffset: -2,
    zIndex: selectedClips.has(clipKey(clip)) ? 2 : 1,
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

  const displayStep = !patternMode && isPlaying && currentStep >= 0 ? currentStep : playStart
  const playheadBar = displayStep / 16

  return (
    <Container
      tabIndex={0}
      aria-label="Playlist"
      onMouseDownCapture={(event) => {
        if (!(event.target as HTMLElement).closest('button, input, select, textarea')) event.currentTarget.focus({ preventScroll: true })
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
        if (event.key === 'Escape') {
          event.preventDefault()
          gestureCleanup.current?.()
          setSelectedClips(new Set())
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedClips.size) {
          event.preventDefault()
          const current = getState()
          current.setState({
            playlistClips: current.playlistClips.filter((clip) => !selectedClips.has(clipKey(clip))),
            audioClips: current.audioClips.filter((clip) => !selectedClips.has(clipKey(clip))),
          })
          setSelectedClips(new Set())
        }
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '2px 8px', background: theme.surface, borderBottom: `1px solid ${theme.panelBorder}`, flexShrink: 0 }}>
        <ModeBtn $active={tool === 'draw'} aria-pressed={tool === 'draw'} onClick={() => setTool('draw')} title="Рисование клипов">
          Draw
        </ModeBtn>
        <ModeBtn $active={tool === 'select'} aria-pressed={tool === 'select'} onClick={() => setTool('select')} title="Выделение рамкой. Shift — добавить к выделению. Delete — удалить. Escape — снять выделение.">
          ▧ Select
        </ModeBtn>
        {selectedClips.size > 0 && <span style={{ color: theme.textBright, fontSize: fontSize.xs }}>Selected: {selectedClips.size}</span>}
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
        <ModeBtn
          $active={snapEnabled}
          onClick={() => setSnapEnabled((v) => !v)}
          title={snapEnabled ? 'Привязка к тактам включена' : 'Свободное перемещение без привязки'}
        >
          Snap: {snapEnabled ? 'On' : 'Off'}
        </ModeBtn>
        <AddTrackBtn onClick={handleAddTrack}>+ Track</AddTrackBtn>
        <ModeBtn
          $active={false}
          type="button"
          aria-label="Уменьшить ширину тактов"
          title="Уменьшить горизонтальный масштаб"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => changeZoom(zoom / 1.25)}
        >
          −
        </ModeBtn>
        <ModeBtn
          $active={false}
          type="button"
          title="Горизонтальный масштаб. Нажмите для сброса на 100%"
          onClick={() => changeZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </ModeBtn>
        <ModeBtn
          $active={false}
          type="button"
          aria-label="Увеличить ширину тактов"
          title="Увеличить горизонтальный масштаб"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => changeZoom(zoom * 1.25)}
        >
          +
        </ModeBtn>
        {copiedLength != null && (
          <CopiedLengthBadge title="Длина скопированного клипа. ЛКМ по пустой ячейке создаст клип такой длины.">
            <span>Длина клипа: {copiedLength} бар.</span>
            <CopiedLengthReset
              title="Сбросить длину (2 бара)"
              onClick={() => setCopiedLength(null)}
            >
              ×
            </CopiedLengthReset>
          </CopiedLengthBadge>
        )}
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
                <TrackLabel key={ch.id} $muted={ch.mute} $height={rowHeight} style={{ position: 'relative' }}>
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
                  <div title="Потяни, чтобы изменить высоту дорожки" onMouseDown={handleTrackResize} style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 5, cursor: 'ns-resize', zIndex: 2 }} />
                </TrackLabel>
              ))}
            </div>
          </LabelsViewport>
        </TrackLabels>

        <ScrollRight ref={scrollRef} onScroll={handleTimelineScroll}>
          <div ref={timelineRef} style={{ width: totalBars * barWidth, minWidth: '100%', position: 'relative', ['--playlist-bar-width' as string]: `${barWidth}px` }}>
            <Ruler data-playlist-ruler onMouseDown={handleTimelineDown}>
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
              data-playlist-playhead
              style={{ left: playheadBar * barWidth }}
              onMouseDown={handleTimelineDown}
            />

            <TracksContainer ref={tracksRef} onMouseDown={handleSelectionBox} style={{ ['--track-row-height' as string]: `${rowHeight}px`, cursor: tool === 'select' ? 'crosshair' : undefined }}>
              {channels.map((ch, trackIdx) => (
                <TrackRow key={ch.id} $muted={ch.mute} $height={rowHeight}>
                  {Array.from({ length: totalBars }, (_, bar) => (
                    <BarCell
                      key={bar}
                      onClick={() => { if (tool === 'draw') handlePlaceClip(trackIdx, bar) }}
                      style={{ cursor: tool === 'select' ? 'crosshair' : undefined }}
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
                        title="ЛКМ — скопировать длину и перейти к клипу. Перетащи, чтобы переместить. ПКМ — удалить."
                        onMouseDown={(e) => handleClipMouseDown(clip, e)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveClip(clip.id)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          if (tool === 'draw') handleClipDoubleClick(clip)
                        }}
                      >
                        <ClipHeader $color={getClipColor(clip)}>
                          {getPatternName(clip.patternId)}
                        </ClipHeader>
                        <ClipBody>
                          {(getPattern(clip.patternId)?.notes || []).map((key, i) => {
                            const [noteIndex, col] = parseNoteKey(key)
                            return (
                              <div
                                key={i}
                                style={{
                                  position: 'absolute',
                                  left: col * (barWidth / 16),
                                  width: Math.max(2, barWidth / 16),
                                  height: 3,
                                  top: `${(1 - Math.max(0, Math.min(47, noteIndex)) / 47) * 80 + 10}%`,
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

                  {audioClips
                    .filter((clip) => (clip.track ?? 0) === trackIdx)
                    .map((clip) => {
                      const asset = getAudioAsset(clip.assetId)
                      return (
                        <ClipBlock
                          key={clip.id}
                          style={getClipStyle(clip)}
                          $color={clip.color}
                          title={`${clip.name} — перетащи, чтобы переместить. ПКМ — удалить.`}
                          onMouseDown={(e) => handleAudioClipMouseDown(clip, e)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveAudioClip(clip.id)
                          }}
                        >
                          <ClipHeader $color={clip.color}>{clip.name}</ClipHeader>
                          <ClipBody>
                            <AudioWaveform buffer={asset?.buffer} width={clip.lengthBars * barWidth} color={clip.color} />
                          </ClipBody>
                        </ClipBlock>
                      )
                    })}
                </TrackRow>
              ))}

              {selectionBox && (
                <div aria-hidden="true" style={{ position: 'absolute', ...selectionBox, border: `1px solid ${theme.accent}`, background: `${theme.accent}33`, pointerEvents: 'none', zIndex: 5 }} />
              )}
              {playheadBar >= 0 && (
                <PlayheadLine style={{ left: playheadBar * barWidth }} />
              )}
            </TracksContainer>
          </div>
        </ScrollRight>
      </GridArea>

      {(isDragOver || isImporting) && (
        <DropOverlay>
          {isImporting ? 'Импорт аудио…' : 'Отпустите файл, чтобы добавить его в плейлист'}
        </DropOverlay>
      )}
    </Container>
  )
}
