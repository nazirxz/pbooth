import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SharePage } from './share/SharePage'
import './styles/global.css'

if (typeof window !== 'undefined' && (window as any).pbooth) {
  document.documentElement.classList.add('kiosk')
}

const path = window.location.pathname
const shareMatch = path.match(/^\/s\/([^/?#]+)/)

if (shareMatch) {
  document.documentElement.classList.add('share-mode')
}

// Visible in console so you can sanity-check routing on a phone via remote debug.
console.log('[pbooth] route', { path, sharedSessionId: shareMatch?.[1] ?? null })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shareMatch ? <SharePage sessionId={shareMatch[1]} /> : <App />}
  </React.StrictMode>,
)
