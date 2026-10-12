import { describe, expect, it } from 'vitest'
import { addDays, diffDays, getAppDay, minutesIntoAppDay, shiftToAppDay, weekdayOf } from './dateEngine'
import { buildWorkout, DEFAULT_SCHEDULE, resolveDayKey, targetLabel } from './scheduleEngine'
import { adherenceCells, adherencePct, suppStatus } from './supplementEngine'
import { computeStreak, evaluateLevel, isComeback, isDeloadWeek, loadMode } from './levelEngine'
import { suggestWeight } from './progression'
import { buildReminders, dueReminders, type ReminderCtx } from './reminderEngine'
import { DAY_KEYS, TEMPLATES } from '../data/templates'
import { EXERCISE_MAP, parseYoutubeId } from '../data/exercises'
import { DEFAULT_NOTIF } from '../db/db'
import type { Session, SetLog, Supplement, SupplementLog } from '../types'

describe('dateEngine', () => {
  it('1:30 AM Monday IST still counts as Sunday (4 AM boundary)', () => {
    const now = new Date('2026-10-12T01:30:00+05:30')
    const d = getAppDay(now, 'Asia/Kolkata', 4)
    expect(d.date).toBe('2026-10-11')
    expect(d.weekday).toBe(0)
  })
  it('after the boundary it is Monday', () => {
    const d = getAppDay(new Date('2026-10-12T04:00:00+05:30'), 'Asia/Kolkata', 4)
    expect(d).toEqual({ date: '2026-10-12', weekday: 1 })
  })
  it('same instant is a different day in a different timezone', () => {
    const now = new Date('2026-10-12T23:00:00Z') // 23:00 Mon UTC = 04:30 Tue IST
    expect(getAppDay(now, 'UTC', 4).date).toBe('2026-10-12')
    expect(getAppDay(now, 'Asia/Kolkata', 4).date).toBe('2026-10-13')
  })
  it('timezone change mid-week gives the right local weekday', () => {
    const now = new Date('2026-10-14T23:00:00Z') // Wed 23:00 UTC = Thu 04:30 IST
    expect(getAppDay(now, 'UTC', 4).weekday).toBe(3)
    expect(getAppDay(now, 'Asia/Kolkata', 4).weekday).toBe(4)
    expect(getAppDay(now, 'America/New_York', 4).weekday).toBe(3)
  })
  it('handles DST zones', () => {
    // London springs forward on 2026-03-29; noon is unambiguous
    expect(getAppDay(new Date('2026-03-29T12:00:00Z'), 'Europe/London', 4).date).toBe('2026-03-29')
    expect(getAppDay(new Date('2026-10-25T00:30:00Z'), 'Europe/London', 4).date).toBe('2026-10-24')
  })
  it('falls back to UTC for an invalid timezone', () => {
    expect(getAppDay(new Date('2026-10-12T12:00:00Z'), 'Not/AZone', 4).date).toBe('2026-10-12')
  })
  it('date arithmetic', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(diffDays('2026-10-01', '2026-10-12')).toBe(11)
    expect(weekdayOf('2026-10-12')).toBe(1)
  })
  it('app-day minutes', () => {
    const now = new Date('2026-10-12T01:30:00+05:30')
    expect(minutesIntoAppDay(now, 'Asia/Kolkata', 4)).toBe(21 * 60 + 30)
    expect(shiftToAppDay('04:00', 4)).toBe(0)
    expect(shiftToAppDay('01:00', 4)).toBe(21 * 60)
  })
})

