import Dexie, { type Table } from 'dexie'
import type {
  BodyLog,
  DayOverride,
  Food,
  FoodLog,
  LevelEvent,
  NotifiedRow,
  NotifPrefs,
  Profile,
  ScheduleRow,
  Session,
  SetLog,
  Supplement,
  SupplementLog,
  VideoOverride,
} from '../types'
import { DEFAULT_SCHEDULE } from '../engine/scheduleEngine'
import { FOODS, SEED_SUPPLEMENTS, SEED_VERSION } from '../data/foods'

export class FitDB extends Dexie {
  profile!: Table<Profile, number>
  schedule!: Table<ScheduleRow, number>
  dayOverrides!: Table<DayOverride, string>
  sessions!: Table<Session, number>
  sets!: Table<SetLog, number>
  foods!: Table<Food, string>
  foodLogs!: Table<FoodLog, number>
  supplements!: Table<Supplement, string>
  supplementLogs!: Table<SupplementLog, number>
  bodyLogs!: Table<BodyLog, number>
  levelEvents!: Table<LevelEvent, number>
  notified!: Table<NotifiedRow, string>
  videos!: Table<VideoOverride, string>

  constructor(name = 'fittrack') {
    super(name)
    this.version(1).stores({
      profile: 'id',
      schedule: 'weekday',
      dayOverrides: 'date',
      sessions: '++id, date, status',
      sets: '++id, sessionId, exerciseId, date',
      foods: 'id, name',
      foodLogs: '++id, date, [date+meal]',
      supplements: 'id',
      supplementLogs: '++id, date, supplementId',
      bodyLogs: '++id, date',
      levelEvents: '++id, date',
      notified: 'key',
      videos: 'exerciseId',
    })
  }
}

export const db = new FitDB()

export const TABLE_NAMES = [
  'profile',
  'schedule',
  'dayOverrides',
  'sessions',
  'sets',
  'foods',
  'foodLogs',
  'supplements',
  'supplementLogs',
  'bodyLogs',
  'levelEvents',
  'notified',
  'videos',
] as const

export const DEFAULT_NOTIF: NotifPrefs = {
  enabled: false,
  gym: true,
  gymTime: '18:00',
  supplements: true,
  protein: true,
  proteinTime: '21:30',
  meals: true,
  mealsTime: '15:00',
  weighIn: true,
  weighInTime: '10:00',
  weighInEveryDays: 7,
  waist: true,
  waistEveryDays: 14,
}

export function defaultProfile(today: string, timezone: string): Profile {
  return {
    id: 1,
    name: '',
    heightCm: 165,
    weightKg: 71,
    goalKg: 63,
    timezone,
    dayBoundaryHour: 4,
    level: 'beginner',
    levelSince: today,
    programStart: today,
    proteinTargetG: 95,
    kcalTarget: 1900,
    vegetarian: true,
    theme: 'dark',
    onboarded: false,
    seedVersion: 0,
    notif: { ...DEFAULT_NOTIF },
  }
}

/** Creates the profile, schedule, food library and supplements on first run; tops up the food library after updates. */
export async function ensureSeeded(today: string, timezone: string): Promise<Profile> {
  return db.transaction('rw', [db.profile, db.schedule, db.foods, db.supplements], async () => {
    let profile = await db.profile.get(1)
    if (!profile) {
      profile = defaultProfile(today, timezone)
      await db.profile.put(profile)
    }
    if ((await db.schedule.count()) === 0) {
      await db.schedule.bulkPut(Object.entries(DEFAULT_SCHEDULE).map(([w, dayKey]) => ({ weekday: Number(w), dayKey })))
    }
    if (profile.seedVersion < SEED_VERSION) {
      await db.foods.bulkPut(FOODS)
      if ((await db.supplements.count()) === 0) await db.supplements.bulkPut(SEED_SUPPLEMENTS(today))
      profile = { ...profile, seedVersion: SEED_VERSION }
      await db.profile.put(profile)
    }
    return profile
  })
}

export async function patchProfile(patch: Partial<Profile>): Promise<void> {
  await db.profile.update(1, patch)
}

export async function patchNotif(patch: Partial<NotifPrefs>): Promise<void> {
  const p = await db.profile.get(1)
  if (!p) return
  await db.profile.update(1, { notif: { ...p.notif, ...patch } })
}

// ───────── Backup / restore ─────────

export interface BackupFile {
  app: 'fittrack'
  version: 1
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function exportAll(database: FitDB = db): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) tables[name] = await database.table(name).toArray()
  return { app: 'fittrack', version: 1, exportedAt: new Date().toISOString(), tables }
}

export function validateBackup(x: unknown): x is BackupFile {
  if (!x || typeof x !== 'object') return false
  const b = x as BackupFile
  if (b.app !== 'fittrack' || b.version !== 1 || !b.tables || typeof b.tables !== 'object') return false
  return TABLE_NAMES.every((n) => b.tables[n] === undefined || Array.isArray(b.tables[n]))
}

export async function importAll(file: BackupFile, database: FitDB = db): Promise<void> {
  if (!validateBackup(file)) throw new Error('This is not a FitTrack backup file.')
  await database.transaction('rw', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      const t = database.table(name)
      await t.clear()
      const rows = file.tables[name]
      if (rows?.length) await t.bulkPut(rows)
    }
  })
}

export async function resetAll(database: FitDB = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const t of database.tables) await t.clear()
  })
}
