import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession, type CapturedPhoto } from '@/state/session-store'
import { useDecoration, type PlacedSticker } from '@/state/decoration-store'
import { useTheme } from '@/state/theme-store'
import { BORDERS, bordersForTheme, getBorder } from '@/lib/borders'
import { STICKERS, getSticker } from '@/lib/stickers'
import { computePaperLayout, type PaperLayout } from '@/lib/strip-layout'
import { buildGifFromPhotos } from '@/lib/gif-encoder'

type Step = 'sticker' | 'border'

export function DecorateScreen() {
  const goTo = useSession((s) => s.goTo)
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const filter = useSession((s) => s.filter)
  const liveAsset = useSession((s) => s.liveAsset)
  const setLiveAsset = useSession((s) => s.setLiveAsset)
  const theme = useTheme((s) => s.theme)

  const borderId = useDecoration((s) => s.borderId)
  const stripColor = useDecoration((s) => s.stripColor)
  const stickers = useDecoration((s) => s.stickers)
  const selectedId = useDecoration((s) => s.selectedStickerId)
  const setBorder = useDecoration((s) => s.setBorder)
  const setStripColor = useDecoration((s) => s.setStripColor)
  const addSticker = useDecoration((s) => s.addSticker)
  const moveSticker = useDecoration((s) => s.moveSticker)
  const removeSticker = useDecoration((s) => s.removeSticker)
  const selectSticker = useDecoration((s) => s.selectSticker)
  const resetDecoration = useDecoration((s) => s.reset)
  const setStickerScale = useDecoration((s) => s.setStickerScale)

  const [step, setStep] = useState<Step>('sticker')

  // Reset decoration for a fresh session.
  useEffect(() => {
    resetDecoration('classic-black')
  }, [resetDecoration])

  // Build the live-photo GIF in the background while the user picks a border /
  // places stickers. By the time they hit Done, the asset is already cached
  // and PreviewScreen can skip straight to upload — no encode wait visible.
  // Plain setTimeout (not requestIdleCallback) so it fires reliably even with
  // CSS animations / sticker drags eating idle time.
  useEffect(() => {
    if (liveAsset || photos.length === 0) return
    let cancelled = false

    const handle = window.setTimeout(() => {
      if (cancelled) return
      console.log('[decorate] starting background gif encode')
      const filterCss = theme.filters.find((f) => f.id === filter)?.css ?? 'none'
      buildGifFromPhotos({ photos, filterCss })
        .then((gif) => {
          if (cancelled) return
          console.log('[decorate] gif ready, caching to session store')
          setLiveAsset(gif)
        })
        .catch((e) => console.warn('[decorate] background gif build failed', e))
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [liveAsset, photos, filter, theme, setLiveAsset])

  const layout = useMemo(() => computePaperLayout(template), [template])
  const availableBorders = useMemo(() => bordersForTheme(theme.id), [theme.id])

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="06" label="DECORATE" />

      <div className="grid grid-cols-[auto_1fr] gap-8 px-10 pb-4 min-h-0">
        <StripStage
          photos={photos}
          filterId={filter}
          layout={layout}
          borderId={borderId}
          stripColor={stripColor}
          themeId={theme.id}
          stickers={stickers}
          selectedId={selectedId}
          onStickerMove={moveSticker}
          onStickerSelect={selectSticker}
          onStickerRemove={removeSticker}
          onStickerScale={setStickerScale}
        />

        <div className="flex flex-col min-h-0 gap-4">
          <div className="flex gap-3">
            <StepBadge
              n={1}
              label="STICKERS"
              active={step === 'sticker'}
              onClick={() => setStep('sticker')}
            />
            <StepBadge
              n={2}
              label="BORDER"
              active={step === 'border'}
              onClick={() => setStep('border')}
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {step === 'sticker' ? (
              <StickerGrid onPick={(a) => addSticker(a)} />
            ) : (
              <div className="flex flex-col gap-4">
                <BorderGrid
                  borders={availableBorders}
                  selectedId={borderId}
                  onPick={setBorder}
                />
                <StripColorPicker color={stripColor} onChange={setStripColor} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            {step === 'sticker' ? (
              <>
                <TVButton variant="ghost" size="md" onClick={() => goTo('preview')}>
                  ⏭ SKIP
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={() => setStep('border')}>
                  NEXT ▶
                </TVButton>
              </>
            ) : (
              <>
                <TVButton variant="ghost" size="md" onClick={() => setStep('sticker')}>
                  ◀ BACK
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={() => goTo('preview')}>
                  DONE ▶
                </TVButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepBadge({
  n,
  label,
  active,
  onClick,
}: {
  n: number
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'touch-press flex-1 py-3 border-2 rounded-xl font-crt text-xl tracking-widest flex items-center justify-center gap-2',
        active
          ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor'
          : 'border-crt-cream/30 bg-black/40 text-crt-cream',
      )}
    >
      <span
        className={clsx(
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-base font-bold border',
          active
            ? 'border-crt-phosphor bg-crt-phosphor text-black'
            : 'border-crt-cream/40 text-crt-cream/80',
        )}
      >
        {n}
      </span>
      {label}
    </button>
  )
}

/* ─────────── Strip preview with sticker layer ─────────── */

function StripStage(props: {
  photos: CapturedPhoto[]
  filterId: string
  layout: PaperLayout
  borderId: string
  stripColor: string
  themeId: string
  stickers: PlacedSticker[]
  selectedId: string | null
  onStickerMove: (id: string, x: number, y: number) => void
  onStickerSelect: (id: string | null) => void
  onStickerRemove: (id: string) => void
  onStickerScale: (id: string, scale: number) => void
}) {
  const {
    photos,
    filterId,
    layout,
    borderId,
    stripColor,
    themeId,
    stickers,
    selectedId,
    onStickerMove,
    onStickerSelect,
    onStickerRemove,
    onStickerScale,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = layout.paper.w
    canvas.height = layout.paper.h
    const ctx = canvas.getContext('2d')!

    // paper
    ctx.fillStyle = stripColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const filterCss = FILTER_CSS_MAP[filterId] ?? 'none'

    for (const section of layout.sections) {
      ctx.filter = filterCss
      for (let i = 0; i < section.frames.length; i++) {
        const f = section.frames[i]
        const p = photos[i]
        if (!p) continue
        const img = new Image()
        img.src = p.dataUrl
        img.onload = () => drawCover(ctx, img, f.x, f.y, f.w, f.h)
        if (img.complete) drawCover(ctx, img, f.x, f.y, f.w, f.h)
      }
      ctx.filter = 'none'
    }

    // Redraw border + cut-line after a tick so they sit on top
    requestAnimationFrame(() => {
      const border = getBorder(borderId)
      for (const section of layout.sections) {
        for (const f of section.frames) {
          border.renderCanvas(ctx, { ...f, themeId })
        }
      }
      if (layout.cutLine) {
        ctx.save()
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 1
        ctx.setLineDash([8, 8])
        ctx.beginPath()
        ctx.moveTo(layout.cutLine.x, layout.cutLine.y1)
        ctx.lineTo(layout.cutLine.x, layout.cutLine.y2)
        ctx.stroke()
        ctx.restore()
      }
    })
  }, [photos, filterId, borderId, stripColor, layout, themeId])

  const handleStagePointerDown = (e: React.PointerEvent) => {
    // Tap on stage (outside a sticker) clears selection
    if (e.target === e.currentTarget) onStickerSelect(null)
  }

  return (
    <div
      ref={stageRef}
      className="relative rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]"
      style={{
        aspectRatio: `${layout.paper.w} / ${layout.paper.h}`,
        height: '100%',
        background: stripColor,
      }}
      onPointerDown={handleStagePointerDown}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {stickers.map((s) => (
        <StickerNode
          key={s.id}
          sticker={s}
          selected={selectedId === s.id}
          onSelect={onStickerSelect}
          onMove={onStickerMove}
          onRemove={onStickerRemove}
          onScale={onStickerScale}
          stageRef={stageRef}
        />
      ))}
    </div>
  )
}

const FILTER_CSS_MAP: Record<string, string> = {
  'none': 'none',
  'bw-grain': 'grayscale(1) contrast(1.15) brightness(1.05)',
  'sepia': 'sepia(0.75) contrast(1.1) saturate(1.2)',
  'vhs': 'saturate(1.4) contrast(1.2) hue-rotate(-5deg)',
  'neon-80s': 'saturate(1.6) contrast(1.3) hue-rotate(280deg)',
  'polaroid': 'saturate(0.85) contrast(0.95) brightness(1.08)',
  'bubblegum': 'saturate(1.3) contrast(1.05) hue-rotate(-12deg)',
  'dreamy': 'saturate(0.9) contrast(0.95) brightness(1.1) blur(0.3px)',
  'hologram': 'saturate(1.6) contrast(1.15) hue-rotate(180deg)',
  'kawaii': 'saturate(1.1) brightness(1.12) contrast(0.92)',
  'peach': 'saturate(1.2) sepia(0.2) hue-rotate(-10deg) brightness(1.05)',
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height
  const dr = dw / dh
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > dr) {
    sw = img.height * dr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / dr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

/* ─────────── Sticker DOM overlay (draggable) ─────────── */

function StickerNode({
  sticker,
  selected,
  onSelect,
  onMove,
  onRemove,
  onScale,
  stageRef,
}: {
  sticker: PlacedSticker
  selected: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onRemove: (id: string) => void
  onScale: (id: string, scale: number) => void
  stageRef: React.RefObject<HTMLDivElement>
}) {
  const def = getSticker(sticker.assetId)
  const dragState = useRef<{ startX: number; startY: number; stickerX: number; stickerY: number } | null>(null)

  if (!def) return null

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    onSelect(sticker.id)
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      stickerX: sticker.x,
      stickerY: sticker.y,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragState.current.startX) / rect.width
    const dy = (e.clientY - dragState.current.startY) / rect.height
    const nx = clamp01(dragState.current.stickerX + dx)
    const ny = clamp01(dragState.current.stickerY + dy)
    onMove(sticker.id, nx, ny)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const sizePx = 72 * sticker.scale

  return (
    <div
      className="absolute select-none touch-none"
      style={{
        left: `${sticker.x * 100}%`,
        top: `${sticker.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}rad)`,
        fontSize: `${sizePx}px`,
        lineHeight: 1,
        color: def.color,
        cursor: 'grab',
        textShadow: selected ? '0 0 14px rgba(255,255,255,0.9)' : 'none',
        filter: selected ? 'drop-shadow(0 0 8px rgba(255,255,255,0.7))' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {def.glyph}
      {selected && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/85 rounded-full px-2 py-1 text-white text-sm font-crt tracking-wider"
          style={{ fontSize: 14 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onScale(sticker.id, Math.max(0.4, sticker.scale - 0.2))
            }}
            className="touch-press w-6 h-6 rounded-full bg-white/20"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onScale(sticker.id, Math.min(3, sticker.scale + 0.2))
            }}
            className="touch-press w-6 h-6 rounded-full bg-white/20"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(sticker.id)
            }}
            className="touch-press w-6 h-6 rounded-full bg-red-500 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/* ─────────── Picker grids ─────────── */

function BorderGrid({
  borders,
  selectedId,
  onPick,
}: {
  borders: typeof BORDERS
  selectedId: string
  onPick: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {borders.map((b) => (
        <button
          key={b.id}
          onClick={() => onPick(b.id)}
          className={clsx(
            'touch-press p-3 border-2 rounded-xl text-left font-crt',
            selectedId === b.id
              ? 'border-crt-phosphor bg-crt-phosphor/15'
              : 'border-crt-cream/30 bg-black/40',
          )}
        >
          <div
            className="h-14 rounded-md mb-2"
            style={{ background: b.swatch || '#1a1412' }}
          />
          <div className="text-lg tracking-widest text-crt-cream">{b.name}</div>
        </button>
      ))}
    </div>
  )
}

const STRIP_COLOR_PRESETS = ['#224a34', '#a9d099', '#000000', '#ffffff']

function StripColorPicker({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  const isPreset = STRIP_COLOR_PRESETS.some((c) => c.toLowerCase() === color.toLowerCase())
  return (
    <div className="border-2 border-crt-cream/20 rounded-xl bg-black/30 p-3 flex flex-col gap-2">
      <div className="text-xs tracking-widest font-crt text-crt-cream/70">
        STRIP COLOR
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {STRIP_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={clsx(
              'touch-press w-12 h-12 rounded-lg border-2 transition-transform',
              color.toLowerCase() === c.toLowerCase()
                ? 'border-crt-phosphor scale-110'
                : 'border-crt-cream/30',
            )}
            style={{ background: c }}
            title={c}
          />
        ))}
        <label
          className={clsx(
            'touch-press w-12 h-12 rounded-lg border-2 relative overflow-hidden cursor-pointer',
            !isPreset ? 'border-crt-phosphor scale-110' : 'border-crt-cream/30',
          )}
          title="Custom color"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'conic-gradient(from 0deg,#ff3b30,#ffd60a,#2fbf71,#00e5ff,#4b3fff,#a855f7,#ff4fa1,#ff3b30)',
            }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  )
}

function StickerGrid({ onPick }: { onPick: (assetId: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STICKERS.map((s) => (
        <button
          key={s.id}
          onClick={() => onPick(s.id)}
          className="touch-press aspect-square bg-black/40 border-2 border-crt-cream/30 rounded-xl flex items-center justify-center"
          style={{ color: s.color }}
          title={s.name}
        >
          <span style={{ fontSize: 36, lineHeight: 1 }}>{s.glyph}</span>
        </button>
      ))}
    </div>
  )
}

