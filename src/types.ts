export type Level = 'beginner' | 'intermediate' | 'advanced' | 'pro'
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced', 'pro']
export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Pro',
}

export type DayKey = 'lower' | 'upper' | 'intervals_core' | 'fullbody' | 'circuit_core' | 'mobility' | 'rest'
export type Section = 'warmup' | 'main' | 'finisher' | 'cooldown'
export type Measure = 'reps' | 'time'
export type Rpe = 'easy' | 'good' | 'hard'
export type MealKey = 'breakfast' | 'lunch' | 'snack' | 'pregym' | 'dinner'

export interface Exercise {
  id: string
  name: string
  muscles: string[]
  type: 'strength' | 'cardio' | 'core' | 'mobility'
  measure: Measure
  /** Loaded lifts get weight suggestions + progression. */
  loaded?: boolean
  /** Weight added when progression triggers (kg). */
  increment?: number
  /** Counts toward level-up "lifts progressed". */
  mainLift?: boolean
  perSide?: boolean
  steps: string[]
  tips: string[]
  mistakes: string[]
  easierId?: string
  harderId?: string
  /** YouTube search used when no verified video id is set. */
  query: string
}

export interface NotifPrefs {
  enabled: boolean
  gym: boolean
  gymTime: string
  supplements: boolean
  protein: boolean
  proteinTime: string
  meals: boolean
  mealsTime: string
  weighIn: boolean
  weighInTime: string
  weighInEveryDays: number
  waist: boolean
  waistEveryDays: number
}

export interface Profile {
  id: 1
  name: string
  heightCm: number
  weightKg: number
  goalKg: number
  timezone: string
  dayBoundaryHour: number
  level: Level
  levelSince: string
  programStart: string
  snoozeUntil?: string
  proteinTargetG: number
  kcalTarget: number
  vegetarian: boolean
  theme: 'dark' | 'light' | 'system'
  onboarded: boolean
  seedVersion: number
  notif: NotifPrefs
}

export interface ScheduleRow { weekday: number; dayKey: DayKey }
export interface DayOverride { date: string; dayKey: DayKey }

export interface Session {
  id?: number
  date: string
  dayKey: DayKey
  level: Level
  startedAt: number
  finishedAt?: number
  status: 'in_progress' | 'done' | 'skipped'
  /** Which exercise (index) the user was on, so resuming lands in the right place. */
  cursor?: number
}

export interface SetLog {
  id?: number
  sessionId: number
  blockIdx: number
  exerciseId: string
  section: Section
  setNo: number
  targetLo?: number
  targetHi?: number
  targetSeconds?: number
  restSec: number
  weightKg?: number
  reps?: number
  seconds?: number
  rpe?: Rpe
  done: boolean
  /** Date of the session, denormalised for history queries. */
  date: string
}

export interface Food { id: string; name: string; serving: string; proteinG: number; kcal: number; veg: boolean; custom?: boolean }
export interface FoodLog { id?: number; date: string; meal: MealKey; foodId: string; portions: number }

export type SuppSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'everyNDays'; n: number; anchor: string }
export type DoseUnit = 'g' | 'mg' | 'mcg' | 'IU' | 'capsule'
export interface Supplement {
  id: string
  name: string
  dose: number
  unit: DoseUnit
  schedule: SuppSchedule
  reminderTime: string
  active: boolean
  note?: string
  /** First day the supplement is tracked; earlier scheduled doses are never reported as missed. */
  since?: string
}
export interface SupplementLog { id?: number; date: string; supplementId: string; takenAt: number }

export interface BodyLog { id?: number; date: string; weightKg?: number; waistCm?: number }
export interface LevelEvent { id?: number; date: string; from: Level; to: Level; reason: string }
export interface NotifiedRow { key: string; at: number; dismissed?: boolean }
export interface VideoOverride { exerciseId: string; videoId: string }
