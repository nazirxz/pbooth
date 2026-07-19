import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SharePage } from './share/SharePage'
import { AdminPage } from './admin/AdminPage'
import './styles/global.css'

if (typeof window !== 'undefined' && (window as any).pbooth) {
  document.documentElement.classList.add('kiosk')
}

const path = window.location.pathname
const shareMatch = path.match(/^\/s\/([^/?#]+)/)
const shareToken = new URLSearchParams(window.location.search).get('t') ?? ''
const adminMatch = path === '/admin' || path.startsWith('/admin/')

if (shareMatch) {
  document.documentElement.classList.add('share-mode')
} else if (adminMatch) {
  document.documentElement.classList.add('admin-mode')
}

// Visible in console so you can sanity-check routing on a phone via remote debug.
console.log('[pbooth] route', { path, sharedSessionId: shareMatch?.[1] ?? null, admin: adminMatch })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shareMatch
      ? <SharePage sessionId={shareMatch[1]} shareToken={shareToken} />
      : adminMatch
        ? <AdminPage />
        : <App />}
  </React.StrictMode>,
)
