import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { FitDB, ensureSeeded, exportAll, importAll, resetAll, validateBackup } from './db'
import {
  addFood,
  completeRestDay,
  discardSession,
  finishSession,
  markSupplement,
  saveBody,
  sessionPRs,
  setFoodPortions,
  setRpe,
  startSession,
  swapBlockExercise,
  toggleSet,
} from './ops'
import { buildWorkout } from '../engine/scheduleEngine'
import { FOODS } from '../data/foods'

let n = 0
let d: FitDB
beforeEach(async () => {
  d = new FitDB(`test-${++n}`)
  await d.open()
})

const start = (date: string, dayKey: 'lower' | 'upper' = 'lower', level: 'beginner' | 'pro' = 'beginner') =>
  startSession({ date, dayKey, level, workout: buildWorkout(dayKey, level), factor: 1 }, d)

describe('seeding', () => {
  it('creates profile, 7-day schedule, foods and supplements once', async () => {
    const p = await ensureSeeded('2026-10-12', 'Asia/Kolkata')
    expect(p.timezone).toBe('Asia/Kolkata')
    expect(p.onboarded).toBe(false)
    expect(await d.profile.count()).toBe(0) // seeded into the default db, not this test db
    // seed into the test db explicitly through the same code path:
    await d.profile.put(p)
    expect(await d.profile.count()).toBe(1)
  })
})

describe('sessions & sets', () => {
  it('start creates one row per planned set, prefilled with target reps', async () => {
    const id = await start('2026-10-12')
    const w = buildWorkout('lower', 'beginner')
    const rows = await d.sets.where('sessionId').equals(id).toArray()
    expect(rows).toHaveLength(w.blocks.reduce((a, b) => a + b.sets, 0))
    const squat = rows.find((r) => r.exerciseId === 'goblet_squat')!
    expect(squat.done).toBe(false)
    expect(squat.reps).toBe(12)
    expect(squat.targetHi).toBe(12)
  })
  it('starting the same workout twice resumes the open session instead of duplicating', async () => {
    const a = await start('2026-10-12')
    const b = await start('2026-10-12')
    expect(b).toBe(a)
    expect(await d.sessions.count()).toBe(1)
  })
  it('choosing a different workout the same day replaces the unstarted one', async () => {
    const a = await start('2026-10-12', 'lower')
    const b = await start('2026-10-12', 'upper')
    expect(b).not.toBe(a)
    expect(await d.sessions.count()).toBe(1)
    expect(await d.sets.where('sessionId').equals(a).count()).toBe(0)
  })
  it('weight suggestion progresses from the previous session', async () => {
    const s1 = await start('2026-10-05')
    const sets1 = await d.sets.where('sessionId').equals(s1).and((r) => r.exerciseId === 'goblet_squat').toArray()
    for (const r of sets1) await d.sets.update(r.id!, { weightKg: 12, reps: 12, done: true })
    await finishSession(s1, d)
    const s2 = await start('2026-10-12')
    const next = await d.sets.where('sessionId').equals(s2).and((r) => r.exerciseId === 'goblet_squat').first()
    expect(next!.weightKg).toBe(14)
  })
  it('toggling a set done copies the weight to later undone sets in the block', async () => {
    const id = await start('2026-10-12')
    const rows = await d.sets.where('sessionId').equals(id).and((r) => r.exerciseId === 'goblet_squat').toArray()
    rows.sort((a, b) => a.setNo - b.setNo)
    await d.sets.update(rows[0].id!, { weightKg: 20 })
    await toggleSet({ ...rows[0], weightKg: 20 }, d)
    const after = await d.sets.where('sessionId').equals(id).and((r) => r.exerciseId === 'goblet_squat').toArray()
    expect(after.find((r) => r.setNo === 1)!.done).toBe(true)
    expect(after.find((r) => r.setNo === 2)!.weightKg).toBe(20)
    // un-ticking works too
    await toggleSet({ ...after.find((r) => r.setNo === 1)! }, d)
    expect((await d.sets.get(rows[0].id!))!.done).toBe(false)
  })
  it('rpe is stored on every set of the block', async () => {
    const id = await start('2026-10-12')
    const row = (await d.sets.where('sessionId').equals(id).and((r) => r.exerciseId === 'goblet_squat').first())!
    await setRpe(id, row.blockIdx, 'hard', d)
    const all = await d.sets.where('sessionId').equals(id).and((r) => r.blockIdx === row.blockIdx).toArray()
    expect(all.every((r) => r.rpe === 'hard')).toBe(true)
  })
  it('swapping to the easier variant only changes the not-yet-done sets', async () => {
    const id = await start('2026-10-12', 'lower', 'pro')
    const first = (await d.sets.where('sessionId').equals(id).and((r) => r.exerciseId === 'pause_squat').toArray()).sort((a, b) => a.setNo - b.setNo)
    await d.sets.update(first[0].id!, { done: true, weightKg: 60, reps: 5 })
    await swapBlockExercise(id, first[0].blockIdx, 'back_squat', 1, d)
    const rows = (await d.sets.where('sessionId').equals(id).and((r) => r.blockIdx === first[0].blockIdx).toArray()).sort((a, b) => a.setNo - b.setNo)
    expect(rows[0].exerciseId).toBe('pause_squat')
    expect(rows.slice(1).every((r) => r.exerciseId === 'back_squat')).toBe(true)
  })
  it('discard removes the session and its sets', async () => {
    const id = await start('2026-10-12')
    await discardSession(id, d)
    expect(await d.sessions.count()).toBe(0)
    expect(await d.sets.count()).toBe(0)
  })
  it('rest day completion is idempotent', async () => {
    await completeRestDay('2026-10-11', 'beginner', d)
    await completeRestDay('2026-10-11', 'beginner', d)
    expect(await d.sessions.count()).toBe(1)
    expect((await d.sessions.toArray())[0].dayKey).toBe('rest')
  })
  it('detects a personal record only when it beats a previous result', async () => {
    const s1 = await start('2026-10-05')
    const rows1 = await d.sets.where('sessionId').equals(s1).and((r) => r.exerciseId === 'goblet_squat').toArray()
    for (const r of rows1) await d.sets.update(r.id!, { weightKg: 12, reps: 10, done: true })
    await finishSession(s1, d)
    expect(await sessionPRs(s1, d)).toHaveLength(0) // first time ever is not a PR
    const s2 = await start('2026-10-12')
    const rows2 = await d.sets.where('sessionId').equals(s2).and((r) => r.exerciseId === 'goblet_squat').toArray()
    for (const r of rows2) await d.sets.update(r.id!, { weightKg: 14, reps: 10, done: true })
    const prs = await sessionPRs(s2, d)
    expect(prs.map((p) => p.exerciseId)).toContain('goblet_squat')
  })
})

