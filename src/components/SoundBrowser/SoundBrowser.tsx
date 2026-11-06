import { styled } from '@linaria/react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SAMPLED_PRESETS } from '../../audio/soundfonts'
import type { SoundfontBank } from '../../audio/soundfonts'
import { getSoundRatings, setSoundRating, subscribeSoundRatings } from '../../store/soundRatings'
import { playNote, prepareSound } from '../../audio/engine'
import { getSoundStatus, subscribeSoundStatus } from '../../audio/sampledInstruments'
import { setPatternSound } from '../../store/instruments'
import { useStore } from '../../store/useStore'
import { theme } from '../../styles/theme'

const SOUNDS = SAMPLED_PRESETS.map((sound) => ({ ...sound, library: sound.bank === 'FluidR3_GM' ? 'FluidR3' : 'MusyngKite' }))
const STARS = [1, 2, 3, 4, 5]

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
  padding: 10px;
  background: ${theme.panelBg};
  color: ${theme.text};
  font-size: 11px;
`
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`
const Control = styled.button`
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  background: ${theme.surface};
  color: ${theme.text};
  padding: 5px 9px;
  cursor: pointer;
  &:hover { border-color: ${theme.accent}; }
  &:disabled { opacity: 0.3; cursor: default; }
`
const Search = styled.input`
  width: 100%;
  flex-shrink: 0;
  padding: 7px 8px;
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  background: ${theme.bg};
  color: ${theme.textBright};
  font-size: 12px;
  outline: none;
  &:focus { border-color: ${theme.accent}; }
`
const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid ${theme.panelBorder};
  border-radius: 4px;
  background: ${theme.bg};
  outline: none;
  &:focus-visible { border-color: ${theme.accent}; }
`
const SoundRow = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 7px 0 0;
  border-bottom: 1px solid ${theme.panelBorder};
  border-left: 3px solid ${({ $selected }) => $selected ? theme.accentBright : 'transparent'};
  background: ${({ $selected }) => $selected ? theme.accentDim : 'transparent'};
  color: ${({ $selected }) => $selected ? theme.textBright : theme.text};
  cursor: pointer;
  &:hover { background: ${({ $selected }) => $selected ? theme.accentDim : theme.surface}; }
`
const SoundChoice = styled.button`
  flex: 1;
  min-width: 0;
  padding: 7px 6px;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  &:focus-visible { outline: 1px solid ${theme.accentBright}; outline-offset: -2px; }
`
const Star = styled.button<{ $filled: boolean }>`
  flex-shrink: 0;
  width: 18px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  color: ${({ $filled }) => $filled ? theme.yellow : theme.textDim};
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  &:hover { color: ${theme.yellow}; }
  &:focus-visible { outline: 1px solid ${theme.yellow}; border-radius: 2px; }
`

function SoundRating({ label, rating, onChange }: { label: string; rating: number; onChange: (value: number) => void }) {
  return <div role="group" aria-label={`Оценка: ${label}`} style={{ display: 'flex', flexShrink: 0 }} onKeyDown={(event) => {
    event.stopPropagation()
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : Math.max(0, Math.min(4, current + (event.key === 'ArrowRight' ? 1 : -1)))
    buttons[next]?.focus()
  }}>
    {STARS.map((star) => <Star
      key={star}
      type="button"
      $filled={star <= rating}
      aria-label={`${star} из 5`}
      aria-pressed={rating === star}
      tabIndex={star === (rating || 1) ? 0 : -1}
      title={rating === star ? `${rating}/5 · Нажмите ещё раз, чтобы снять оценку` : `Оценить: ${star}/5`}
      onClick={() => onChange(rating === star ? 0 : star)}
    >{star <= rating ? '★' : '☆'}</Star>)}
  </div>
}

