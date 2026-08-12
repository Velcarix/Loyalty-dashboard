import { getTextColorForBg } from '@/lib/color'
import type { LoyaltyProgram, LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

interface Props {
  program: Partial<LoyaltyProgram>
  config?: Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig> | null
  sampleBalance?: number
  sampleVisits?: number
}

function StampGrid({
  target, filled, stampImageUrl, textColor, subColor,
}: {
  target: number
  filled: number
  stampImageUrl?: string | null
  textColor: string
  subColor: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.max(target, 1) }).map((_, i) => {
        const isFilled = i < filled
        return (
          <div
            key={i}
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{
              border: `2px ${isFilled ? 'solid' : 'dashed'} ${isFilled ? textColor : subColor}`,
              backgroundColor: isFilled && !stampImageUrl ? textColor : 'transparent',
            }}
          >
            {isFilled && stampImageUrl && <img src={stampImageUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        )
      })}
    </div>
  )
}

export function WalletPassPreview({ program, config, sampleBalance = 150, sampleVisits = 3 }: Props) {
  const color = program.brandColor ?? '#2563EB'
  const textColor = getTextColorForBg(color)
  const subColor = textColor === '#000000' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)'
  const isPoints = program.type === 'points'
  const pointsConfig = isPoints ? (config as Partial<LoyaltyPointsConfig>) : null
  const visitsConfig = !isPoints ? (config as Partial<LoyaltyVisitsConfig>) : null
  const target = !isPoints ? visitsConfig?.visitsTarget ?? 10 : undefined

  const saldoLabel = program.saldoLabel || (isPoints ? 'Puntos' : 'Visitas')
  const progressText = isPoints
    ? (pointsConfig?.minPointsToRedeem && pointsConfig.minPointsToRedeem > sampleBalance
        ? `Te faltan ${pointsConfig.minPointsToRedeem - sampleBalance} para canjear`
        : null)
    : (target && target > sampleVisits
        ? `Te faltan ${target - sampleVisits} para ${visitsConfig?.rewardDescription || 'tu premio'}`
        : null)

  return (
    <div className="relative overflow-hidden rounded-2xl shadow" style={{ backgroundColor: color, aspectRatio: '1.586' }}>
      {program.bannerUrl && (
        <img
          src={program.bannerUrl}
          alt=""
          className="absolute inset-x-0 top-0 h-[45%] w-full object-cover"
        />
      )}
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          {program.logoUrl ? (
            <span className="flex h-11 min-w-11 max-w-24 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white p-1.5 shadow-sm">
              <img src={program.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold"
              style={{ color: textColor, borderColor: subColor }}
            >
              {(program.programName ?? 'LP').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="min-w-0 truncate text-right text-xs font-semibold" style={{ color: subColor }}>{program.programName ?? 'Loyalty Program'}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: subColor }}>{saldoLabel}</p>
          {!isPoints && visitsConfig?.visualStyle === 'stamp' ? (
            <div className="mt-1.5">
              <StampGrid
                target={target ?? 10}
                filled={sampleVisits}
                stampImageUrl={visitsConfig?.stampImageUrl}
                textColor={textColor}
                subColor={subColor}
              />
            </div>
          ) : (
            <p className="text-3xl font-bold" style={{ color: textColor }}>{isPoints ? sampleBalance : `${sampleVisits}${target ? `/${target}` : ''}`}</p>
          )}
          {progressText && <p className="mt-1 text-xs font-medium" style={{ color: subColor }}>{progressText}</p>}
        </div>
        <p className="truncate text-xs" style={{ color: subColor }}>{program.description ?? 'Acumula y canjea beneficios'}</p>
      </div>
    </div>
  )
}
