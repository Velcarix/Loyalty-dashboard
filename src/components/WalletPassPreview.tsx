import { getTextColorForBg } from '@/lib/color'
import type { LoyaltyProgram, LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

interface Props {
  program: Partial<LoyaltyProgram>
  config?: Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig> | null
  sampleBalance?: number
  sampleVisits?: number
}

export function WalletPassPreview({ program, config, sampleBalance = 150, sampleVisits = 3 }: Props) {
  const color = program.brandColor ?? '#7C3AED'
  const textColor = getTextColorForBg(color)
  const subColor = textColor === '#000000' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)'
  const isPoints = program.type === 'points'
  const target = !isPoints ? (config as Partial<LoyaltyVisitsConfig>)?.visitsTarget ?? 10 : undefined

  return (
    <div className="overflow-hidden rounded-2xl shadow" style={{ backgroundColor: color, aspectRatio: '1.586' }}>
      <div className="flex h-full flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold"
            style={{ color: textColor, borderColor: subColor }}
          >
            {(program.programName ?? 'LP').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-semibold" style={{ color: subColor }}>{program.programName ?? 'Loyalty Program'}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: subColor }}>{isPoints ? 'Puntos' : 'Visitas'}</p>
          <p className="text-3xl font-bold" style={{ color: textColor }}>{isPoints ? sampleBalance : `${sampleVisits}${target ? `/${target}` : ''}`}</p>
        </div>
        <p className="truncate text-xs" style={{ color: subColor }}>{program.description ?? 'Acumula y canjea beneficios'}</p>
      </div>
    </div>
  )
}
