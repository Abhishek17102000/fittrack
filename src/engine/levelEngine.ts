import type { DayKey, Level, Session, SetLog } from '../types'
import { addDays, diffDays, weekdayOf } from './dateEngine'
import { resolveDayKey } from './scheduleEngine'
import { setScore } from './progression'
import { EXERCISE_MAP } from '../data/exercises'
import { TEMPLATES } from '../data/templates'

export interface LevelRule {
  weeks: number
  minConsistency: number
  minProgressed: number
  next: Level
}

export const LEVEL_RULES: Partial<Record<Level, LevelRule>> = {
  beginner: { weeks: 4, minConsistency: 0.8, minProgressed: 3, next: 'intermediate' },
  intermediate: { weeks: 8, minConsistency: 0.8, minProgressed: 5, next: 'advanced' },
  advanced: { weeks: 12, minConsistency: 0.85, minProgressed: 5, next: 'pro' },
}

export interface LevelCheck {
  label: string
  ok: boolean
  detail: string
}

export interface LevelStatus {
  rule?: LevelRule
  /** Window has elapsed AND every check passes AND not snoozed. */
  eligible: boolean
  windowElapsed: boolean
  daysLeft: number
  consistency: number
  sessionsDone: number
  sessionsPlanned: number
  progressed: string[]
  checks: LevelCheck[]
}

export interface LevelInput {
  level: Level
  levelSince: string
  today: string
  schedule: Record<number, DayKey>
  overrides?: Record<string, DayKey>
  sessions: Session[]
  sets: SetLog[]
  weightKg: number
  snoozeUntil?: string
}

const gymKind = (k: DayKey) => TEMPLATES[k].kind === 'gym'

export function evaluateLevel(inp: LevelInput): LevelStatus {
  const rule = LEVEL_RULES[inp.level]
  if (!rule) {
    return { eligible: false, windowElapsed: false, daysLeft: 0, consistency: 0, sessionsDone: 0, sessionsPlanned: 0, progressed: [], checks: [] }
  }
  const windowDays = rule.weeks * 7
  const elapsed = diffDays(inp.levelSince, inp.today)
  const windowElapsed = elapsed >= windowDays
  const daysLeft = Math.max(0, windowDays - elapsed)
  // Once the period is over, judge the most recent `weeks` weeks (never reaching back before this level began).
  const lookback = addDays(inp.today, -windowDays)
  const winStart = windowElapsed && lookback > inp.levelSince ? lookback : inp.levelSince
  const winEnd = inp.today

  // Consistency: gym days that have fully passed vs gym sessions actually completed in the window.
  let planned = 0
  for (let d = winStart; d < winEnd; d = addDays(d, 1)) {
    const key = resolveDayKey(weekdayOf(d), inp.schedule, inp.overrides?.[d])
    if (gymKind(key)) planned++
  }
  const doneSessions = inp.sessions.filter(
    (s) => s.status === 'done' && s.date >= winStart && s.date <= winEnd && gymKind(s.dayKey),
  )
  const sessionsDone = doneSessions.length
  const consistency = Math.min(1, sessionsDone / Math.max(1, planned))

  // Lifts that got heavier / more reps / longer: best of the later sessions beats the first session.
  const winSets = inp.sets.filter((s) => s.done && s.date >= winStart && s.date <= winEnd)
  const progressed: string[] = []
  const byExercise = new Map<string, SetLog[]>()
  for (const s of winSets) {
    const ex = EXERCISE_MAP[s.exerciseId]
    if (!ex?.mainLift) continue
    const arr = byExercise.get(s.exerciseId) ?? []
    arr.push(s)
    byExercise.set(s.exerciseId, arr)
  }
  for (const [id, rows] of byExercise) {
    const ex = EXERCISE_MAP[id]
    const dates = [...new Set(rows.map((r) => r.date))].sort()
    if (dates.length < 2) continue
    const first = Math.max(...rows.filter((r) => r.date === dates[0]).map((r) => setScore(ex, r)))
    const later = Math.max(...rows.filter((r) => r.date !== dates[0]).map((r) => setScore(ex, r)))
    if (later > first + 1e-9) progressed.push(ex.name)
  }

  // Effort: ease off promotion if the last week felt "hard" most of the time.
  const lastWeek = winSets.filter((s) => s.date > addDays(inp.today, -7) && s.rpe)
  const hardShare = lastWeek.length ? lastWeek.filter((s) => s.rpe === 'hard').length / lastWeek.length : 0

  const checks: LevelCheck[] = [
    {
      label: `${rule.weeks} weeks at this level`,
      ok: windowElapsed,
      detail: windowElapsed ? 'Done' : `${daysLeft} days to go`,
    },
    {
      label: `Attend ≥ ${Math.round(rule.minConsistency * 100)}% of gym days`,
      ok: consistency >= rule.minConsistency,
      detail: `${sessionsDone} of ${planned} (${Math.round(consistency * 100)}%)`,
    },
    {
      label: `Progress on ≥ ${rule.minProgressed} main lifts`,
      ok: progressed.length >= rule.minProgressed,
      detail: `${progressed.length} so far`,
    },
    {
      label: 'Last week not mostly "hard"',
      ok: hardShare <= 0.3,
      detail: lastWeek.length ? `${Math.round(hardShare * 100)}% hard` : 'No effort ratings yet',
    },
  ]

  const bestOf = (id: string, f: (s: SetLog) => number) => {
    const v = inp.sets.filter((s) => s.done && s.exerciseId === id).map(f)
    return v.length ? Math.max(...v) : 0
  }
  if (inp.level === 'intermediate') {
    const plank = bestOf('plank', (s) => s.seconds ?? 0)
    const pushups = bestOf('pushup', (s) => s.reps ?? 0)
    checks.push({ label: 'Hold a plank for 60 s', ok: plank >= 60, detail: plank ? `best ${plank}s` : 'Edit the seconds on a plank set' })
    checks.push({ label: '5 push-ups with good form', ok: pushups >= 5, detail: pushups ? `best ${pushups}` : 'Not logged yet' })
  }
  if (inp.level === 'advanced') {
    const need = Math.round(inp.weightKg * 1.25 * 2) / 2
    const dl = bestOf('deadlift', (s) => s.weightKg ?? 0)
    checks.push({ label: `Deadlift ≥ ${need} kg (1.25× bodyweight)`, ok: dl >= need, detail: dl ? `best ${dl} kg` : 'Not logged yet' })
  }

  const snoozed = !!inp.snoozeUntil && inp.snoozeUntil > inp.today
  const eligible = checks.every((c) => c.ok) && !snoozed
  return { rule, eligible, windowElapsed, daysLeft, consistency, sessionsDone, sessionsPlanned: planned, progressed, checks }
}

