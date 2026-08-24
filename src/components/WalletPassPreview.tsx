import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { getTextColorForBg } from '@/lib/color'
import { normalizePassDesign, type PassAppearanceZone, type PassStampShape } from '@/lib/passDesign'
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
  shape: PassStampShape
}) {
  // The visual grid is intentionally capped: the operational target remains
  // untouched, while very large programs still produce a readable preview.
  const visibleTarget = Math.min(Math.max(target, 1), 12)
  const hiddenCount = Math.max(target - visibleTarget, 0)
  const shapeClass = shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-lg' : 'rounded-none'

  return (
    <span className="flex flex-wrap items-center justify-center gap-2" aria-label={`${filled} de ${target} visitas`}>
      {Array.from({ length: visibleTarget }).map((_, i) => {
        const isFilled = i < filled
        const imageUrl = isFilled ? stampImageUrl : emptyStampImageUrl

        // 'none' = igual que el pass real: la imagen se muestra tal cual,
        // sin recorte ni forma alrededor (object-fit: contain, alpha intacto).
        if (shape === 'none') {
          return (
            <span key={i} data-pass-stamp={i} className="flex h-8 w-8 shrink-0 items-center justify-center">
              {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-contain" />}
            </span>
          )
        }

        return (
          <span
            key={i}
            data-pass-stamp={i}
            className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden ${shapeClass}`}
            style={{
              border: `2px ${isFilled ? 'solid' : 'dashed'} ${isFilled ? filledColor : emptyColor}`,
              backgroundColor: isFilled && !imageUrl ? filledColor : 'transparent',
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
    <div
      role="note"
      aria-label="Código QR protegido; no se puede editar"
      className="mx-auto flex w-full max-w-[9.5rem] flex-col items-center gap-1.5 rounded-2xl bg-white px-3 py-3 text-center text-slate-800 shadow-sm"
    >
      <span className="flex aspect-square w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <Icon name="qrcode" size={30} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Código protegido</span>
        <span className="block text-xs font-semibold text-slate-800">QR y datos reales</span>
      </span>
      <span className="text-xs font-bold" style={{ color: accentColor }}>Seguro</span>
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
  // busy banner photo sits behind it. Without an explicit
  // stampAreaBackgroundColor, this keeps the original translucent look so
  // programs created before this setting existed render unchanged.
  const hasCustomStampArea = Boolean(design.stampAreaBackgroundColor)
  const stampAreaBg = design.stampAreaBackgroundColor ?? (textColor === '#000000' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.14)')
  const stampAreaTextColor = hasCustomStampArea ? getTextColorForBg(design.stampAreaBackgroundColor!) : textColor
  const stampAreaSubColor = hasCustomStampArea
    ? (stampAreaTextColor === '#000000' ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)')
    : subColor
  const stampPanelBorder = hasCustomStampArea ? 'transparent' : (textColor === '#000000' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)')
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
  const rewardColor = design.rewardColor
  const rewardTextColor = getTextColorForBg(rewardColor)
  const cardBackground = design.cardStyle === 'gradient'
    ? `linear-gradient(135deg, ${color} 0%, ${design.accentColor} 145%)`
    : color
  const isBrandTemplate = design.template === 'brand'
  // Mirrors pass-apple.service.ts: the counter only moves into the header
  // (next to the logo) when stamps are the primary visual and there's room
  // for a two-column header; the "brand" template keeps a centered, stacked
  // header instead, so the counter stays in the body there.
  const headerCounterVisible = useStampGrid && !isBrandTemplate
  const progressCounterClass = useStampGrid ? 'text-2xl' : (isBrandTemplate ? 'text-3xl' : 'text-5xl')

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

        {/* Header: logo + nombre a la izquierda, contador a la derecha —
            misma composición que headerFields en el pass real de Apple. */}
        <div className={`flex items-start gap-2 ${isBrandTemplate ? 'flex-col items-center text-center' : 'justify-between'}`}>
          <PreviewZone
            zone="identity"
            label="logo y encabezado"
            editable={editable}
            selected={selectedZone === 'identity'}
            onSelect={onZoneSelect}
            className={`flex min-w-0 flex-1 items-center gap-2 p-2 ${isBrandTemplate ? 'flex-col justify-center' : ''}`}
          >
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
            <span className="min-w-0 truncate text-xs font-semibold" style={{ color: subColor }}>
              {program.programName ?? 'Loyalty Program'}
            </span>
          </PreviewZone>

          {headerCounterVisible && (
            <PreviewZone
              zone="progress"
              label="contador y etiqueta"
              editable={editable}
              selected={selectedZone === 'progress'}
              onSelect={onZoneSelect}
              className="shrink-0 p-2 text-right"
            >
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: subColor }}>{saldoLabel}</span>
              <span className="mt-0.5 block text-lg font-bold tabular-nums" style={{ color: textColor }}>{sampleVisits}/{target ?? 10}</span>
            </PreviewZone>
          )}
        </div>

        <div className={`flex flex-1 flex-col ${isBrandTemplate ? 'justify-end' : 'justify-between'} gap-3 pt-2`}>
          {useStampGrid && (
            <PreviewZone
              zone="stamps"
              label="forma y color de sellos"
              editable={editable}
              selected={selectedZone === 'stamps'}
              onSelect={onZoneSelect}
              className="rounded-xl p-3"
              style={{ backgroundColor: stampAreaBg, border: `1px solid ${stampPanelBorder}` }}
            >
              <span className="flex min-h-[3.5rem] items-center">
                <StampGrid
                  target={target ?? 10}
                  filled={sampleVisits}
                  stampImageUrl={visitsConfig?.stampImageUrl}
                  emptyStampImageUrl={visitsConfig?.stampEmptyImageUrl}
                  filledColor={design.stampFilledColor}
                  emptyColor={design.stampEmptyColor}
                  shape={design.stampShape}
                />
              </span>
              {/* Instrucción del editor, no contenido del pass — solo aparece
                  mientras se edita esta zona, nunca en el resultado final. */}
              {editable && selectedZone === 'stamps' && (
                <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: stampAreaSubColor }}>
                  Toca para cambiar forma y color
                </span>
              )}
            </PreviewZone>
          )}

          {!headerCounterVisible && (
            <PreviewZone
              zone="progress"
              label="contador y etiqueta"
              editable={editable}
              selected={selectedZone === 'progress'}
              onSelect={onZoneSelect}
              className={`p-2 ${isBrandTemplate ? 'rounded-xl bg-slate-950/25' : ''}`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: subColor }}>{saldoLabel}</span>
              <span className={`mt-1 block font-bold tabular-nums ${progressCounterClass}`} style={{ color: textColor }}>
                {isPoints ? sampleBalance : `${sampleVisits}${target ? `/${target}` : ''}`}
              </span>
              <span className="mt-1 block text-xs font-medium leading-5" style={{ color: subColor }}>
                {isPoints
                  ? (pointsConfig?.minPointsToRedeem && pointsConfig.minPointsToRedeem > sampleBalance
                      ? `Te faltan ${pointsConfig.minPointsToRedeem - sampleBalance} para canjear`
                      : 'Tu saldo está listo para usar')
                  : (target && remainingVisits > 0
                      ? `Te faltan ${remainingVisits} ${remainingVisits === 1 ? stampSingular : stampPlural} para ${visitsConfig?.rewardDescription || `tu ${rewardWord}`}`
                      : 'Meta alcanzada')}
              </span>
            </PreviewZone>
          )}

          {!isPoints ? (
            // Tres columnas — igual que secondaryFields (Faltan / Siguiente
            // premio) + auxiliaryFields (Miembro) en el pass real.
            <div className={`grid gap-2 p-2 ${design.showMemberName ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: subColor }}>Faltan</span>
                <span className="mt-0.5 block truncate text-xs font-semibold" style={{ color: textColor }}>
                  {target && remainingVisits > 0 ? `${remainingVisits} ${remainingVisits === 1 ? stampSingular : stampPlural}` : '¡Lista!'}
                </span>
              </div>
              <PreviewZone
                zone="reward"
                label="bloque de premio"
                editable={editable}
                selected={selectedZone === 'reward'}
                onSelect={onZoneSelect}
                className="min-w-0 rounded-lg px-2 py-1.5"
                style={{ backgroundColor: rewardColor, color: rewardTextColor }}
              >
                <span className="block truncate text-[9px] font-bold uppercase tracking-[0.12em] opacity-70">Siguiente {rewardWord}</span>
                <span className="mt-0.5 block truncate text-xs font-bold">{visitsConfig?.rewardDescription || program.description || 'Beneficio'}</span>
              </PreviewZone>
              {design.showMemberName && (
                <div className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: subColor }}>Miembro</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold" style={{ color: textColor }}>Roberto Vargas</span>
                </div>
              )}
            </div>
          ) : (
            <>
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
                  <span className="mt-0.5 block text-xs font-bold">{program.description || 'Beneficio para tu próxima visita'}</span>
                </span>
              </PreviewZone>

              {design.showMemberName && (
                <div className="px-2">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: subColor }}>Miembro</span>
                  <span className="block text-xs font-semibold" style={{ color: textColor }}>Roberto Vargas</span>
                </div>
              )}
            </>
          )}

          <ProtectedQr accentColor={design.accentColor} />
        </div>
      </div>
    </div>
  )
}
