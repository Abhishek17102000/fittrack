import type { NotifPrefs, DoseUnit } from '../types'
import { diffDays, shiftToAppDay } from './dateEngine'

export type ReminderKind = 'gym' | 'supp' | 'protein' | 'meals' | 'weight' | 'waist'

export interface Reminder {
  /** Unique per reminder per day, so it fires once. */
  id: string
  kind: ReminderKind
  /** Position in the app-day (minutes since the day boundary). */
  atMin: number
  title: string
  body: string
  route: string
}

export interface ReminderCtx {
  today: string
  boundaryHour: number
  /** Minutes since the day boundary right now. */
  minutesNow: number
  prefs: NotifPrefs
  gym: { planned: boolean; name: string; doneToday: boolean }
  supps: { id: string; name: string; dose: number; unit: DoseUnit; reminderTime: string; state: 'due' | 'overdue' | 'taken' | 'none' }[]
  proteinG: number
  proteinTarget: number
  foodLogsToday: number
  lastWeightDate?: string
  lastWaistDate?: string
}

/** Reminders that apply today (their time may still be in the future) and whose data is still missing. */
export function buildReminders(c: ReminderCtx): Reminder[] {
  const p = c.prefs
  const at = (t: string) => shiftToAppDay(t, c.boundaryHour)
  const out: Reminder[] = []

  if (p.gym && c.gym.planned && !c.gym.doneToday) {
    out.push({
      id: `gym:${c.today}`,
      kind: 'gym',
      atMin: at(p.gymTime),
      title: 'Time to train 💪',
      body: `Today: ${c.gym.name}. Your plan is ready.`,
      route: '/',
    })
  }

  if (p.supplements) {
    for (const s of c.supps) {
      if (s.state !== 'due' && s.state !== 'overdue') continue
      out.push({
        id: `supp:${s.id}:${c.today}`,
        kind: 'supp',
        atMin: at(s.reminderTime),
        title: `${s.name} ${s.state === 'overdue' ? '(overdue)' : 'due'}`,
        body: `${s.dose} ${s.unit} - tap to mark it as taken.`,
        route: '/supps',
      })
    }
  }

  if (p.meals && c.foodLogsToday === 0) {
    out.push({
      id: `meals:${c.today}`,
      kind: 'meals',
      atMin: at(p.mealsTime),
      title: 'Log your meals 🍽️',
      body: "You haven't logged any food today. It takes 10 seconds.",
      route: '/diet',
    })
  }

  if (p.protein && c.foodLogsToday > 0 && c.proteinG < c.proteinTarget * 0.6) {
    out.push({
      id: `protein:${c.today}`,
      kind: 'protein',
      atMin: at(p.proteinTime),
      title: 'Protein check',
      body: `${Math.round(c.proteinG)} g of ${c.proteinTarget} g so far. Add paneer, dal, soya or curd at your next meal.`,
      route: '/diet',
    })
  }

  if (p.weighIn) {
    const since = c.lastWeightDate ? diffDays(c.lastWeightDate, c.today) : Infinity
    if (since >= p.weighInEveryDays) {
      out.push({
        id: `weight:${c.today}`,
        kind: 'weight',
        atMin: at(p.weighInTime),
        title: 'Weigh-in time ⚖️',
        body: c.lastWeightDate ? `Last weight was ${since} days ago. Log today's.` : 'Log your first weight to start the trend.',
        route: '/progress',
      })
    }
  }

  if (p.waist) {
    const since = c.lastWaistDate ? diffDays(c.lastWaistDate, c.today) : Infinity
    if (since >= p.waistEveryDays) {
      out.push({
        id: `waist:${c.today}`,
        kind: 'waist',
        atMin: at(p.weighInTime) + 5,
        title: 'Measure your waist 📏',
        body: 'Measure at the navel, relaxed. Waist is a better progress signal than the scale.',
        route: '/progress',
      })
    }
  }

  return out.sort((a, b) => a.atMin - b.atMin)
}

export const dueReminders = (c: ReminderCtx): Reminder[] => buildReminders(c).filter((r) => r.atMin <= c.minutesNow)