describe('templates & schedule', () => {
  it('default week: Mon lower … Fri circuit, Sat mobility, Sun rest', () => {
    expect(DEFAULT_SCHEDULE[1]).toBe('lower')
    expect(resolveDayKey(0, undefined)).toBe('rest')
    expect(resolveDayKey(6, undefined)).toBe('mobility')
    expect(resolveDayKey(2, { 2: 'fullbody' } as never)).toBe('fullbody')
    expect(resolveDayKey(2, undefined, 'lower')).toBe('lower')
  })
  it('every template at every level references real exercises and measures them consistently', () => {
    for (const key of DAY_KEYS) {
      for (const level of ['beginner', 'intermediate', 'advanced', 'pro'] as const) {
        const w = buildWorkout(key, level)
        for (const b of w.blocks) {
          const ex = EXERCISE_MAP[b.exerciseId]
          expect(ex, `${key}/${level}: unknown exercise ${b.exerciseId}`).toBeDefined()
          expect(b.sets).toBeGreaterThan(0)
          if (ex.measure === 'time') expect(b.seconds, `${ex.id} needs seconds`).toBeGreaterThan(0)
          else expect(b.reps, `${ex.id} needs reps`).toBeDefined()
        }
      }
    }
  })
  it('starts with the warm-up and ends with the cool-down on gym days', () => {
    const w = buildWorkout('lower', 'beginner')
    expect(w.blocks[0].section).toBe('warmup')
    expect(w.blocks.at(-1)?.section).toBe('cooldown')
    expect(w.blocks.filter((b) => b.section === 'main').length).toBeGreaterThan(3)
  })
  it('higher levels get more volume or harder variants', () => {
    const b = buildWorkout('lower', 'beginner').blocks.find((x) => x.section === 'main')!
    const p = buildWorkout('lower', 'pro').blocks.find((x) => x.section === 'main')!
    expect(b.exerciseId).toBe('goblet_squat')
    expect(p.exerciseId).toBe('pause_squat')
    expect(p.sets).toBeGreaterThan(b.sets)
  })
  it('rest day has no blocks', () => expect(buildWorkout('rest', 'pro').blocks).toHaveLength(0))
  it('target labels', () => {
    expect(targetLabel({ sets: 4, reps: [8, 10] })).toBe('4 × 8-10')
    expect(targetLabel({ sets: 3, reps: [10, 10] })).toBe('3 × 10')
    expect(targetLabel({ sets: 1, seconds: 600 })).toBe('1 × 10 min')
    expect(targetLabel({ sets: 3, seconds: 30 })).toBe('3 × 30s')
  })
  it('variant links (easier / harder) point at real exercises', () => {
    for (const e of Object.values(EXERCISE_MAP)) {
      if (e.easierId) expect(EXERCISE_MAP[e.easierId], `${e.id}.easierId`).toBeDefined()
      if (e.harderId) expect(EXERCISE_MAP[e.harderId], `${e.id}.harderId`).toBeDefined()
      expect(e.steps.length).toBeGreaterThan(0)
    }
  })
  it('every template kind is declared', () => {
    expect(TEMPLATES.mobility.kind).toBe('mobility')
  })
})

describe('youtube parsing', () => {
  it('accepts urls and ids', () => {
    expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('nonsense')).toBeNull()
    expect(parseYoutubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })
})

const supp = (over: Partial<Supplement>): Supplement => ({
  id: 's', name: 'S', dose: 1, unit: 'g', schedule: { kind: 'daily' }, reminderTime: '10:00', active: true, ...over,
})
const log = (date: string, supplementId = 's'): SupplementLog => ({ date, supplementId, takenAt: 0 })

describe('supplementEngine', () => {
  it('daily: due until taken', () => {
    expect(suppStatus(supp({}), '2026-10-12', []).state).toBe('due')
    expect(suppStatus(supp({}), '2026-10-12', [log('2026-10-12')]).state).toBe('taken')
    expect(suppStatus(supp({}), '2026-10-12', [log('2026-10-11')]).state).toBe('due')
  })
  it('B12 Mon/Wed/Fri: due on Mon, not on Tue, overdue on Tue if Monday missed', () => {
    const b12 = supp({ schedule: { kind: 'weekdays', days: [1, 3, 5] } })
    expect(suppStatus(b12, '2026-10-12', []).state).toBe('due') // Monday
    expect(suppStatus(b12, '2026-10-13', [log('2026-10-12')]).state).toBe('none') // Tue, Monday taken
    expect(suppStatus(b12, '2026-10-13', []).state).toBe('overdue') // Tue, Monday missed
    expect(suppStatus(b12, '2026-10-13', [log('2026-10-13')]).state).toBe('taken') // took the late dose
    expect(suppStatus(b12, '2026-10-14', [log('2026-10-13')]).state).toBe('due') // Wed due again
  })
  it('weekly vitamin D counts from the last dose taken', () => {
    const d = supp({ schedule: { kind: 'everyNDays', n: 7, anchor: '2026-10-12' } })
    expect(suppStatus(d, '2026-10-11', []).state).toBe('none')
    expect(suppStatus(d, '2026-10-12', []).state).toBe('due')
    expect(suppStatus(d, '2026-10-14', []).state).toBe('overdue')
    expect(suppStatus(d, '2026-10-12', [log('2026-10-12')]).state).toBe('taken')
    expect(suppStatus(d, '2026-10-18', [log('2026-10-14')]).state).toBe('none') // late dose pushes the next to 10-21
    expect(suppStatus(d, '2026-10-21', [log('2026-10-14')]).state).toBe('due')
  })
  it('doses scheduled before tracking began are never reported as missed/overdue', () => {
    const b12 = supp({ schedule: { kind: 'weekdays', days: [1, 3, 5] }, since: '2026-10-13' }) // installed on Tuesday
    expect(suppStatus(b12, '2026-10-13', []).state).toBe('none') // Monday's dose predates the app
    expect(suppStatus(b12, '2026-10-14', []).state).toBe('due') // Wednesday is the first real dose
    const cells = adherenceCells(b12, [], '2026-10-14', 4)
    expect(cells.map((c) => c.state)).toEqual(['none', 'none', 'none', 'none'])
  })
  it('inactive supplements never show', () => {
    expect(suppStatus(supp({ active: false }), '2026-10-12', []).state).toBe('none')
  })
  it('adherence calendar & percentage', () => {
    const logs = [log('2026-10-10'), log('2026-10-11')]
    const cells = adherenceCells(supp({}), logs, '2026-10-12', 4)
    expect(cells.map((c) => c.state)).toEqual(['missed', 'taken', 'taken', 'none']) // today not yet missed
    expect(adherencePct(supp({}), logs, '2026-10-12', 4)).toBe(67)
    expect(adherencePct(supp({}), [], '2026-10-12', 1)).toBeUndefined()
  })
})

