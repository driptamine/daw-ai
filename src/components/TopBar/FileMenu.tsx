import { styled } from '@linaria/react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { downloadMidi } from '../../audio/midi'
import { importMidiIntoProject } from '../../store/midi'
import { useStore } from '../../store/useStore'
import { theme, fontSize } from '../../styles/theme'

const Root = styled.div`
  position: relative;
  z-index: 1000;
`
const Trigger = styled.button`
  color: ${theme.text};
  font-size: ${fontSize.sm};
  padding: 2px 10px;
  border: 0;
  background: transparent;
  cursor: pointer;
  &:hover, &[aria-expanded='true'] { background: ${theme.surfaceRaised}; }
  &:focus-visible { outline: 1px solid ${theme.accent}; }
`
const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  padding: 4px;
  border: 1px solid #3b3b3b;
  border-radius: 4px;
  background: ${theme.surface};
  box-shadow: 0 6px 18px #0009;
`
const Action = styled.button`
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  color: ${theme.text};
  font-size: 11px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
  &:hover, &:focus-visible { background: ${theme.accentDim}; color: ${theme.textBright}; outline: none; }
  &:disabled { opacity: 0.4; cursor: default; background: transparent; }
`

export default function FileMenu() {
  const { getState } = useStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const root = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  const initialFocus = useRef(0)
  const current = getState()
  const pattern = current.patterns.find((item) => item.id === current.currentPattern)

  useEffect(() => {
    if (!open) return
    const actions = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
    const index = initialFocus.current < 0 ? (actions?.length ?? 1) - 1 : 0
    actions?.[index]?.focus()
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  useEffect(() => {
    if (!message || message.error) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const close = () => { setOpen(false); trigger.current?.focus() }
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const index = actions.findIndex((item) => item === document.activeElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'Tab') setOpen(false)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      actions[(index + (event.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length]?.focus()
    }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); actions[event.key === 'Home' ? 0 : actions.length - 1]?.focus() }
    if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); event.stopPropagation(); actions[index]?.click() }
  }

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusy(true)
    setMessage({ text: `Importing ${file.name}…`, error: false })
    try {
      const result = await importMidiIntoProject(file, getState, true)
      setMessage({ text: `Imported ${result.noteCount} notes · ${result.patterns.length} patterns${result.flattenedTempo ? ' · tempo changes converted to fixed BPM' : ''}`, error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not import MIDI.', error: true })
    } finally { setBusy(false) }
  }

  return <Root ref={root}>
    <Trigger ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="file-menu" onClick={() => { initialFocus.current = 0; setOpen((value) => !value) }} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        event.stopPropagation()
        initialFocus.current = event.key === 'ArrowUp' ? -1 : 0
        setOpen((value) => event.key === 'Enter' || event.code === 'Space' ? !value : true)
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false) }
    }}>File</Trigger>
    <input ref={input} type="file" aria-label="Import MIDI file" accept=".mid,.midi,audio/midi,audio/x-midi" hidden onChange={onImport} />
    {open && <Dropdown ref={menu} id="file-menu" role="menu" aria-label="File" onKeyDown={onMenuKey}>
      <Action type="button" role="menuitem" disabled={busy} onClick={() => { close(); setMessage(null); input.current?.click() }}>Import MIDI…</Action>
      <Action type="button" role="menuitem" disabled={!pattern?.notes.length} title={pattern?.notes.length ? `Export notes from ${pattern.name}` : 'The selected pattern has no notes'} onClick={() => {
        close()
        try {
          const state = getState()
          const selected = state.patterns.find((item) => item.id === state.currentPattern)
          if (selected) setMessage({ text: `Exported ${downloadMidi(selected, state.bpm)}`, error: false })
        } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not export MIDI.', error: true }) }
      }}>Export MIDI…</Action>
    </Dropdown>}
    {message && <div role={message.error ? 'alert' : 'status'} style={{ position: 'fixed', top: 70, right: 12, maxWidth: 360, padding: '10px 12px', background: theme.surfaceRaised, border: `1px solid ${message.error ? theme.red : theme.accent}`, borderRadius: 4, fontSize: 11, color: theme.text, boxShadow: '0 4px 16px #0008' }}>
      {message.text}
      <button type="button" aria-label="Dismiss file message" onClick={() => setMessage(null)} style={{ marginLeft: 12, border: 0, color: theme.text, background: 'transparent', cursor: 'pointer' }}>×</button>
    </div>}
  </Root>
}
