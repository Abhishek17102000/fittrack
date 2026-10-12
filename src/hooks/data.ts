import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from './app'
import { evaluateLevel, lastWorkoutDate, loadMode, computeStreak, type LevelStatus, type Streak } from '../engine/levelEngine'
import { resolveDayKey, buildWorkout, type Workout } from '../engine/scheduleEngine'
import { suppStatus, type SuppStatus } from '../engine/supplementEngine'
import type { DayKey, Food, FoodLog, Supplement } from '../types'
import { TEMPLATES } from '../data/templates'

/** Which workout is planned for `date` (honours a manual override for that day). */
export function usePlannedDay(date?: string): { dayKey: DayKey; workout: Workout } {
  const { today, weekday, schedule, overrides, profile } = useApp()
  const d = date ?? today
  const wd = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : weekday
  const dayKey = resolveDayKey(wd, schedule, overrides[d])
  return { dayKey, workout: buildWorkout(dayKey, profile.level) }
}

export function useSessionsOn(date: string) {
  return useLiveQuery(() => db.sessions.where('date').equals(date).toArray(), [date])
}

export function useLoad() {
  const { today, profile } = useApp()
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  const last = lastWorkoutDate(sessions ?? [])
  return { ...loadMode(today, profile.programStart, last), lastWorkout: last }
}

export function useLevelStatus(): LevelStatus | undefined {
  const { today, profile, schedule, overrides } = useApp()
  const sessions = useLiveQuery(() => db.sessions.where('date').aboveOrEqual(profile.levelSince).toArray(), [profile.levelSince])
  const sets = useLiveQuery(() => db.sets.where('date').aboveOrEqual(profile.levelSince).toArray(), [profile.levelSince])
  const lastBody = useLiveQuery(() => db.bodyLogs.orderBy('date').filter((b) => b.weightKg !== undefined).last(), [])
  const allDeadlifts = useLiveQuery(() => db.sets.where('exerciseId').anyOf('deadlift', 'plank', 'pushup').toArray(), [])
  if (!sessions || !sets) return undefined
  // plank / push-up / deadlift checks look at best-ever, so merge those in
  const merged = allDeadlifts ? [...sets, ...allDeadlifts.filter((s) => s.date < profile.levelSince)] : sets
  return evaluateLevel({
    level: profile.level,
    levelSince: profile.levelSince,
    today,
    schedule,
    overrides,
    sessions,
    sets: merged,
    weightKg: lastBody?.weightKg ?? profile.weightKg,
    snoozeUntil: profile.snoozeUntil,
  })
}

export function useStreak(): Streak {
  const { today, schedule, overrides, profile } = useApp()
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  if (!sessions) return { current: 0, best: 0 }
  const dates = new Set(sessions.map((s) => s.date))
  const earliest = sessions.reduce((m, s) => (s.date < m ? s.date : m), profile.programStart)
  return computeStreak(today, dates, schedule, overrides, earliest)
}

export function useFoodMap(): Record<string, Food> {
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  return Object.fromEntries((foods ?? []).map((f) => [f.id, f]))
}

export function dayTotals(logs: FoodLog[], foods: Record<string, Food>) {
  let proteinG = 0
  let kcal = 0
  for (const l of logs) {
    const f = foods[l.foodId]
    if (!f) continue
    proteinG += f.proteinG * l.portions
    kcal += f.kcal * l.portions
  }
  return { proteinG, kcal }
}

export function useDayFood(date: string) {
  const logs = useLiveQuery(() => db.foodLogs.where('date').equals(date).toArray(), [date])
  const foods = useFoodMap()
  const totals = dayTotals(logs ?? [], foods)
  return { logs: logs ?? [], foods, ...totals, ready: logs !== undefined }
}

export interface SuppRow {
  supp: Supplement
  status: SuppStatus
}

export function useSupplements(date: string): { rows: SuppRow[]; ready: boolean } {
  const supps = useLiveQuery(() => db.supplements.toArray(), [])
  const logs = useLiveQuery(() => db.supplementLogs.toArray(), [])
  if (!supps || !logs) return { rows: [], ready: false }
  const rows = supps.map((supp) => ({ supp, status: suppStatus(supp, date, logs) }))
  return { rows, ready: true }
}

export const dayName = (k: DayKey) => TEMPLATES[k].name