/** Date of the most recent completed workout, if any. */
export function lastWorkoutDate(sessions: Session[]): string | undefined {
  let best: string | undefined
  for (const s of sessions) if (s.status === 'done' && (!best || s.date > best)) best = s.date
  return best
}

/** 14+ days since the last workout (and at least one ever) → ease back in. */
export function isComeback(today: string, lastDone?: string): boolean {
  return !!lastDone && diffDays(lastDone, today) >= 14
}

/** Every 7th week of the current programme is a lighter week. */
export function isDeloadWeek(today: string, programStart: string): boolean {
  const w = Math.floor(diffDays(programStart, today) / 7)
  return w >= 6 && (w + 1) % 7 === 0
}

export type LoadMode = 'normal' | 'deload' | 'comeback'

export function loadMode(today: string, programStart: string, lastDone?: string): { mode: LoadMode; factor: number } {
  if (isComeback(today, lastDone)) return { mode: 'comeback', factor: 0.8 }
  if (isDeloadWeek(today, programStart)) return { mode: 'deload', factor: 0.6 }
  return { mode: 'normal', factor: 1 }
}

export interface Streak {
  current: number
  best: number
}

/**
 * Streak = consecutive completed workout days. Rest days never break it; a missed gym/mobility day does.
 * Today does not break it until the day is over.
 */
export function computeStreak(
  today: string,
  doneDates: Set<string>,
  schedule: Record<number, DayKey>,
  overrides: Record<string, DayKey>,
  earliest: string,
): Streak {
  if (earliest > today) return { current: 0, best: 0 }
  const required = (d: string) => TEMPLATES[resolveDayKey(weekdayOf(d), schedule, overrides[d])].kind !== 'rest'

  let current = 0
  for (let d = today; d >= earliest; d = addDays(d, -1)) {
    if (doneDates.has(d)) current++
    else if (d === today) continue
    else if (!required(d)) continue
    else break
  }
  let best = 0
  let run = 0
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (doneDates.has(d)) run++
    else if (d === today) continue
    else if (required(d)) run = 0
    best = Math.max(best, run)
  }
  return { current, best: Math.max(best, current) }
}
