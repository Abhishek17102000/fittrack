import { db } from '../db/db'
import type { DayKey, Profile } from '../types'
import { planReminders, type PlannedReminder } from '../engine/reminderPlan'

/** Reads the database and builds the next week's reminder plan for the OS scheduler. */
export async function buildNativePlan(a: { today: string; profile: Profile; schedule: Record<number, DayKey>; overrides: Record<string, DayKey> }): Promise<PlannedReminder[]> {
  const { today, profile } = a
  const [supplements, supplementLogs, sessions, foodLogs, foods, bodies] = await Promise.all([
    db.supplements.toArray(),
    db.supplementLogs.toArray(),
    db.sessions.where('date').equals(today).toArray(),
    db.foodLogs.where('date').equals(today).toArray(),
    db.foods.toArray(),
    db.bodyLogs.orderBy('date').toArray(),
  ])
  const food = new Map(foods.map((f) => [f.id, f]))
  const lastOf = (k: 'weightKg' | 'waistCm') => [...bodies].reverse().find((b) => b[k] !== undefined)?.date
  return planReminders({
    today,
    boundaryHour: profile.dayBoundaryHour,
    prefs: profile.notif,
    schedule: a.schedule,
    overrides: a.overrides,
    supplements,
    supplementLogs,
    proteinTarget: profile.proteinTargetG,
    todayState: {
      gymDone: sessions.some((s) => s.status === 'done'),
      proteinG: foodLogs.reduce((s, l) => s + (food.get(l.foodId)?.proteinG ?? 0) * l.portions, 0),
      foodLogs: foodLogs.length,
    },
    lastWeightDate: lastOf('weightKg'),
    lastWaistDate: lastOf('waistCm'),
  })
}