const sess = (id: number, date: string, dayKey: Session['dayKey'] = 'lower', status: Session['status'] = 'done'): Session => ({
  id, date, dayKey, level: 'beginner', startedAt: 0, status,
})
const set = (o: Partial<SetLog>): SetLog => ({
  sessionId: 1, blockIdx: 0, exerciseId: 'goblet_squat', section: 'main', setNo: 1, restSec: 60, done: true, date: '2026-10-01', ...o,
})

describe('progression', () => {
  const goblet = EXERCISE_MAP.goblet_squat
  it('no history → no suggestion', () => expect(suggestWeight(goblet, [])).toBeUndefined())
  it('hit the top reps on every set → add weight', () => {
    const h = [1, 2, 3].map((n) => set({ setNo: n, weightKg: 12, reps: 12, targetHi: 12 }))
    expect(suggestWeight(goblet, h)).toBe(14)
  })
  it('missed reps → repeat weight', () => {
    const h = [set({ weightKg: 12, reps: 12, targetHi: 12 }), set({ setNo: 2, weightKg: 12, reps: 9, targetHi: 12 })]
    expect(suggestWeight(goblet, h)).toBe(12)
  })
  it('felt hard → repeat weight', () => {
    const h = [set({ weightKg: 12, reps: 12, targetHi: 12, rpe: 'hard' })]
    expect(suggestWeight(goblet, h)).toBe(12)
  })
  it('skipped sets → no bump', () => {
    const h = [set({ weightKg: 12, reps: 12, targetHi: 12 }), set({ setNo: 2, weightKg: 12, done: false, targetHi: 12 })]
    expect(suggestWeight(goblet, h)).toBe(12)
  })
  it('uses the most recent session', () => {
    const h = [
      set({ sessionId: 1, date: '2026-10-01', weightKg: 10, reps: 10, targetHi: 12 }),
      set({ sessionId: 2, date: '2026-10-08', weightKg: 14, reps: 8, targetHi: 12 }),
    ]
    expect(suggestWeight(goblet, h)).toBe(14)
  })
  it('deload and comeback scale the load down and never bump', () => {
    const h = [set({ weightKg: 20, reps: 12, targetHi: 12 })]
    expect(suggestWeight(goblet, h, 0.6)).toBe(12)
    expect(suggestWeight(goblet, h, 0.8)).toBe(16)
  })
  it('bodyweight exercises get no weight suggestion', () => {
    expect(suggestWeight(EXERCISE_MAP.pushup, [set({ exerciseId: 'pushup', weightKg: 5 })])).toBeUndefined()
  })
})

