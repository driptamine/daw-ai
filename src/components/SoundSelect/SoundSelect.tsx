import { useEffect, useSyncExternalStore } from 'react'
import { PRESET_GROUPS } from '../../audio/presets'
import { playNote, prepareSound } from '../../audio/engine'
import { getSoundStatus, subscribeSoundStatus } from '../../audio/sampledInstruments'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { openSoundBrowser, SOUND_WINDOWS } from '../../store/instruments'

interface SoundSelectProps {
  value: string
  onChange: (preset: string) => void
  onFocusReturn?: () => void
  channelId?: number
  compact?: boolean
}

export default function SoundSelect({ value, onChange, onFocusReturn, channelId, compact }: SoundSelectProps) {
  const { getState } = useStore()
  const status = useSyncExternalStore(subscribeSoundStatus, () => getSoundStatus(value))
  useEffect(() => {
    void prepareSound(value, channelId).catch(() => { /* Loading errors are displayed below. */ })
  }, [value, channelId])

  return <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, minWidth: 0 }}>
    <select
      aria-label={channelId === undefined ? 'Sound' : `Channel ${channelId} sound`}
      value={value}
      title="Инструмент · сэмплы загружаются при первом выборе и кешируются"
      onChange={(event) => {
        const preset = event.currentTarget.value
        event.currentTarget.blur()
        onFocusReturn?.()
        onChange(preset)
      }}
      style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, fontSize: compact ? 8 : fontSize.xs, padding: '1px 4px', width: compact ? 95 : 180, maxWidth: '100%', cursor: 'pointer' }}
    >
      {PRESET_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>
        {group.options.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
      </optgroup>)}
    </select>
    {SOUND_WINDOWS.map((window) => <button key={window.id} type="button" title={`Открыть ${window.title}`} aria-label={`Open ${window.title}`} onClick={() => openSoundBrowser(getState(), window.bank, channelId)} style={{ color: theme.text, background: theme.surface, border: `1px solid ${theme.panelBorder}`, borderRadius: 3, padding: '1px 4px', fontSize: compact ? 9 : fontSize.xs, cursor: 'pointer' }}>
      {compact ? window.bank === 'FluidR3_GM' ? 'F' : 'M' : window.title.replace(' VST', '')}
    </button>)}
    {(status.phase === 'idle' || status.phase === 'loading') && <span role="status" style={{ color: theme.textDim, fontSize: 9 }}>
      Загрузка{status.total > 0 ? ` ${Math.round(status.loaded / status.total * 100)}%` : '…'}
    </span>}
    {status.phase === 'error' && <span role="alert" style={{ color: theme.red, fontSize: 9 }}>
      Не удалось загрузить звук. <button type="button" onClick={() => { void prepareSound(value, channelId).then(() => playNote(value, 60, 0.5, 0.9, undefined, channelId)).catch(() => {}) }} style={{ color: theme.text, background: theme.surface, border: `1px solid ${theme.panelBorder}`, cursor: 'pointer', fontSize: 9 }}>Повторить</button>
    </span>}
  </span>
}
