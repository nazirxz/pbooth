import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

if (typeof window !== 'undefined' && (window as any).pbooth) {
  document.documentElement.classList.add('kiosk')
}

const SharePage = lazy(() =>
  import('./share/SharePage').then((m) => ({ default: m.SharePage })),
)

const path = window.location.pathname
const shareMatch = path.match(/^\/s\/([a-zA-Z0-9-]+)/)

if (shareMatch) {
  document.documentElement.classList.add('share-mode')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shareMatch ? (
      <Suspense fallback={null}>
        <SharePage sessionId={shareMatch[1]} />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
