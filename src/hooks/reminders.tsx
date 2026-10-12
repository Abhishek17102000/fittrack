import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from './app'
import { dueReminders, type Reminder, type ReminderCtx } from '../engine/reminderEngine'
import { resolveDayKey } from '../engine/scheduleEngine'
import { minutesIntoAppDay } from '../engine/dateEngine'
import { suppStatus } from '../engine/supplementEngine'
import { TEMPLATES } from '../data/templates'
import { permissionState, showNotification } from '../lib/notify'
import { cancelNativeReminders, isNative, syncNativeReminders } from '../lib/native'
import { buildNativePlan } from '../lib/nativePlan'

/** A reminder fires as a system notification only if it became due within this window (no stale spam on app open). */
const FIRE_WINDOW_MIN = 180

async function gather(args: {
  today: string
  weekday: number
  boundaryHour: number
  minutesNow: number
  profile: ReturnType<typeof useApp>['profile']
  schedule: ReturnType<typeof useApp>['schedule']
  overrides: ReturnType<typeof useApp>['overrides']
}): Promise<ReminderCtx> {
  const { today, weekday, profile, schedule, overrides } = args
  const dayKey = resolveDayKey(weekday, schedule, overrides[today])
  const [sessions, supps, suppLogs, foodLogs, foods, bodies] = await Promise.all([
    db.sessions.where('date').equals(today).toArray(),
    db.supplements.toArray(),
    db.supplementLogs.toArray(),
    db.foodLogs.where('date').equals(today).toArray(),
    db.foods.toArray(),
    db.bodyLogs.orderBy('date').toArray(),
  ])
  const foodMap = new Map(foods.map((f) => [f.id, f]))
  const proteinG = foodLogs.reduce((a, l) => a + (foodMap.get(l.foodId)?.proteinG ?? 0) * l.portions, 0)
  const lastOf = (key: 'weightKg' | 'waistCm') => [...bodies].reverse().find((b) => b[key] !== undefined)?.date
  return {
    today,
    boundaryHour: args.boundaryHour,
    minutesNow: args.minutesNow,
    prefs: profile.notif,
    gym: {
      planned: TEMPLATES[dayKey].kind !== 'rest',
      name: TEMPLATES[dayKey].name,
      doneToday: sessions.some((s) => s.status === 'done'),
    },
    supps: supps.map((s) => ({
      id: s.id,
      name: s.name,
      dose: s.dose,
      unit: s.unit,
      reminderTime: s.reminderTime,
      state: suppStatus(s, today, suppLogs).state,
    })),
    proteinG,
    proteinTarget: profile.proteinTargetG,
    foodLogsToday: foodLogs.length,
    lastWeightDate: lastOf('weightKg'),
    lastWaistDate: lastOf('waistCm'),
  }
}

/**
 * Evaluates reminders against the live database. Returns the ones currently due and still unanswered
 * (shown as cards in the app) and fires system notifications for freshly-due ones while the app is running.
 */
export function useReminders(): { pending: Reminder[]; dismiss: (id: string) => Promise<void> } {
  const { now, today, weekday, profile, schedule, overrides } = useApp()
  const minutesNow = minutesIntoAppDay(now, profile.timezone, profile.dayBoundaryHour)
  const minuteBucket = Math.floor(now.getTime() / 60000)

  const ctx = useLiveQuery(
    () =>
      gather({ today, weekday, boundaryHour: profile.dayBoundaryHour, minutesNow, profile, schedule, overrides }),
    // minuteBucket re-evaluates as time passes; table reads inside `gather` re-run it when data changes
    [today, weekday, minuteBucket, profile, schedule, overrides],
  )
  const notified = useLiveQuery(() => db.notified.toArray(), [])
  const firing = useRef(new Set<string>())

  const due = ctx ? dueReminders(ctx) : []
  const hidden = new Set((notified ?? []).filter((n) => n.dismissed).map((n) => n.key))
  const pending = due.filter((r) => !hidden.has(r.id))

  useEffect(() => {
    // inside the Android app the OS schedules reminders (see RemindersProvider), so don't double-notify
    if (isNative() || !ctx || !notified || !profile.notif.enabled || permissionState() !== 'granted') return
    const seen = new Set(notified.map((n) => n.key))
    for (const r of dueReminders(ctx)) {
      if (seen.has(r.id) || firing.current.has(r.id)) continue
      if (ctx.minutesNow - r.atMin > FIRE_WINDOW_MIN) continue
      firing.current.add(r.id)
      void showNotification({ title: r.title, body: r.body, route: r.route, tag: r.id }).then((ok) => {
        if (ok) void db.notified.put({ key: r.id, at: Date.now() })
        else firing.current.delete(r.id)
      })
    }
  }, [ctx, notified, profile.notif.enabled])

  // Housekeeping: forget notification records older than two weeks.
  useEffect(() => {
    void db.notified.filter((n) => n.at < Date.now() - 14 * 86400000).delete()
  }, [today])

  const dismiss = async (id: string) => {
    await db.notified.put({ key: id, at: Date.now(), dismissed: true })
  }
  return { pending, dismiss }
}

interface RemindersValue {
  pending: Reminder[]
  dismiss: (id: string) => Promise<void>
}
const RCtx = createContext<RemindersValue>({ pending: [], dismiss: async () => undefined })

/** Mount once: evaluates reminders and fires notifications; screens read the pending list via usePending(). */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const v = useReminders()
  useNativeScheduling()
  return <RCtx.Provider value={v}>{children}</RCtx.Provider>
}

export const usePending = () => useContext(RCtx)

/**
 * Android app only: keeps the next 7 days of reminders scheduled with the OS so they fire even when the app is closed.
 * Rebuilt whenever relevant data changes, the app opens, or every 30 minutes while it is open.
 */
function useNativeScheduling() {
  const { now, today, profile, schedule, overrides } = useApp()
  const enabled = isNative() && profile.notif.enabled
  const bucket = Math.floor(now.getTime() / (30 * 60000))
  const plan = useLiveQuery(
    () => (enabled ? buildNativePlan({ today, profile, schedule, overrides }) : Promise.resolve(null)),
    [enabled, today, profile, schedule, overrides, bucket],
  )
  const last = useRef('')
  useEffect(() => {
    if (!isNative() || plan === undefined) return
    if (plan === null) {
      if (last.current !== 'off') void cancelNativeReminders()
      last.current = 'off'
      return
    }
    const sig = JSON.stringify(plan.map((p) => [p.id, p.fireDate, p.fireMinutes, p.body]))
    if (sig === last.current) return
    last.current = sig
    void syncNativeReminders(plan)
  }, [plan])
}
