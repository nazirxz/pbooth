import { useState } from 'react'
import { loginAdmin } from './admin-data'

interface Props {
  onSuccess: () => void
}

export function AdminLogin({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginAdmin(password)) {
      onSuccess()
    } else {
      setError(true)
      setShaking(true)
      setPassword('')
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Scanlines overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)' }}
      />

      <div
        className="relative z-10 w-full max-w-sm px-6"
        style={{ animation: shaking ? 'admin-shake 0.4s ease-out' : undefined }}
      >
        {/* Logo / title */}
        <div className="text-center mb-10">
          <div className="font-pixel text-crt-phosphor text-xs tracking-widest mb-4 rgb-split">
            PBOOTH
          </div>
          <h1 className="font-pixel text-white text-sm tracking-[0.2em] mb-2">
            ADMIN PANEL
          </h1>
          <div className="font-crt text-crt-cream/40 text-lg tracking-[0.3em]">
            ◆ RESTRICTED ACCESS ◆
          </div>
        </div>

        {/* Form panel */}
        <div
          className="border border-crt-phosphor/30 rounded-xl p-6 bg-black/60"
          style={{ boxShadow: '0 0 40px rgba(57,255,20,0.08), inset 0 0 40px rgba(0,0,0,0.5)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-password"
                className="block font-crt text-crt-cream/60 text-sm tracking-widest mb-2"
              >
                PASSWORD
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(false)
                }}
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                className={[
                  'w-full bg-black border-2 rounded-lg px-4 py-3',
                  'font-mono text-lg text-crt-phosphor',
                  'placeholder:text-crt-cream/20 outline-none',
                  'transition-all duration-200',
                  error
                    ? 'border-crt-red shadow-[0_0_16px_rgba(255,59,48,0.4)]'
                    : 'border-crt-phosphor/40 focus:border-crt-phosphor focus:shadow-[0_0_16px_rgba(57,255,20,0.25)]',
                ].join(' ')}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              />
              {error && (
                <p className="font-crt text-crt-red text-base mt-2 tracking-wider">
                  ✗ INCORRECT PASSWORD
                </p>
              )}
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={!password}
              className={[
                'w-full py-3 rounded-lg font-pixel text-xs tracking-widest',
                'transition-all duration-200',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                'enabled:hover:scale-[1.02] enabled:active:scale-[0.98]',
                'bg-crt-phosphor text-black',
                'enabled:shadow-[0_0_20px_rgba(57,255,20,0.5)]',
                'enabled:hover:shadow-[0_0_30px_rgba(57,255,20,0.7)]',
              ].join(' ')}
            >
              ENTER
            </button>
          </form>
        </div>

        <p className="text-center font-crt text-crt-cream/25 text-base mt-6 tracking-widest">
          ◆ PBOOTH ADMIN · {new Date().getFullYear()} ◆
        </p>
      </div>

      <style>{`
        @keyframes admin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
