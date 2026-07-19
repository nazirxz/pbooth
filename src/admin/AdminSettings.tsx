import { FormEvent, useEffect, useState } from 'react'
import { formatIDR, getAdminSettings, updateAdminSettings } from './admin-data'

export function AdminSettings() {
  const [price, setPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    getAdminSettings()
      .then((data) => {
        if (!active) return
        setCurrentPrice(data.session_price)
        setPrice(String(data.session_price))
        setUpdatedAt(data.updated_at)
      })
      .catch((e) => { if (active) setError((e as Error).message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const numericPrice = Number(price)
  const valid = Number.isInteger(numericPrice) && numericPrice > 0 && numericPrice <= 100_000_000

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await updateAdminSettings(numericPrice)
      setCurrentPrice(data.session_price)
      setPrice(String(data.session_price))
      setUpdatedAt(data.updated_at)
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="admin-settings" className="max-w-2xl">
      <div className="mb-5">
        <span className="font-pixel text-crt-phosphor text-xs rgb-split">SETTINGS</span>
        <span className="font-crt text-crt-cream/30 text-lg tracking-widest"> — KIOSK CONFIG</span>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-crt-cream/15 bg-black/40 p-6 space-y-5">
        <div>
          <label htmlFor="session-price" className="block font-crt text-crt-cream/70 text-xl tracking-widest mb-2">
            HARGA PER SESI
          </label>
          <div className="flex items-center rounded-lg border border-crt-amber/40 bg-black/60 focus-within:border-crt-amber">
            <span className="font-pixel text-crt-amber text-xs px-4">RP</span>
            <input
              id="session-price"
              type="number"
              min="1"
              max="100000000"
              step="1000"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setSaved(false) }}
              disabled={loading || saving}
              className="w-full bg-transparent px-2 py-4 font-pixel text-crt-cream text-lg outline-none disabled:opacity-50"
            />
          </div>
          <p className="font-crt text-crt-cream/40 text-base tracking-wider mt-2">
            {valid ? `TAMPILAN KIOSK: ${formatIDR(numericPrice)} / SESSION` : 'MASUKKAN HARGA YANG VALID'}
          </p>
        </div>

        {error && <div className="font-crt text-crt-red text-lg">✗ {error}</div>}
        {saved && <div className="font-crt text-crt-phosphor text-lg">✓ HARGA TERSIMPAN — KIOSK AKAN TERSINKRON OTOMATIS</div>}

        <button
          id="admin-save-settings"
          type="submit"
          disabled={!valid || loading || saving || numericPrice === currentPrice}
          className="rounded-lg border border-crt-phosphor/50 bg-crt-phosphor/10 px-5 py-3 font-pixel text-crt-phosphor text-xs tracking-widest hover:bg-crt-phosphor/20 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          {saving ? 'SAVING...' : 'SIMPAN HARGA'}
        </button>

        {updatedAt && (
          <p className="font-crt text-crt-cream/25 text-base tracking-wider">
            TERAKHIR DIPERBARUI: {new Date(updatedAt).toLocaleString('id-ID')}
          </p>
        )}
      </form>
    </section>
  )
}
