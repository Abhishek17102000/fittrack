import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db, patchProfile } from '../db/db'
import { Splash } from '../components/ui'
import type { DayKey, Profile } from '../types'
import { DEFAULT_SCHEDULE } from '../engine/scheduleEngine'
import { getAppDay, getTimeZone } from '../engine/dateEngine'

interface AppCtx {
  profile: Profile
  now: Date
  today: string
  weekday: number
  tz: string
  schedule: Record<number, DayKey>
  overrides: Record<string, DayKey>
  toast: (msg: string) => void
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp outside AppProvider')
  return c
}

/** Re-renders every 20 s and whenever the app returns to the foreground, so "today" is never stale. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 20000)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', tick)
    }
  }, [])
  return now
}

export function AppProvider({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(() => db.profile.get(1), [])
  const scheduleRows = useLiveQuery(() => db.schedule.toArray(), [])
  const overrideRows = useLiveQuery(() => db.dayOverrides.toArray(), [])
  const now = useNow()
  const tz = getTimeZone()
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const toastId = useRef(0)

  const toast = useCallback((msg: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  // Follow the device timezone (travel, DST changes in settings, etc.)
  useEffect(() => {
    if (profile && profile.timezone !== tz) {
      void patchProfile({ timezone: tz })
      if (profile.onboarded) toast(`Timezone changed to ${tz}`)
    }
  }, [profile, tz, toast])

  const schedule = useMemo(() => {
    const m: Record<number, DayKey> = { ...DEFAULT_SCHEDULE }
    for (const r of scheduleRows ?? []) m[r.weekday] = r.dayKey
    return m
  }, [scheduleRows])
  const overrides = useMemo(() => Object.fromEntries((overrideRows ?? []).map((o) => [o.date, o.dayKey])), [overrideRows])

  const value = useMemo<AppCtx | null>(() => {
    if (!profile) return null
    const { date, weekday } = getAppDay(now, tz, profile.dayBoundaryHour)
    return { profile, now, today: date, weekday, tz, schedule, overrides, toast }
  }, [profile, now, tz, schedule, overrides, toast])

  if (!value) return <Splash />

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 safe-top">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              role="status"
              className="pointer-events-auto max-w-sm rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg"
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
