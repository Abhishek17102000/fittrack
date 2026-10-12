import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { AppProvider, useApp } from './hooks/app'
import { RemindersProvider } from './hooks/reminders'
import { Icon, type IconName } from './components/ui'
import Today from './pages/Today'
import Diet from './pages/Diet'
import Supplements from './pages/Supplements'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import Session from './pages/Session'
import Summary from './pages/Summary'
import Onboarding from './pages/Onboarding'
import { onNativeTap } from './lib/native'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'dumbbell' },
  { to: '/diet', label: 'Diet', icon: 'bowl' },
  { to: '/supps', label: 'Supps', icon: 'pill' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
]

/** Light/dark theme: follows the profile, or the phone when set to "system". */
function useTheme() {
  const { profile } = useApp()
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = profile.theme === 'dark' || (profile.theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1210' : '#f3f6f4')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [profile.theme])
}

/** Lets a tapped notification (handled in the service worker) deep-link into the app. */
function useNotificationNavigation() {
  const nav = useNavigate()
  useEffect(() => onNativeTap((route) => nav(route)), [nav])
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'NAVIGATE' && typeof e.data.route === 'string') nav(e.data.route)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [nav])
}

function TabBar() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl">
      <ul className="safe-bottom mx-auto flex max-w-xl px-2 pt-1.5">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) => clsx('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold', isActive ? 'text-accent' : 'text-muted')}>
              {({ isActive }) => (
                <>
                  <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-accent-soft')}>
                    <Icon name={t.icon} size={22} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Shell() {
  const { profile } = useApp()
  const loc = useLocation()
  useTheme()
  useNotificationNavigation()

  // always start a new screen at the top
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  if (!profile.onboarded) return <Onboarding />

  const immersive = loc.pathname.startsWith('/session/')
  return (
    <RemindersProvider>
      <motion.main key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="min-h-full">
        <Routes location={loc}>
          <Route path="/" element={<Today />} />
          <Route path="/diet" element={<Diet />} />
          <Route path="/supps" element={<Supplements />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/session/:id" element={<Session />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
      {!immersive && <TabBar />}
    </RemindersProvider>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
