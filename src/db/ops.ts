import { db, type FitDB } from './db'
import type { BodyLog, DayKey, Food, MealKey, Level, Rpe, SetLog, Session, Supplement } from '../types'
import type { Workout } from '../engine/scheduleEngine'
import { getExercise, EXERCISE_MAP } from '../data/exercises'
import { setScore, suggestWeight } from '../engine/progression'

// ───────── Sessions ─────────

export async function startSession(
  args: { date: string; dayKey: DayKey; level: Level; workout: Workout; factor: number },
  database: FitDB = db,
): Promise<number> {
  const { date, dayKey, level, workout, factor } = args
  return database.transaction('rw', [database.sessions, database.sets], async () => {
    const open = await database.sessions.where('date').equals(date).and((s) => s.status === 'in_progress').first()
    if (open?.id) {
      if (open.dayKey === dayKey) return open.id
      // different workout chosen for the same day: discard the unstarted one
      await database.sets.where('sessionId').equals(open.id).delete()
      await database.sessions.delete(open.id)
    }
    const sid = (await database.sessions.add({ date, dayKey, level, startedAt: Date.now(), status: 'in_progress' })) as number
    const histCache = new Map<string, SetLog[]>()
    const rows: SetLog[] = []
    for (const b of workout.blocks) {
      const ex = getExercise(b.exerciseId)
      let hist = histCache.get(ex.id)
      if (!hist) {
        hist = ex.loaded ? await database.sets.where('exerciseId').equals(ex.id).toArray() : []
        histCache.set(ex.id, hist)
      }
      const weight = ex.loaded ? suggestWeight(ex, hist, factor) : undefined
      for (let n = 1; n <= b.sets; n++) {
        rows.push({
          sessionId: sid,
          blockIdx: b.blockIdx,
          exerciseId: b.exerciseId,
          section: b.section,
          setNo: n,
          targetLo: b.reps?.[0],
          targetHi: b.reps?.[1],
          targetSeconds: b.seconds,
          restSec: b.restSec,
          weightKg: weight,
          reps: b.reps?.[1],
          seconds: b.seconds,
          done: false,
          date,
        })
      }
    }
    await database.sets.bulkAdd(rows)
    return sid
  })
}

export async function updateSet(id: number, patch: Partial<SetLog>, database: FitDB = db): Promise<void> {
  await database.sets.update(id, patch)
}

/** Marks a set done (or undone). Copies weight onto later undone sets of the same block when it was changed. */
export async function toggleSet(set: SetLog, database: FitDB = db): Promise<void> {
  if (!set.id) return
  const done = !set.done
  await database.transaction('rw', database.sets, async () => {
    await database.sets.update(set.id!, { done })
    if (done && set.weightKg !== undefined) {
      const later = await database.sets
        .where('sessionId')
        .equals(set.sessionId)
        .and((s) => s.blockIdx === set.blockIdx && s.setNo > set.setNo && !s.done)
        .toArray()
      for (const s of later) if (s.weightKg !== set.weightKg) await database.sets.update(s.id!, { weightKg: set.weightKg })
    }
  })
}

export async function setRpe(sessionId: number, blockIdx: number, rpe: Rpe | undefined, database: FitDB = db): Promise<void> {
  const rows = await database.sets.where('sessionId').equals(sessionId).and((s) => s.blockIdx === blockIdx).toArray()
  await database.sets.bulkPut(rows.map((r) => ({ ...r, rpe })))
}

/** Swap the remaining (not yet done) sets of a block to a different exercise (easier/harder variant). */
export async function swapBlockExercise(
  sessionId: number,
  blockIdx: number,
  newId: string,
  factor: number,
  database: FitDB = db,
): Promise<void> {
  const ex = getExercise(newId)
  const hist = ex.loaded ? await database.sets.where('exerciseId').equals(newId).toArray() : []
  const weight = ex.loaded ? suggestWeight(ex, hist, factor) : undefined
  const rows = await database.sets.where('sessionId').equals(sessionId).and((s) => s.blockIdx === blockIdx && !s.done).toArray()
  await database.sets.bulkPut(
    rows.map((r) => ({
      ...r,
      exerciseId: newId,
      weightKg: ex.loaded ? weight : undefined,
      reps: ex.measure === 'reps' ? (r.targetHi ?? r.reps ?? 10) : undefined,
      seconds: ex.measure === 'time' ? (r.targetSeconds ?? r.seconds ?? 30) : undefined,
      targetLo: ex.measure === 'reps' ? (r.targetLo ?? 8) : undefined,
      targetHi: ex.measure === 'reps' ? (r.targetHi ?? 10) : undefined,
      targetSeconds: ex.measure === 'time' ? (r.targetSeconds ?? r.seconds ?? 30) : undefined,
    })),
  )
}

export async function finishSession(id: number, database: FitDB = db): Promise<void> {
  await database.sessions.update(id, { status: 'done', finishedAt: Date.now() })
}

export async function discardSession(id: number, database: FitDB = db): Promise<void> {
  await database.transaction('rw', [database.sessions, database.sets], async () => {
    await database.sets.where('sessionId').equals(id).delete()
    await database.sessions.delete(id)
  })
}

