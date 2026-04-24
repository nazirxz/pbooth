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

type Tab = 'border' | 'sticker'

export function DecorateScreen() {
  const goTo = useSession((s) => s.goTo)
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const filter = useSession((s) => s.filter)
  const theme = useTheme((s) => s.theme)

  const borderId = useDecoration((s) => s.borderId)
  const stickers = useDecoration((s) => s.stickers)
  const selectedId = useDecoration((s) => s.selectedStickerId)
  const setBorder = useDecoration((s) => s.setBorder)
  const addSticker = useDecoration((s) => s.addSticker)
  const moveSticker = useDecoration((s) => s.moveSticker)
  const removeSticker = useDecoration((s) => s.removeSticker)
  const selectSticker = useDecoration((s) => s.selectSticker)
  const resetDecoration = useDecoration((s) => s.reset)
  const setStickerScale = useDecoration((s) => s.setStickerScale)

  const [tab, setTab] = useState<Tab>('border')

  // Reset decoration for a fresh session.
  useEffect(() => {
    resetDecoration('classic-black')
  }, [resetDecoration])

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
            <TabButton active={tab === 'border'} onClick={() => setTab('border')}>
              BORDERS
            </TabButton>
            <TabButton active={tab === 'sticker'} onClick={() => setTab('sticker')}>
              STICKERS
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {tab === 'border' ? (
              <BorderGrid
                borders={availableBorders}
                selectedId={borderId}
                onPick={setBorder}
              />
            ) : (
              <StickerGrid onPick={(a) => addSticker(a)} />
            )}
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            <TVButton variant="ghost" size="md" onClick={() => goTo('preview')}>
              ⏭ SKIP
            </TVButton>
            <TVButton variant="primary" size="lg" onClick={() => goTo('preview')}>
              DONE ▶
            </TVButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'touch-press flex-1 py-3 border-2 rounded-xl font-crt text-xl tracking-widest',
        active
          ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor'
          : 'border-crt-cream/30 bg-black/40 text-crt-cream',
      )}
    >
      {children}
    </button>
  )
}

/* ─────────── Strip preview with sticker layer ─────────── */

function StripStage(props: {
  photos: CapturedPhoto[]
  filterId: string
  layout: PaperLayout
  borderId: string
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
    ctx.fillStyle = '#f5e6c8'
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
  }, [photos, filterId, borderId, layout, themeId])

  const handleStagePointerDown = (e: React.PointerEvent) => {
    // Tap on stage (outside a sticker) clears selection
    if (e.target === e.currentTarget) onStickerSelect(null)
  }

  return (
    <div
      ref={stageRef}
      className="relative rounded-2xl overflow-hidden bg-crt-cream shadow-[0_0_40px_rgba(0,0,0,0.4)]"
      style={{
        aspectRatio: `${layout.paper.w} / ${layout.paper.h}`,
        height: '100%',
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

