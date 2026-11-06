import { getSoundfontNames } from 'smplr'

export const SOUNDFONT_BANKS = ['FluidR3_GM', 'MusyngKite'] as const
export type SoundfontBank = typeof SOUNDFONT_BANKS[number]

export interface SampledPreset {
  id: string
  label: string
  bank: SoundfontBank
  instrument: string
}

export const SAMPLED_PRESETS: SampledPreset[] = SOUNDFONT_BANKS.flatMap((bank) =>
  getSoundfontNames().map((instrument) => ({
    id: `soundfont:${bank}:${instrument}`,
    label: instrument.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    bank,
    instrument,
  })),
)

export const SAMPLED_PRESET_MAP = new Map(SAMPLED_PRESETS.map((preset) => [preset.id, preset]))
