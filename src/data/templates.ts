import type { DayKey, Level, Section } from '../types'

/** A value that is either the same for every level, or given per level (beginner → pro). */
export type PL<T> = T | { lv: [T, T, T, T] }
const L = <T>(b: T, i: T, a: T, p: T): PL<T> => ({ lv: [b, i, a, p] })

const LEVEL_IDX: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2, pro: 3 }

export function pick<T>(v: PL<T>, level: Level): T {
  if (typeof v === 'object' && v !== null && 'lv' in (v as object)) {
    return (v as { lv: [T, T, T, T] }).lv[LEVEL_IDX[level]]
  }
  return v as T
}

export interface BlockSpec {
  ex: PL<string>
  section: Section
  sets: PL<number>
  reps?: PL<[number, number]>
  seconds?: PL<number>
  rest: PL<number>
}

export interface TemplateSpec {
  key: DayKey
  name: string
  short: string
  kind: 'gym' | 'mobility' | 'rest'
  estMin: number
  note?: string
  blocks: BlockSpec[]
}

const MAIN_REPS = L<[number, number]>([10, 12], [8, 10], [6, 8], [5, 8])
const ACC_REPS = L<[number, number]>([12, 15], [10, 12], [10, 12], [8, 12])

const warm = (ex: string, o: { reps?: [number, number]; seconds?: number } = {}): BlockSpec => ({
  ex,
  section: 'warmup',
  sets: 1,
  rest: 0,
  ...o,
})

const WARMUP: BlockSpec[] = [
  warm('bike_easy', { seconds: 120 }),
  warm('bodyweight_squat', { reps: [10, 10] }),
  warm('hip_hinge', { reps: [10, 10] }),
  warm('arm_circles', { reps: [10, 10] }),
  warm('cat_cow', { reps: [10, 10] }),
  warm('plank', { seconds: 20 }),
]

const cool = (ex: string, seconds = 45, sets = 1): BlockSpec => ({ ex, section: 'cooldown', sets, seconds, rest: 0 })

