import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './ui/App'
import './ui/styles.css'

// HashRouter so the built bundle works from any sub-path or a file:// copy without server config.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

// The offline shell. Registered after paint so it never competes with first render, and a failure
// is swallowed — this app worked as a plain page before it had a worker and must still work as one.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void import('./lib/notify').then((m) => m.registerServiceWorker())
  })
}
