import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { getTextColorForBg } from '@/lib/color'
import { normalizePassDesign, type PassAppearanceZone } from '@/lib/passDesign'
import type { LoyaltyProgram, LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

interface Props {
  program: Partial<LoyaltyProgram>
  config?: Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig> | null
  sampleBalance?: number
  sampleVisits?: number
  /** Turns the preview into a keyboard-accessible, direct-manipulation editor. */
  editable?: boolean
  selectedZone?: PassAppearanceZone
  onZoneSelect?: (zone: PassAppearanceZone) => void
}

function PreviewZone({
  zone, label, editable, selected, onSelect, className, style, children,
}: {
  zone: PassAppearanceZone
  label: string
  editable: boolean
  selected: boolean
  onSelect?: (zone: PassAppearanceZone) => void
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const selectionClass = editable
    ? `cursor-pointer rounded-xl text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-white/90 focus:ring-offset-2 focus:ring-offset-transparent ${selected ? 'ring-2 ring-white/90 bg-white/15' : 'hover:bg-white/10'}`
    : ''

  if (!editable) return <div className={className} style={style}>{children}</div>

  return (
    <button
      type="button"
      onClick={() => onSelect?.(zone)}
      aria-label={`Editar ${label}`}
      aria-pressed={selected}
      className={`${className ?? ''} ${selectionClass}`}
      style={style}
    >
      {children}
    </button>
  )
}

function StampGrid({
  target, filled, stampImageUrl, emptyStampImageUrl, filledColor, emptyColor, shape,
}: {
  target: number
  filled: number
  stampImageUrl?: string | null
  emptyStampImageUrl?: string | null
  filledColor: string
  emptyColor: string
  shape: 'circle' | 'rounded'
}) {
  // The visual grid is intentionally capped: the operational target remains
  // untouched, while very large programs still produce a readable preview.
  const visibleTarget = Math.min(Math.max(target, 1), 12)
  const hiddenCount = Math.max(target - visibleTarget, 0)

  return (
    <span className="flex flex-wrap items-center gap-1.5" aria-label={`${filled} de ${target} visitas`}>
      {Array.from({ length: visibleTarget }).map((_, i) => {
        const isFilled = i < filled
        const imageUrl = isFilled ? stampImageUrl : emptyStampImageUrl
        return (
          <span
            key={i}
            data-pass-stamp={i}
            className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
            style={{
              border: `2px ${isFilled ? 'solid' : 'dashed'} ${isFilled ? filledColor : emptyColor}`,
              backgroundColor: isFilled && !stampImageUrl ? filledColor : 'transparent',
            }}
          >
            {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-cover" />}
          </span>
        )
      })}
      {hiddenCount > 0 && <span className="text-xs font-bold" style={{ color: emptyColor }}>+{hiddenCount}</span>}
    </span>
  )
}

function ProtectedQr({ accentColor }: { accentColor: string }) {
  return (
    <div role="note" className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-slate-800 shadow-sm" aria-label="Código QR protegido; no se puede editar">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <Icon name="qrcode" size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Código protegido</span>
        <span className="block text-xs font-semibold text-slate-800">QR y datos reales</span>
      </span>
      <span className="ml-auto text-xs font-bold" style={{ color: accentColor }}>Seguro</span>
    </div>
  )
}

export function WalletPassPreview({
  program,
  config,
  sampleBalance = 150,
  sampleVisits = 3,
  editable = false,
  selectedZone,
  onZoneSelect,
}: Props) {
  const color = program.brandColor ?? '#2563EB'
  const design = normalizePassDesign(program.businessInfo?.design)
  // Banner images are untrusted brand assets with arbitrary brightness. A
  // stable dark scrim plus white text protects readability independently of
  // the program's base color.
  const textColor = design.cardStyle === 'banner' && program.bannerUrl ? '#FFFFFF' : getTextColorForBg(color)
  const subColor = textColor === '#000000' ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)'
  // Stamps need a surface of their own so the grid stays readable even when a
  // busy banner photo sits behind it, instead of the circles floating
  // directly on top of the image.
  const stampPanelBg = textColor === '#000000' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.14)'
  const stampPanelBorder = textColor === '#000000' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'
  const isPoints = program.type === 'points'
  const pointsConfig = isPoints ? (config as Partial<LoyaltyPointsConfig>) : null
  const visitsConfig = !isPoints ? (config as Partial<LoyaltyVisitsConfig>) : null
  const target = !isPoints ? visitsConfig?.visitsTarget ?? 10 : undefined
  // visualStyle is the persisted source of truth. Template selection updates
  // it in the editor, preventing a cosmetic card from disagreeing with saved
  // program configuration.
  const useStampGrid = !isPoints && visitsConfig?.visualStyle === 'stamp'
  const saldoLabel = program.saldoLabel || (isPoints ? 'Puntos' : 'Visitas')
  const stampSingular = design.terminology.stampSingular || 'visita'
  const stampPlural = design.terminology.stampPlural || 'visitas'
  const rewardWord = design.terminology.rewardSingular || 'premio'
  const remainingVisits = target ? target - sampleVisits : 0
  const progressText = isPoints
    ? (pointsConfig?.minPointsToRedeem && pointsConfig.minPointsToRedeem > sampleBalance
        ? `Te faltan ${pointsConfig.minPointsToRedeem - sampleBalance} para canjear`
        : 'Tu saldo está listo para usar')
    : (target && remainingVisits > 0
        ? `Te faltan ${remainingVisits} ${remainingVisits === 1 ? stampSingular : stampPlural} para ${visitsConfig?.rewardDescription || `tu ${rewardWord}`}`
        : 'Meta alcanzada')
  const rewardColor = design.rewardColor
  const rewardTextColor = getTextColorForBg(rewardColor)
  const cardBackground = design.cardStyle === 'gradient'
    ? `linear-gradient(135deg, ${color} 0%, ${design.accentColor} 145%)`
    : color
  const isBrandTemplate = design.template === 'brand'
  // When the stamp grid is the primary visual, the numeric counter becomes a
  // secondary caption instead of competing with it for attention.
  const progressCounterClass = useStampGrid
    ? 'text-2xl'
    : (isBrandTemplate ? 'text-3xl' : 'text-5xl')

  return (
    <div
      className="relative overflow-hidden rounded-[1.45rem] shadow-xl shadow-slate-900/15"
      style={{ background: cardBackground, aspectRatio: '0.64' }}
      aria-label="Vista previa de tarjeta de lealtad"
    >
      {design.cardStyle === 'banner' && program.bannerUrl && (
        <img src={program.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      )}
      {design.cardStyle === 'banner' && program.bannerUrl && <div className="absolute inset-0 bg-slate-950/35" />}

      <div className="relative flex h-full flex-col p-4 sm:p-5">
        <PreviewZone
          zone="background"
          label="fondo y colores"
          editable={editable}
          selected={selectedZone === 'background'}
          onSelect={onZoneSelect}
          className="-m-1 mb-2 min-h-11 p-1"
        >
          <span className="sr-only">Fondo de la tarjeta</span>
        </PreviewZone>

        <PreviewZone
          zone="identity"
          label="logo y encabezado"
          editable={editable}
          selected={selectedZone === 'identity'}
          onSelect={onZoneSelect}
          className={`flex min-w-0 items-center gap-2 p-2 ${isBrandTemplate ? 'justify-center text-center' : 'justify-between'}`}
        >
          <span className={`flex min-w-0 items-center gap-2 ${isBrandTemplate ? 'flex-col' : ''}`}>
            {program.logoUrl && design.logoStyle === 'plate' ? (
              <span className="flex h-12 min-w-12 max-w-28 items-center justify-center rounded-xl border border-black/10 bg-white p-1.5 shadow-sm">
                <img src={program.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </span>
            ) : program.logoUrl ? (
              <img src={program.logoUrl} alt="" className="h-11 max-w-28 object-contain" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-bold" style={{ color: textColor, borderColor: subColor }}>
                {(program.programName ?? 'LP').slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className={`min-w-0 text-xs font-semibold ${isBrandTemplate ? '' : 'truncate text-right'}`} style={{ color: subColor }}>
              {program.programName ?? 'Loyalty Program'}
            </span>
          </span>
        </PreviewZone>

        <div className={`flex flex-1 flex-col ${isBrandTemplate ? 'justify-end' : 'justify-between'} gap-3 pt-2`}>
          {useStampGrid && (
            <PreviewZone
              zone="stamps"
              label="forma y color de sellos"
              editable={editable}
              selected={selectedZone === 'stamps'}
              onSelect={onZoneSelect}
              className="rounded-xl p-2.5"
              style={{ backgroundColor: stampPanelBg, border: `1px solid ${stampPanelBorder}` }}
            >
              <span className="block"><StampGrid
                target={target ?? 10}
                filled={sampleVisits}
                stampImageUrl={visitsConfig?.stampImageUrl}
                emptyStampImageUrl={visitsConfig?.stampEmptyImageUrl}
                filledColor={design.stampFilledColor}
                emptyColor={design.stampEmptyColor}
                shape={design.stampShape}
              /></span>
              <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: subColor }}>Toca los sellos para personalizarlos</span>
            </PreviewZone>
          )}

          <PreviewZone
            zone="progress"
            label="contador y etiqueta"
            editable={editable}
            selected={selectedZone === 'progress'}
            onSelect={onZoneSelect}
            className={`p-2 ${isBrandTemplate ? 'rounded-xl bg-slate-950/25' : ''}`}
          >
            <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: subColor }}>{saldoLabel}</span>
            {useStampGrid ? (
              <span className={`mt-1 block font-bold tabular-nums ${progressCounterClass}`} style={{ color: textColor }}>
                {sampleVisits}/{target ?? 10}
              </span>
            ) : (
              <span className={`mt-1 block font-bold tabular-nums ${progressCounterClass}`} style={{ color: textColor }}>
                {isPoints ? sampleBalance : `${sampleVisits}${target ? `/${target}` : ''}`}
              </span>
            )}
            <span className="mt-1 block text-xs font-medium leading-5" style={{ color: subColor }}>{progressText}</span>
          </PreviewZone>

          <PreviewZone
            zone="reward"
            label="bloque de premio"
            editable={editable}
            selected={selectedZone === 'reward'}
            onSelect={onZoneSelect}
            className="p-2"
          >
            <span className="block rounded-xl px-3 py-2.5 shadow-sm" style={{ backgroundColor: rewardColor, color: rewardTextColor }}>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{rewardWord}</span>
              <span className="mt-0.5 block text-xs font-bold">{visitsConfig?.rewardDescription || program.description || 'Beneficio para tu próxima visita'}</span>
            </span>
          </PreviewZone>

          {design.showMemberName && (
            <div className="px-2">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: subColor }}>Miembro</span>
              <span className="block text-xs font-semibold" style={{ color: textColor }}>Roberto Vargas</span>
            </div>
          )}

          <ProtectedQr accentColor={design.accentColor} />
        </div>
      </div>
    </div>
  )
}
