import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Apply the saved theme (light default) before first paint.
import { getTheme, applyTheme } from './lib/theme'
applyTheme(getTheme())

// Install the MOBILE bridge (window.grantharbor) when there isn't one — i.e. the Capacitor build,
// where there's no Electron preload. No-op on desktop (preload already set it). This is what brings
// the Pro ingestion agent (Discover) to life on mobile. See lib/mobileBridge.ts.
import { installMobileBridge } from './lib/mobileBridge'
installMobileBridge()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
