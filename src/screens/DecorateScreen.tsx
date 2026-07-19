import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig, type FilterId } from '@/config/app-config'
import { useSession, type CapturedPhoto } from '@/state/session-store'
import { useDecoration, type PlacedSticker } from '@/state/decoration-store'
import { useTheme } from '@/state/theme-store'
import { STICKERS, getSticker } from '@/lib/stickers'
import { computePaperLayout, type PaperLayout, type PrintMode } from '@/lib/strip-layout'
import { buildGifFromPhotos } from '@/lib/gif-encoder'
import { uploadPhoto } from '@/lib/storage'
import { dbUpdateSession } from '@/lib/supabase/sessions'

type Step = 'sticker' | 'filter' | 'color' | 'print'

export function DecorateScreen() {
  const goTo = useSession((s) => s.goTo)
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const filter = useSession((s) => s.filter)
  const setFilter = useSession((s) => s.setFilter)
  const liveAsset = useSession((s) => s.liveAsset)
  const setLiveAsset = useSession((s) => s.setLiveAsset)
  const theme = useTheme((s) => s.theme)

  const stripColor = useDecoration((s) => s.stripColor)
  const printMode = useDecoration((s) => s.printMode)
  const stickers = useDecoration((s) => s.stickers)
  const selectedId = useDecoration((s) => s.selectedStickerId)
  const setStripColor = useDecoration((s) => s.setStripColor)
  const setPrintMode = useDecoration((s) => s.setPrintMode)
  const addSticker = useDecoration((s) => s.addSticker)
  const moveSticker = useDecoration((s) => s.moveSticker)
  const removeSticker = useDecoration((s) => s.removeSticker)
  const selectSticker = useDecoration((s) => s.selectSticker)
  const resetDecoration = useDecoration((s) => s.reset)
  const setStickerScale = useDecoration((s) => s.setStickerScale)

  const [step, setStep] = useState<Step>('sticker')

  const sessionId = useSession((s) => s.sessionId)
  const shareToken = useSession((s) => s.shareToken)
  const [uploadStatuses, setUploadStatuses] = useState<Record<number, 'idle' | 'uploading' | 'success' | 'error'>>({})
  const [isCheckingUpload, setIsCheckingUpload] = useState(false)
  const [hasUploadError, setHasUploadError] = useState(false)
  const uploadPromisesRef = useRef<Record<number, Promise<string | null>>>({})

  // Start background upload of all photos on mount
  useEffect(() => {
    if (!sessionId || !shareToken || photos.length === 0) return

    const startUpload = (p: CapturedPhoto) => {
      setUploadStatuses((prev) => ({ ...prev, [p.index]: 'uploading' }))
      
      const promise = uploadPhoto(sessionId, p.index, p.blob, shareToken)
        .then((path) => {
          if (path) {
            setUploadStatuses((prev) => ({ ...prev, [p.index]: 'success' }))
            return path
          } else {
            setUploadStatuses((prev) => ({ ...prev, [p.index]: 'error' }))
            setHasUploadError(true)
            return null
          }
        })
        .catch((err) => {
          console.error(`Upload failed for photo ${p.index}:`, err)
          setUploadStatuses((prev) => ({ ...prev, [p.index]: 'error' }))
          setHasUploadError(true)
          return null
        })

      uploadPromisesRef.current[p.index] = promise
    }

    photos.forEach((p) => {
      startUpload(p)
    })
  }, [sessionId, shareToken, photos])

  const handleRetryUpload = () => {
    if (!sessionId || !shareToken) return
    setHasUploadError(false)
    
    photos.forEach((p) => {
      if (uploadStatuses[p.index] === 'error') {
        setUploadStatuses((prev) => ({ ...prev, [p.index]: 'uploading' }))
        const promise = uploadPhoto(sessionId, p.index, p.blob, shareToken)
          .then((path) => {
            if (path) {
              setUploadStatuses((prev) => ({ ...prev, [p.index]: 'success' }))
              return path
            } else {
              setUploadStatuses((prev) => ({ ...prev, [p.index]: 'error' }))
              setHasUploadError(true)
              return null
            }
          })
          .catch((err) => {
            console.error(`Retry upload failed for photo ${p.index}:`, err)
            setUploadStatuses((prev) => ({ ...prev, [p.index]: 'error' }))
            setHasUploadError(true)
            return null
          })
        uploadPromisesRef.current[p.index] = promise
      }
    })
  }

  const handleDone = async () => {
    if (!sessionId) {
      goTo('preview')
      return
    }

    setIsCheckingUpload(true)
    
    try {
      const promises = Object.values(uploadPromisesRef.current)
      const results = await Promise.all(promises)
      
      const hasErrors = results.some((r) => r === null)
      if (hasErrors) {
        setIsCheckingUpload(false)
        setHasUploadError(true)
        return
      }

      setIsCheckingUpload(false)
      // Persist the chosen filter to the session row
      if (sessionId) {
        await dbUpdateSession(sessionId, { filter_id: filter, status: 'capturing' }).catch((e) =>
          console.warn('[decorate] failed to save filter_id', e),
        )
      }
      goTo('preview')
    } catch (e) {
      console.error('Error waiting for uploads:', e)
      setIsCheckingUpload(false)
      setHasUploadError(true)
    }
  }

  // Reset decoration for a fresh session.
  useEffect(() => {
    resetDecoration()
  }, [resetDecoration])

  // Build the live-photo GIF in the background while the user picks a border /
  // places stickers. By the time they hit Done, the asset is already cached
  // and PreviewScreen can skip straight to upload — no encode wait visible.
  // Plain setTimeout (not requestIdleCallback) so it fires reliably even with
  // CSS animations / sticker drags eating idle time.
  useEffect(() => {
    if (liveAsset?.filterId === filter || photos.length === 0) return
    let cancelled = false

    const handle = window.setTimeout(() => {
      if (cancelled) return
      console.log('[decorate] starting background gif encode')
      const filterCss = theme.filters.find((f) => f.id === filter)?.css ?? 'none'
      buildGifFromPhotos({ photos, filterCss })
        .then((gif) => {
          if (cancelled) return
          console.log('[decorate] gif ready, caching to session store')
          setLiveAsset({ ...gif, filterId: filter })
        })
        .catch((e) => console.warn('[decorate] background gif build failed', e))
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [liveAsset, photos, filter, theme, setLiveAsset])

  const layout = useMemo(() => computePaperLayout(template, printMode), [template, printMode])
  const filterCss = useMemo(
    () => theme.filters.find((f) => f.id === filter)?.css ?? 'none',
    [filter, theme],
  )

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="06" label="DECORATE" />

      <div className="grid grid-cols-[auto_1fr] gap-8 px-10 pb-4 min-h-0">
        <StripStage
          photos={photos}
          filterCss={filterCss}
          layout={layout}
          stripColor={stripColor}
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
              label="FILTER"
              active={step === 'filter'}
              onClick={() => setStep('filter')}
            />
            <StepBadge
              n={3}
              label="COLOR"
              active={step === 'color'}
              onClick={() => setStep('color')}
            />
            <StepBadge
              n={4}
              label="PRINT"
              active={step === 'print'}
              onClick={() => setStep('print')}
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {step === 'sticker' ? (
              <StickerGrid onPick={(a) => addSticker(a)} />
            ) : step === 'filter' ? (
              <FilterPicker
                selected={filter}
                onChange={(f) => {
                  setFilter(f)
                  // Invalidate pre-built live asset so it re-encodes with new filter
                  setLiveAsset(null)
                }}
              />
            ) : step === 'color' ? (
              <StripColorPicker color={stripColor} onChange={setStripColor} />
            ) : (
              <PrintModePicker selected={printMode} onChange={setPrintMode} />
            )}
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            {step === 'sticker' ? (
              <>
                <TVButton variant="ghost" size="md" onClick={() => goTo('preview')}>
                  ⏭ SKIP
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={() => setStep('filter')}>
                  NEXT ▶
                </TVButton>
              </>
            ) : step === 'filter' ? (
              <>
                <TVButton variant="ghost" size="md" onClick={() => setStep('sticker')}>
                  ◀ BACK
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={() => setStep('color')}>
                  NEXT ▶
                </TVButton>
              </>
            ) : step === 'color' ? (
              <>
                <TVButton variant="ghost" size="md" onClick={() => setStep('filter')}>
                  ◀ BACK
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={() => setStep('print')}>
                  NEXT ▶
                </TVButton>
              </>
            ) : (
              <>
                <TVButton variant="ghost" size="md" onClick={() => setStep('color')}>
                  ◀ BACK
                </TVButton>
                <TVButton variant="primary" size="lg" onClick={handleDone}>
                  DONE ▶
                </TVButton>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Background Upload Progress Overlay */}
      {isCheckingUpload && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-4 z-50 animate-fadeIn">
          <div className="w-16 h-16 border-4 border-crt-phosphor border-t-transparent rounded-full animate-spin mb-2" />
          <div className="font-crt text-3xl text-crt-phosphor tracking-widest animate-pulse">
            SAVING PHOTOS TO CLOUD...
          </div>
          <div className="font-crt text-lg text-crt-cream/65">
            Please wait while we secure your pictures
          </div>
        </div>
      )}

      {/* Upload Error Overlay */}
      {hasUploadError && !isCheckingUpload && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-6 z-50 p-8 text-center animate-fadeIn">
          <div className="font-pixel text-5xl text-red-500 mb-2 rgb-split">UPLOAD FAILED</div>
          <div className="font-crt text-lg text-crt-cream max-w-md leading-relaxed">
            Some photos failed to upload to the server. Please check your internet connection and try again.
          </div>
          <div className="flex gap-4">
            <TVButton variant="ghost" size="md" onClick={handleRetryUpload}>
              🔄 RETRY UPLOAD
            </TVButton>
            <TVButton variant="primary" size="md" onClick={() => goTo('preview')}>
              ⏭ SKIP (LOCAL ONLY)
            </TVButton>
          </div>
        </div>
      )}
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
  filterCss: string
  layout: PaperLayout
  stripColor: string
  stickers: PlacedSticker[]
  selectedId: string | null
  onStickerMove: (id: string, x: number, y: number) => void
  onStickerSelect: (id: string | null) => void
  onStickerRemove: (id: string) => void
  onStickerScale: (id: string, scale: number) => void
}) {
  const {
    photos,
    filterCss,
    layout,
    stripColor,
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
    let cancelled = false

    canvas.width = layout.paper.w
    canvas.height = layout.paper.h
    const ctx = canvas.getContext('2d')!

    drawPaper(ctx, canvas, stripColor)

    const draw = async () => {
      const loaded = await Promise.all(
        photos.map(async (p) => {
          try {
            return [p.index, await loadCanvasImage(p.dataUrl)] as const
          } catch (e) {
            console.warn(`[decorate] failed to load preview photo ${p.index}`, e)
            return [p.index, null] as const
          }
        }),
      )
      if (cancelled) return

      const imagesByIndex = new Map(loaded)
      drawPaper(ctx, canvas, stripColor)

      for (const section of layout.sections) {
        for (let i = 0; i < section.frames.length; i++) {
          const f = section.frames[i]
          const img = imagesByIndex.get(f.photoIndex)
          if (!img) continue
          ctx.save()
          ctx.filter = filterCss
          drawCover(ctx, img, f.x, f.y, f.w, f.h)
          ctx.restore()
        }
      }

      drawCutLine(ctx, layout)
    }

    void draw()

    return () => {
      cancelled = true
    }
  }, [photos, filterCss, stripColor, layout])

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

function drawPaper(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, stripColor: string) {
  ctx.save()
  ctx.filter = 'none'
  ctx.fillStyle = stripColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

function drawCutLine(ctx: CanvasRenderingContext2D, layout: PaperLayout) {
  if (!layout.cutLine) return
  ctx.save()
  ctx.filter = 'none'
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  ctx.setLineDash([8, 8])
  ctx.beginPath()
  ctx.moveTo(layout.cutLine.x, layout.cutLine.y1)
  ctx.lineTo(layout.cutLine.x, layout.cutLine.y2)
  ctx.stroke()
  ctx.restore()
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
    if (img.complete) {
      if (img.naturalWidth > 0) resolve(img)
      else reject(new Error('Image failed to load'))
    }
  })
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

const STRIP_COLOR_PRESETS = ['#224a34', '#a9d099', '#000000', '#ffffff']

function PrintModePicker({
  selected,
  onChange,
}: {
  selected: PrintMode
  onChange: (mode: PrintMode) => void
}) {
  const options: Array<{ mode: PrintMode; label: string; detail: string }> = [
    { mode: 'full-4x6', label: 'FULL 4X6', detail: 'NO CUT' },
    { mode: 'cut-2x6', label: 'CUT 2X6', detail: '2 PIECES' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => onChange(option.mode)}
          className={clsx(
            'touch-press min-h-40 rounded-xl border-4 bg-black/40 px-5 py-6 font-crt tracking-widest',
            selected === option.mode
              ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor shadow-[0_0_24px_rgba(57,255,20,0.3)]'
              : 'border-crt-cream/30 text-crt-cream',
          )}
        >
          <span className="block text-3xl">{option.label}</span>
          <span className="mt-3 block text-xl text-crt-amber">{option.detail}</span>
        </button>
      ))}
    </div>
  )
}

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

function FilterPicker({
  selected,
  onChange,
}: {
  selected: FilterId
  onChange: (f: FilterId) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {appConfig.filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id as FilterId)}
          className={clsx(
            'touch-press border-4 rounded-xl py-4 font-crt text-2xl tracking-widest shrink-0',
            selected === f.id
              ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.4)]'
              : 'border-crt-cream/30 bg-black/40 text-crt-cream',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
