import { memo, useMemo } from 'react'
import { getWaveformEnvelope } from '../../audio/waveform'

interface AudioWaveformProps {
  buffer?: AudioBuffer
  width: number
  color: string
}

export default memo(function AudioWaveform({ buffer, width, color }: AudioWaveformProps) {
  const points = Math.max(2, Math.min(32768, Math.ceil(width)))
  const waveform = useMemo(() => {
    if (!buffer) return { path: '', count: 1 }
    const envelope = getWaveformEnvelope(buffer, points)
    const count = envelope.min.length
    if (!count) return { path: '', count: 1 }
    const y = (sample: number) => (50 - Math.max(-1, Math.min(1, sample)) * 46).toFixed(2)
    const path = [`M 0 ${y(envelope.max[0])}`]
    for (let i = 0; i < count; i += 1) {
      path.push(`L ${i + 0.5} ${y(envelope.max[i])}`)
    }
    path.push(`L ${count} ${y(envelope.max[count - 1])}`, `L ${count} ${y(envelope.min[count - 1])}`)
    for (let i = count - 1; i >= 0; i -= 1) {
      path.push(`L ${i + 0.5} ${y(envelope.min[i])}`)
    }
    path.push(`L 0 ${y(envelope.min[0])} Z`)
    return { path: path.join(' '), count }
  }, [buffer, points])

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${waveform.count} 100`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: '2px 0', width: '100%', height: 'calc(100% - 4px)', pointerEvents: 'none', color }}
    >
      <line x1="0" x2={waveform.count} y1="50" y2="50" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d={waveform.path} fill="currentColor" fillOpacity="0.85" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
})