describe('levelEngine', () => {
  it('deload week is every 7th week, comeback after 14 idle days', () => {
    expect(isDeloadWeek('2026-10-12', '2026-10-12')).toBe(false)
    expect(isDeloadWeek(addDays('2026-10-12', 6 * 7), '2026-10-12')).toBe(true)
    expect(isDeloadWeek(addDays('2026-10-12', 7 * 7), '2026-10-12')).toBe(false)
    expect(isComeback('2026-10-30', '2026-10-15')).toBe(true)
    expect(isComeback('2026-10-28', '2026-10-15')).toBe(false)
    expect(isComeback('2026-10-30', undefined)).toBe(false)
    expect(loadMode('2026-11-30', '2026-10-12', '2026-10-01').mode).toBe('comeback')
    expect(loadMode('2026-10-13', '2026-10-12', '2026-10-12')).toEqual({ mode: 'normal', factor: 1 })
  })

  it('streak: rest days neutral, missed gym day breaks, today does not break', () => {
    const sched = DEFAULT_SCHEDULE
    // Mon 12 Oct 2026. Done Mon..Fri previous week (5-9 Oct), Sat 10 mobility done, Sun rest, today Mon not yet done
    const done = new Set(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(computeStreak('2026-10-12', done, sched, {}, '2026-10-05')).toEqual({ current: 6, best: 6 })
    done.add('2026-10-12')
    expect(computeStreak('2026-10-12', done, sched, {}, '2026-10-05').current).toBe(7)
    // miss Thursday → streak since Friday
    const gap = new Set(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09', '2026-10-10'])
    const s = computeStreak('2026-10-12', gap, sched, {}, '2026-10-05')
    expect(s.current).toBe(2)
    expect(s.best).toBe(3)
    expect(computeStreak('2026-10-12', new Set(), sched, {}, '2026-10-12')).toEqual({ current: 0, best: 0 })
  })

  const baseInput = {
    level: 'beginner' as const,
    levelSince: '2026-10-05', // Monday
    today: '2026-11-02', // 28 days later
    schedule: DEFAULT_SCHEDULE,
    weightKg: 71,
  }
  const gymDates: string[] = []
  for (let w = 0; w < 4; w++) for (let d = 0; d < 5; d++) gymDates.push(addDays('2026-10-05', w * 7 + d))

  it('4 consistent weeks with progress → eligible for Intermediate', () => {
    const sessions = gymDates.map((d, i) => sess(i + 1, d))
    const sets: SetLog[] = []
    // goblet squat, bench, rdl, lat pulldown progress week over week
    for (const ex of ['goblet_squat', 'db_bench_press', 'rdl', 'assisted_pullup']) {
      sets.push(set({ exerciseId: ex, date: '2026-10-05', weightKg: 10, reps: 10, sessionId: 1 }))
      sets.push(set({ exerciseId: ex, date: '2026-10-26', weightKg: 14, reps: 10, sessionId: 16 }))
    }
    const st = evaluateLevel({ ...baseInput, sessions, sets })
    expect(st.windowElapsed).toBe(true)
    expect(st.consistency).toBeCloseTo(1)
    expect(st.progressed.length).toBe(4)
    expect(st.eligible).toBe(true)
  })
  it('too early → not eligible, shows days left', () => {
    const st = evaluateLevel({ ...baseInput, today: '2026-10-20', sessions: [], sets: [] })
    expect(st.eligible).toBe(false)
    expect(st.daysLeft).toBe(28 - 15)
  })
  it('poor attendance blocks promotion', () => {
    const sessions = gymDates.slice(0, 8).map((d, i) => sess(i + 1, d))
    const st = evaluateLevel({ ...baseInput, sessions, sets: [] })
    expect(st.consistency).toBeLessThan(0.8)
    expect(st.eligible).toBe(false)
  })
  it('snooze hides the offer', () => {
    const sessions = gymDates.map((d, i) => sess(i + 1, d))
    const sets: SetLog[] = []
    for (const ex of ['goblet_squat', 'db_bench_press', 'rdl']) {
      sets.push(set({ exerciseId: ex, date: '2026-10-05', weightKg: 10, reps: 10 }))
      sets.push(set({ exerciseId: ex, date: '2026-10-26', weightKg: 14, reps: 10 }))
    }
    expect(evaluateLevel({ ...baseInput, sessions, sets }).eligible).toBe(true)
    expect(evaluateLevel({ ...baseInput, sessions, sets, snoozeUntil: '2026-11-09' }).eligible).toBe(false)
  })
  it('intermediate needs plank 60s + 5 push-ups; advanced needs 1.25× deadlift; pro has no next level', () => {
    const inter = evaluateLevel({ ...baseInput, level: 'intermediate', sessions: [], sets: [] })
    expect(inter.checks.map((c) => c.label)).toEqual(expect.arrayContaining(['Hold a plank for 60 s', '5 push-ups with good form']))
    const adv = evaluateLevel({ ...baseInput, level: 'advanced', sessions: [], sets: [] })
    expect(adv.checks.some((c) => c.label.includes('89 kg'))).toBe(true) // 71 × 1.25 = 88.75 → 89 (rounded to 0.5 = 89)
    expect(evaluateLevel({ ...baseInput, level: 'pro', sessions: [], sets: [] }).eligible).toBe(false)
  })
})

describe('reminderEngine', () => {
  const ctx = (o: Partial<ReminderCtx> = {}): ReminderCtx => ({
    today: '2026-10-12',
    boundaryHour: 4,
    minutesNow: shiftToAppDay('12:00', 4),
    prefs: { ...DEFAULT_NOTIF, enabled: true },
    gym: { planned: true, name: 'Lower Body Strength', doneToday: false },
    supps: [],
    proteinG: 0,
    proteinTarget: 95,
    foodLogsToday: 0,
    lastWeightDate: '2026-10-10',
    lastWaistDate: '2026-10-10',
    ...o,
  })

  it('nothing is due before its time', () => {
    expect(dueReminders(ctx({ minutesNow: shiftToAppDay('09:00', 4) }))).toHaveLength(0)
  })
  it('gym reminder only when planned and not yet done', () => {
    expect(buildReminders(ctx()).some((r) => r.kind === 'gym')).toBe(true)
    expect(buildReminders(ctx({ gym: { planned: true, name: 'x', doneToday: true } })).some((r) => r.kind === 'gym')).toBe(false)
    expect(buildReminders(ctx({ gym: { planned: false, name: 'Rest', doneToday: false } })).some((r) => r.kind === 'gym')).toBe(false)
  })
  it('weight is requested when the last log is older than the interval, not before', () => {
    expect(buildReminders(ctx({ lastWeightDate: '2026-10-05' })).some((r) => r.kind === 'weight')).toBe(true)
    expect(buildReminders(ctx({ lastWeightDate: '2026-10-06' })).some((r) => r.kind === 'weight')).toBe(false)
    expect(buildReminders(ctx({ lastWeightDate: undefined })).some((r) => r.kind === 'weight')).toBe(true)
  })
  it('waist every 14 days', () => {
    expect(buildReminders(ctx({ lastWaistDate: '2026-09-28' })).some((r) => r.kind === 'waist')).toBe(true)
    expect(buildReminders(ctx({ lastWaistDate: '2026-10-01' })).some((r) => r.kind === 'waist')).toBe(false)
  })
  it('meals nudge only with no food logged; protein nudge only when logging but low', () => {
    expect(buildReminders(ctx()).some((r) => r.kind === 'meals')).toBe(true)
    expect(buildReminders(ctx()).some((r) => r.kind === 'protein')).toBe(false)
    const low = buildReminders(ctx({ foodLogsToday: 3, proteinG: 40 }))
    expect(low.some((r) => r.kind === 'meals')).toBe(false)
    expect(low.some((r) => r.kind === 'protein')).toBe(true)
    expect(buildReminders(ctx({ foodLogsToday: 3, proteinG: 60 })).some((r) => r.kind === 'protein')).toBe(false)
  })
  it('supplement reminders for due / overdue only, at their own time', () => {
    const supps = [
      { id: 'b12', name: 'B12', dose: 1500, unit: 'mcg' as const, reminderTime: '10:30', state: 'due' as const },
      { id: 'c', name: 'C', dose: 500, unit: 'mg' as const, reminderTime: '10:30', state: 'taken' as const },
      { id: 'd', name: 'D', dose: 60000, unit: 'IU' as const, reminderTime: '11:00', state: 'overdue' as const },
    ]
    const r = buildReminders(ctx({ supps })).filter((x) => x.kind === 'supp')
    expect(r.map((x) => x.id)).toEqual(['supp:b12:2026-10-12', 'supp:d:2026-10-12'])
    expect(r[1].title).toContain('overdue')
  })
  it('respects per-kind toggles', () => {
    const prefs = { ...DEFAULT_NOTIF, gym: false, supplements: false, meals: false, protein: false, weighIn: false, waist: false }
    expect(buildReminders(ctx({ prefs, lastWeightDate: undefined, supps: [{ id: 'x', name: 'x', dose: 1, unit: 'g', reminderTime: '10:00', state: 'due' }] }))).toHaveLength(0)
  })
  it('late-night reminder times map past midnight correctly (day boundary)', () => {
    // 01:00 reminder is the very end of the app-day, after 22:00
    const r = buildReminders(ctx({ prefs: { ...DEFAULT_NOTIF, gymTime: '01:00' } })).find((x) => x.kind === 'gym')!
    expect(r.atMin).toBeGreaterThan(shiftToAppDay('22:00', 4))
  })
})
