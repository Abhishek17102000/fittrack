import type { Exercise, SetLog } from '../types'

export const roundHalf = (x: number) => Math.round(x * 2) / 2

/** Comparable "how good was this set" number (heavier / more reps / longer = higher). */
export function setScore(ex: Exercise, s: Pick<SetLog, 'weightKg' | 'reps' | 'seconds'>): number {
  if (ex.loaded && s.weightKg && s.weightKg > 0) return s.weightKg * (1 + (s.reps ?? 1) / 30)
  if (ex.measure === 'time') return s.seconds ?? 0
  return s.reps ?? 0
}

/**
 * Double progression: if the last session hit the top of the rep range on every set (and never felt "hard")
 * suggest adding weight; otherwise repeat the weight. `factor` < 1 scales for deload / comeback weeks.
 */
export function suggestWeight(ex: Exercise, history: SetLog[], factor = 1): number | undefined {
  if (!ex.loaded) return undefined
  const bySession = new Map<number, SetLog[]>()
  for (const s of history) {
    if (s.exerciseId !== ex.id) continue
    const arr = bySession.get(s.sessionId) ?? []
    arr.push(s)
    bySession.set(s.sessionId, arr)
  }
  let latest: SetLog[] | undefined
  let latestKey = ''
  for (const [sid, rows] of bySession) {
    if (!rows.some((r) => r.done && (r.weightKg ?? 0) > 0)) continue
    const key = `${rows[0].date}#${String(sid).padStart(9, '0')}`
    if (key > latestKey) {
      latestKey = key
      latest = rows
    }
  }
  if (!latest) return undefined
  const done = latest.filter((r) => r.done && (r.weightKg ?? 0) > 0)
  const last = Math.max(...done.map((r) => r.weightKg as number))
  const allDone = latest.every((r) => r.done)
  const hitTop = done.every((r) =>
    ex.measure === 'time'
      ? (r.seconds ?? 0) >= (r.targetSeconds ?? Infinity)
      : (r.reps ?? 0) >= (r.targetHi ?? Infinity),
  )
  const noHard = !latest.some((r) => r.rpe === 'hard')
  const bump = allDone && hitTop && noHard && factor >= 1 ? (ex.increment ?? 2.5) : 0
  return roundHalf((last + bump) * factor)
}
