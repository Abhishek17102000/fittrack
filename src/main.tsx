import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { db, ensureSeeded } from './db/db'
import { getAppDay, getTimeZone } from './engine/dateEngine'
import { Splash } from './components/ui'

const root = createRoot(document.getElementById('root')!)
root.render(<Splash />)

async function boot() {
  const tz = getTimeZone()
  try {
    await db.open()
  } catch (err) {
    console.error('Database failed to open', err)
    root.render(
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-bold">FitTrack can't open its database</h1>
          <p className="text-muted">
            Your browser is blocking local storage (private mode or storage disabled). Open FitTrack in a normal browser window, or allow site data, then reload.
          </p>
        </div>
      </div>,
    )
    return
  }
  const existing = await db.profile.get(1)
  const boundary = existing?.dayBoundaryHour ?? 4
  await ensureSeeded(getAppDay(new Date(), tz, boundary).date, tz)
  // ask the browser not to evict our data when space runs low
  void navigator.storage?.persist?.()
  registerSW({ immediate: true })
  root.render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}

void boot()
