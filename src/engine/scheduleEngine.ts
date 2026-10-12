import type { DayKey, Level, Section, Session } from '../types'
import { pick, TEMPLATES } from '../data/templates'
import { getExercise } from '../data/exercises'

export const DEFAULT_SCHEDULE: Record<number, DayKey> = {
  1: 'lower',
  2: 'upper',
  3: 'intervals_core',
  4: 'fullbody',
  5: 'circuit_core',
  6: 'mobility',
  0: 'rest',
}

export interface ResolvedBlock {
  blockIdx: number
  exerciseId: string
  section: Section
  sets: number
  reps?: [number, number]
  seconds?: number
  restSec: number
}

export interface Workout {
  dayKey: DayKey
  name: string
  kind: 'gym' | 'mobility' | 'rest'
  note?: string
  estMin: number
  blocks: ResolvedBlock[]
}

export function resolveDayKey(
  weekday: number,
  schedule: Record<number, DayKey> | undefined,
  override?: DayKey,
): DayKey {
  if (override) return override
  return (schedule && schedule[weekday]) || DEFAULT_SCHEDULE[weekday] || 'rest'
}

export function buildWorkout(dayKey: DayKey, level: Level): Workout {
  const t = TEMPLATES[dayKey]
  const blocks: ResolvedBlock[] = t.blocks.map((b, blockIdx) => {
    const exerciseId = pick(b.ex, level)
    const ex = getExercise(exerciseId)
    const reps = b.reps ? pick(b.reps, level) : undefined
    const seconds = b.seconds !== undefined ? pick(b.seconds, level) : undefined
    return {
      blockIdx,
      exerciseId,
      section: b.section,
      sets: pick(b.sets, level),
      // keep each block consistent with how its exercise is measured
      reps: ex.measure === 'reps' ? (reps ?? [10, 10]) : undefined,
      seconds: ex.measure === 'time' ? (seconds ?? 30) : undefined,
      restSec: pick(b.rest, level),
    }
  })
  return { dayKey, name: t.name, kind: t.kind, note: t.note, estMin: t.estMin, blocks }
}

export const targetLabel = (b: Pick<ResolvedBlock, 'sets' | 'reps' | 'seconds'>): string => {
  if (b.seconds !== undefined) {
    const t = b.seconds >= 120 ? `${Math.round(b.seconds / 60)} min` : `${b.seconds}s`
    return `${b.sets} × ${t}`
  }
  if (b.reps) {
    const [lo, hi] = b.reps
    return `${b.sets} × ${lo === hi ? lo : `${lo}-${hi}`}`
  }
  return `${b.sets} sets`
}

/** Sessions that count as "done" for a given date. */
export const isDoneSession = (s: Session) => s.status === 'done'