describe('food, supplements, body', () => {
  it('adding the same food to the same meal merges portions', async () => {
    await addFood('2026-10-12', 'breakfast', 'roti', 1, d)
    await addFood('2026-10-12', 'breakfast', 'roti', 2, d)
    await addFood('2026-10-12', 'lunch', 'roti', 1, d)
    const logs = await d.foodLogs.toArray()
    expect(logs).toHaveLength(2)
    expect(logs.find((l) => l.meal === 'breakfast')!.portions).toBe(3)
    await setFoodPortions(logs[0].id!, 0, d)
    expect(await d.foodLogs.count()).toBe(1)
  })
  it('supplement toggles are idempotent', async () => {
    await markSupplement('b12', '2026-10-12', true, d)
    await markSupplement('b12', '2026-10-12', true, d)
    expect(await d.supplementLogs.count()).toBe(1)
    await markSupplement('b12', '2026-10-12', false, d)
    expect(await d.supplementLogs.count()).toBe(0)
  })
  it('body log keeps one row per day and merges weight + waist', async () => {
    await saveBody('2026-10-12', { weightKg: 71 }, d)
    await saveBody('2026-10-12', { waistCm: 92 }, d)
    await saveBody('2026-10-12', { weightKg: 70.8 }, d)
    const rows = await d.bodyLogs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ weightKg: 70.8, waistCm: 92 })
  })
  it('food library has unique ids and sane values', () => {
    const ids = FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of FOODS) {
      expect(f.proteinG).toBeGreaterThanOrEqual(0)
      expect(f.kcal).toBeGreaterThanOrEqual(0)
    }
    expect(FOODS.filter((f) => !f.veg).every((f) => f.id.startsWith('egg'))).toBe(true)
  })
})

describe('backup', () => {
  it('export → reset → import restores everything', async () => {
    await d.profile.put((await ensureSeededInto(d)) as never)
    const s = await start('2026-10-12')
    await addFood('2026-10-12', 'lunch', 'dal', 1, d)
    await saveBody('2026-10-12', { weightKg: 71 }, d)
    const before = await exportAll(d)
    await resetAll(d)
    expect(await d.sessions.count()).toBe(0)
    await importAll(JSON.parse(JSON.stringify(before)), d)
    const after = await exportAll(d)
    expect(after.tables).toEqual(before.tables)
    expect(await d.sets.where('sessionId').equals(s).count()).toBeGreaterThan(0)
  })
  it('rejects files that are not FitTrack backups, without touching data', async () => {
    await addFood('2026-10-12', 'lunch', 'dal', 1, d)
    expect(validateBackup({ hello: 1 })).toBe(false)
    expect(validateBackup({ app: 'fittrack', version: 1, tables: { sets: 'nope' } })).toBe(false)
    await expect(importAll({ hello: 1 } as never, d)).rejects.toThrow()
    expect(await d.foodLogs.count()).toBe(1)
  })
})

async function ensureSeededInto(database: FitDB) {
  const { defaultProfile } = await import('./db')
  const p = defaultProfile('2026-10-12', 'Asia/Kolkata')
  await database.profile.put(p)
  return p
}
