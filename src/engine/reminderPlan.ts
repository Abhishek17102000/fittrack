import type { DayKey, NotifPrefs, Supplement, SupplementLog } from '../types'
import { addDays, weekdayOf } from './dateEngine'
import { buildReminders, type Reminder } from './reminderEngine'
import { resolveDayKey } from './scheduleEngine'
import { suppStatus } from './supplementEngine'
import { TEMPLATES } from '../data/templates'

export interface PlanInput {
  today: string
  boundaryHour: number
  /** Minutes since the day boundary right now (so today's already-passed reminders are dropped by the caller). */
  prefs: NotifPrefs
  schedule: Record<number, DayKey>
  overrides: Record<string, DayKey>
  supplements: Supplement[]
  supplementLogs: SupplementLog[]
  proteinTarget: number
  /** Today's real state, used for today only. */
  todayState: { gymDone: boolean; proteinG: number; foodLogs: number }
  lastWeightDate?: string
  lastWaistDate?: string
}

export interface PlannedReminder extends Reminder {
  /** App-day the reminder belongs to. */
  date: string
  /** Wall-clock calendar date + minutes of day when it should fire. */
  fireDate: string
  fireMinutes: number
}

/**
 * Reminders for the next `days` days, for scheduling with the OS (which can't evaluate conditions at fire time).
 * Today uses the real state (so answered prompts vanish); future days assume nothing has been done yet, and
 * the plan is rebuilt whenever data changes or the app opens.
 */
export function planReminders(inp: PlanInput, days = 7): PlannedReminder[] {
  const out: PlannedReminder[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(inp.today, i)
    const key = resolveDayKey(weekdayOf(date), inp.schedule, inp.overrides[date])
    const isToday = i === 0
    const list = buildReminders({
      today: date,
      boundaryHour: inp.boundaryHour,
      minutesNow: 0,
      prefs: inp.prefs,
      gym: { planned: TEMPLATES[key].kind !== 'rest', name: TEMPLATES[key].name, doneToday: isToday && inp.todayState.gymDone },
      supps: inp.supplements.map((s) => ({
        id: s.id,
        name: s.name,
        dose: s.dose,
        unit: s.unit,
        reminderTime: s.reminderTime,
        // future days: only the actual scheduled day, never a carried-over "overdue"
        state: ((st) => (!isToday && st === 'overdue' ? 'none' : st))(suppStatus(s, date, inp.supplementLogs).state),
      })),
      proteinG: isToday ? inp.todayState.proteinG : 0,
      proteinTarget: inp.proteinTarget,
      // future days: assume nothing logged yet, so the "log your meals" nudge applies; protein check needs logs, so it doesn't
      foodLogsToday: isToday ? inp.todayState.foodLogs : 0,
      lastWeightDate: inp.lastWeightDate,
      lastWaistDate: inp.lastWaistDate,
    })
    for (const r of list) {
      const wall = r.atMin + inp.boundaryHour * 60
      const dayShift = Math.floor(wall / 1440)
      out.push({ ...r, date, fireDate: addDays(date, dayShift), fireMinutes: wall % 1440 })
    }
  }
  return out
}

/** Stable positive 31-bit id for the OS (Android notification ids are ints). */
export function notificationId(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) & 0x7fffffff
}