export default function SoundBrowser({ bank }: { bank: SoundfontBank }) {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState(true)
  const ratings = useSyncExternalStore(subscribeSoundRatings, getSoundRatings)
  const [lastSound, setLastSound] = useState(() => SOUNDS.find((sound) => sound.bank === bank)!.id)
  const listRef = useRef<HTMLDivElement | null>(null)
  const selectedRow = useRef<HTMLDivElement | null>(null)

  useEffect(() => subscribe(() => forceUpdate((value) => value + 1)), [subscribe])
  useEffect(() => { listRef.current?.focus({ preventScroll: true }) }, [])

  const state = getState()
  const target = state.soundBrowserTargets?.[bank]
  const channel = target?.kind === 'channel' ? state.channels.find((item) => item.id === target.channelId) : undefined
  const pattern = state.patterns.find((item) => item.id === state.currentPattern)
  const assigned = channel?.preset ?? pattern?.soundPreset ?? state.pianoPreset
  const value = assigned.startsWith(`soundfont:${bank}:`) ? assigned : lastSound
  const status = useSyncExternalStore(subscribeSoundStatus, () => getSoundStatus(value))
  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return SOUNDS.filter((sound) => sound.bank === bank && words.every((word) => sound.label.toLowerCase().includes(word)))
  }, [query, bank])
  const selectedIndex = results.findIndex((sound) => sound.id === value)
  const selected = SOUNDS.find((sound) => sound.id === value)

  useEffect(() => { selectedRow.current?.scrollIntoView({ block: 'nearest' }) }, [value, results])
  useEffect(() => {
    void prepareSound(value, channel?.id).catch(() => { /* Status below offers a retry. */ })
  }, [value, channel?.id])

  const choose = (preset: string) => {
    setLastSound(preset)
    const current = getState()
    if (channel) {
      current.setState({ channels: current.channels.map((item) => item.id === channel.id ? { ...item, preset } : item) })
    } else {
      setPatternSound(current, preset)
    }
    if (preview) playNote(preset, 60, 0.5, 0.9, undefined, channel?.id)
    listRef.current?.focus({ preventScroll: true })
  }
  const move = (direction: number) => {
    if (!results.length) return
    const next = selectedIndex < 0 ? (direction > 0 ? 0 : results.length - 1) : Math.max(0, Math.min(results.length - 1, selectedIndex + direction))
    if (results[next].id !== value) choose(results[next].id)
  }

  return <Container aria-label={`${bank === 'FluidR3_GM' ? 'FluidR3' : 'MusyngKite'} VST`}>
    <div style={{ color: theme.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {channel ? `Channel Rack · ${channel.name}` : `Piano Roll · ${pattern?.name ?? 'Pattern'}`}
    </div>
    <Toolbar>
      <Control type="button" aria-label="Previous sound" title="Предыдущий звук · ↑" disabled={!results.length || selectedIndex === 0} onClick={() => move(-1)}>▲</Control>
      <Control type="button" aria-label="Next sound" title="Следующий звук · ↓" disabled={!results.length || selectedIndex === results.length - 1} onClick={() => move(1)}>▼</Control>
      <div style={{ minWidth: 0, flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selected?.label}>{selected?.label ?? value}</div>
      <Control type="button" aria-label="Preview sound" title="Прослушать · Enter" onClick={() => playNote(value, 60, 0.5, 0.9, undefined, channel?.id)}>♪</Control>
    </Toolbar>
    <Search aria-label="Search sounds" placeholder="Поиск инструмента…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1) }
    }} />
    <Toolbar>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', fontSize: 10 }}>
        <input type="checkbox" checked={preview} onChange={(event) => { setPreview(event.currentTarget.checked); event.currentTarget.blur(); listRef.current?.focus({ preventScroll: true }) }} />
        Прослушивать
      </label>
    </Toolbar>
    <List ref={listRef} role="list" aria-label="Instruments" tabIndex={0} onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowDown' ? 1 : -1) }
      if ((event.key === 'Home' || event.key === 'End') && results.length) { event.preventDefault(); choose(results[event.key === 'Home' ? 0 : results.length - 1].id) }
      if (event.key === 'Enter') { event.preventDefault(); playNote(value, 60, 0.5, 0.9, undefined, channel?.id) }
    }}>
      {results.map((sound) => <SoundRow
        key={sound.id}
        id={`sound-option-${sound.id}`}
        data-sound-id={sound.id}
        ref={sound.id === value ? selectedRow : undefined}
        role="listitem"
        $selected={sound.id === value}
      >
        <SoundChoice type="button" tabIndex={-1} aria-pressed={sound.id === value} onClick={() => choose(sound.id)} title={`${sound.label} · ${sound.library}`}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sound.label}</div>
          <div style={{ fontSize: 9, opacity: 0.65, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sound.library}</div>
        </SoundChoice>
        <SoundRating label={`${sound.label} · ${sound.library}`} rating={ratings[sound.id] ?? 0} onChange={(rating) => setSoundRating(sound.id, rating)} />
      </SoundRow>)}
      {!results.length && <div style={{ padding: 16, color: theme.textDim }}>Инструменты не найдены</div>}
    </List>
    <Toolbar>
      <span style={{ color: theme.textDim, fontSize: 10 }}>{results.length} звуков · ↑ ↓ выбор · Enter прослушать</span>
      {(status.phase === 'idle' || status.phase === 'loading') && <span role="status" style={{ marginLeft: 'auto', color: theme.accentBright, fontSize: 10 }}>Загрузка{status.total ? ` ${Math.round(status.loaded / status.total * 100)}%` : '…'}</span>}
    </Toolbar>
    {status.phase === 'error' && <div role="alert" style={{ color: theme.red, fontSize: 10 }}>
      Не удалось загрузить звук. <Control type="button" onClick={() => { void prepareSound(value, channel?.id).then(() => { if (preview) playNote(value, 60, 0.5, 0.9, undefined, channel?.id) }).catch(() => {}) }}>Повторить</Control>
    </div>}
  </Container>
}