/** Rest days have no sets; completing one just records the day. */
export async function completeRestDay(date: string, level: Level, database: FitDB = db): Promise<void> {
  const exists = await database.sessions.where('date').equals(date).and((s) => s.status === 'done').first()
  if (exists) return
  await database.sessions.add({ date, dayKey: 'rest', level, startedAt: Date.now(), finishedAt: Date.now(), status: 'done' })
}

export interface PR {
  exerciseId: string
  name: string
  detail: string
}

/** Personal records set in this session (needs a previous result to beat; first-ever results are not PRs). */
export async function sessionPRs(sessionId: number, database: FitDB = db): Promise<PR[]> {
  const mine = (await database.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.done)
  const prs: PR[] = []
  const ids = [...new Set(mine.map((s) => s.exerciseId))]
  for (const id of ids) {
    const ex = EXERCISE_MAP[id]
    if (!ex) continue
    const rows = mine.filter((s) => s.exerciseId === id)
    if (rows.every((r) => r.section === 'warmup' || r.section === 'cooldown')) continue
    const best = rows.reduce((b, r) => (setScore(ex, r) > setScore(ex, b) ? r : b))
    const prev = (await database.sets.where('exerciseId').equals(id).toArray()).filter((s) => s.done && s.sessionId !== sessionId)
    if (!prev.length) continue
    const prevBest = Math.max(...prev.map((s) => setScore(ex, s)))
    if (setScore(ex, best) > prevBest + 1e-9) {
      const detail = ex.loaded && best.weightKg ? `${best.weightKg} kg × ${best.reps ?? '-'}` : ex.measure === 'time' ? `${best.seconds}s` : `${best.reps} reps`
      prs.push({ exerciseId: id, name: ex.name, detail })
    }
  }
  return prs
}

// ───────── Food ─────────

export async function addFood(date: string, meal: MealKey, foodId: string, portions = 1, database: FitDB = db): Promise<void> {
  await database.transaction('rw', database.foodLogs, async () => {
    const existing = await database.foodLogs.where('[date+meal]').equals([date, meal]).and((l) => l.foodId === foodId).first()
    if (existing?.id) await database.foodLogs.update(existing.id, { portions: existing.portions + portions })
    else await database.foodLogs.add({ date, meal, foodId, portions })
  })
}

export async function setFoodPortions(id: number, portions: number, database: FitDB = db): Promise<void> {
  if (portions <= 0) await database.foodLogs.delete(id)
  else await database.foodLogs.update(id, { portions })
}

export async function addCustomFood(f: Omit<Food, 'id' | 'custom'>, database: FitDB = db): Promise<string> {
  const id = `custom_${Date.now().toString(36)}`
  await database.foods.put({ ...f, id, custom: true })
  return id
}

// ───────── Supplements ─────────

export async function markSupplement(supplementId: string, date: string, taken: boolean, database: FitDB = db): Promise<void> {
  await database.transaction('rw', database.supplementLogs, async () => {
    const rows = await database.supplementLogs.where('date').equals(date).and((l) => l.supplementId === supplementId).toArray()
    if (taken && rows.length === 0) await database.supplementLogs.add({ date, supplementId, takenAt: Date.now() })
    if (!taken) await database.supplementLogs.bulkDelete(rows.map((r) => r.id!))
  })
}

export async function saveSupplement(s: Supplement, database: FitDB = db): Promise<void> {
  await database.supplements.put(s)
}

export async function deleteSupplement(id: string, database: FitDB = db): Promise<void> {
  await database.transaction('rw', [database.supplements, database.supplementLogs], async () => {
    await database.supplements.delete(id)
    await database.supplementLogs.where('supplementId').equals(id).delete()
  })
}

// ───────── Body ─────────

export async function saveBody(date: string, patch: Pick<BodyLog, 'weightKg' | 'waistCm'>, database: FitDB = db): Promise<void> {
  await database.transaction('rw', database.bodyLogs, async () => {
    const existing = await database.bodyLogs.where('date').equals(date).first()
    const clean: Partial<BodyLog> = {}
    if (patch.weightKg !== undefined) clean.weightKg = patch.weightKg
    if (patch.waistCm !== undefined) clean.waistCm = patch.waistCm
    if (existing?.id) await database.bodyLogs.update(existing.id, clean)
    else await database.bodyLogs.add({ date, ...clean })
  })
}

export async function setDayOverride(date: string, dayKey: DayKey | null, database: FitDB = db): Promise<void> {
  if (dayKey === null) await database.dayOverrides.delete(date)
  else await database.dayOverrides.put({ date, dayKey })
}

export type { Session }

// ───────── Levels ─────────

/** Moves to a new level and restarts the evaluation window / deload cycle. */
export async function changeLevel(from: Level, to: Level, today: string, reason: string, database: FitDB = db): Promise<void> {
  await database.transaction('rw', [database.profile, database.levelEvents], async () => {
    await database.profile.update(1, { level: to, levelSince: today, programStart: today, snoozeUntil: undefined })
    await database.levelEvents.add({ date: today, from, to, reason })
  })
}

export async function snoozeLevelOffer(until: string, database: FitDB = db): Promise<void> {
  await database.profile.update(1, { snoozeUntil: until })
}