export const TEMPLATES: Record<DayKey, TemplateSpec> = {
  lower: {
    key: 'lower',
    name: 'Lower Body Strength',
    short: 'Lower',
    kind: 'gym',
    estMin: 45,
    blocks: [
      ...WARMUP,
      { ex: L('goblet_squat', 'back_squat', 'back_squat', 'pause_squat'), section: 'main', sets: L(3, 4, 4, 5), reps: MAIN_REPS, rest: L(90, 90, 90, 120) },
      { ex: 'rdl', section: 'main', sets: L(3, 3, 4, 4), reps: L<[number, number]>([10, 12], [8, 10], [6, 10], [6, 8]), rest: 90 },
      { ex: 'walking_lunge', section: 'main', sets: L(2, 3, 3, 4), reps: L<[number, number]>([8, 10], [10, 10], [10, 12], [10, 12]), rest: 60 },
      { ex: 'leg_press', section: 'main', sets: 3, reps: ACC_REPS, rest: 60 },
      { ex: 'calf_raise', section: 'main', sets: 3, reps: [12, 15], rest: 30 },
      { ex: 'farmers_carry', section: 'finisher', sets: L(3, 4, 4, 5), seconds: 30, rest: 60 },
      cool('hamstring_stretch'),
      cool('hip_flexor_stretch'),
    ],
  },
  upper: {
    key: 'upper',
    name: 'Upper Body Strength',
    short: 'Upper',
    kind: 'gym',
    estMin: 45,
    blocks: [
      ...WARMUP,
      { ex: L('db_bench_press', 'bench_press', 'bench_press', 'bench_press'), section: 'main', sets: L(3, 4, 4, 5), reps: MAIN_REPS, rest: L(90, 90, 90, 120) },
      { ex: L('assisted_pullup', 'lat_pulldown', 'pullup', 'weighted_pullup'), section: 'main', sets: L(3, 4, 4, 5), reps: L<[number, number]>([8, 10], [8, 10], [6, 10], [5, 8]), rest: 90 },
      { ex: 'db_shoulder_press', section: 'main', sets: L(3, 3, 4, 4), reps: L<[number, number]>([10, 12], [10, 10], [8, 10], [8, 10]), rest: 60 },
      { ex: 'seated_cable_row', section: 'main', sets: 3, reps: ACC_REPS, rest: 60 },
      { ex: 'face_pull', section: 'main', sets: 3, reps: [15, 15], rest: 45 },
      { ex: 'dead_hang', section: 'finisher', sets: 3, seconds: L(20, 30, 45, 60), rest: 60 },
      cool('doorway_chest'),
      cool('childs_pose'),
    ],
  },
  intervals_core: {
    key: 'intervals_core',
    name: 'Intervals + Core',
    short: 'Intervals',
    kind: 'gym',
    estMin: 45,
    note: 'Intervals: push hard for the work time, then fully ease off for the rest. Then run the core circuit with minimal rest.',
    blocks: [
      ...WARMUP,
      { ex: 'interval_bike', section: 'main', sets: L(5, 8, 10, 8), seconds: L(30, 30, 30, 45), rest: L(90, 90, 75, 75) },
      { ex: 'plank', section: 'main', sets: L(2, 3, 3, 4), seconds: L(30, 45, 60, 75), rest: 30 },
      { ex: 'dead_bug', section: 'main', sets: L(2, 3, 3, 4), reps: [10, 10], rest: 30 },
      { ex: 'side_plank', section: 'main', sets: L(2, 3, 3, 4), seconds: L(20, 30, 40, 45), rest: 30 },
      { ex: 'bird_dog', section: 'main', sets: L(2, 3, 3, 4), reps: [10, 10], rest: 30 },
      { ex: 'pallof_press', section: 'main', sets: L(2, 3, 3, 4), reps: [10, 10], rest: 30 },
      { ex: 'glute_bridge', section: 'main', sets: L(2, 3, 3, 4), reps: [15, 15], rest: 30 },
      { ex: 'incline_walk', section: 'finisher', sets: 1, seconds: 600, rest: 0 },
      cool('childs_pose'),
    ],
  },
  fullbody: {
    key: 'fullbody',
    name: 'Full Body Strength',
    short: 'Full body',
    kind: 'gym',
    estMin: 45,
    blocks: [
      ...WARMUP,
      { ex: 'deadlift', section: 'main', sets: L(3, 4, 4, 5), reps: L<[number, number]>([8, 10], [6, 8], [5, 6], [3, 5]), rest: 120 },
      { ex: 'incline_db_press', section: 'main', sets: L(3, 3, 4, 4), reps: L<[number, number]>([10, 12], [10, 10], [8, 10], [8, 10]), rest: 60 },
      { ex: L('reverse_lunge', 'bulgarian_split_squat', 'bulgarian_split_squat', 'bulgarian_split_squat'), section: 'main', sets: 3, reps: L<[number, number]>([8, 10], [8, 8], [8, 10], [8, 10]), rest: 60 },
      { ex: 'single_arm_row', section: 'main', sets: 3, reps: [10, 12], rest: 60 },
      { ex: L('dead_bug', 'hanging_knee_raise', 'hanging_leg_raise', 'hanging_leg_raise'), section: 'main', sets: 3, reps: [10, 12], rest: 45 },
      { ex: 'suitcase_carry', section: 'finisher', sets: 3, seconds: 30, rest: 45 },
      cool('hamstring_stretch'),
      cool('doorway_chest'),
    ],
  },
  circuit_core: {
    key: 'circuit_core',
    name: 'Metabolic Circuit + Core',
    short: 'Circuit',
    kind: 'gym',
    estMin: 45,
    note: 'Circuit: 40 s work / 20 s rest. Do each exercise, then move to the next, and repeat the loop for the rounds shown. Short rests between rounds.',
    blocks: [
      ...WARMUP,
      { ex: 'kb_swing', section: 'main', sets: L(3, 4, 5, 5), seconds: 40, rest: 20 },
      { ex: L('knee_pushup', 'pushup', 'pushup', 'pushup'), section: 'main', sets: L(3, 4, 5, 5), reps: L<[number, number]>([6, 10], [8, 12], [12, 20], [15, 25]), rest: 20 },
      { ex: 'goblet_squat', section: 'main', sets: L(3, 4, 5, 5), seconds: 40, rest: 20 },
      { ex: 'inverted_row', section: 'main', sets: L(3, 4, 5, 5), seconds: 40, rest: 20 },
      { ex: 'mountain_climber', section: 'main', sets: L(3, 4, 5, 5), seconds: 40, rest: 20 },
      { ex: 'reverse_lunge', section: 'main', sets: L(3, 4, 5, 5), seconds: 40, rest: 20 },
      { ex: L('plank', 'ab_rollout', 'ab_rollout', 'ab_rollout'), section: 'finisher', sets: 3, reps: [8, 10], seconds: L(30, 30, 30, 30), rest: 45 },
      { ex: 'hollow_hold', section: 'finisher', sets: 3, seconds: L(15, 20, 30, 40), rest: 30 },
      cool('childs_pose'),
    ],
  },
  mobility: {
    key: 'mobility',
    name: 'Mobility + Long Walk',
    short: 'Mobility',
    kind: 'mobility',
    estMin: 40,
    note: 'A recovery day: hold each stretch gently, breathe slowly, then finish with a brisk walk.',
    blocks: [
      { ex: 'hip_flexor_stretch', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'pigeon', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'hamstring_stretch', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'thoracic_rotation', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'deep_squat_hold', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'childs_pose', section: 'main', sets: 1, seconds: 60, rest: 0 },
      { ex: 'doorway_chest', section: 'main', sets: 2, seconds: L(45, 45, 60, 60), rest: 10 },
      { ex: 'brisk_walk', section: 'finisher', sets: 1, seconds: 2700, rest: 0 },
    ],
  },
  rest: {
    key: 'rest',
    name: 'Rest & Recover',
    short: 'Rest',
    kind: 'rest',
    estMin: 0,
    blocks: [],
  },
}

export const DAY_KEYS = Object.keys(TEMPLATES) as DayKey[]
