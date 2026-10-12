import type { Supplement, SupplementLog } from '../types'
import { addDays, diffDays, weekdayOf } from './dateEngine'

export type SuppState = 'due' | 'overdue' | 'taken' | 'none'

export interface SuppStatus {
  state: SuppState
  /** When the dose that is (or was) due falls. */
  dueDate?: string
}

/** Most recent scheduled date on or before `date` for daily / weekday schedules. */
function lastScheduled(s: Supplement, date: string): string | undefined {
  const sch = s.schedule
  if (sch.kind === 'daily') return date
  if (sch.kind === 'weekdays') {
    if (!sch.days.length) return undefined
    for (let i = 0; i < 7; i++) {
      const d = addDays(date, -i)
      if (sch.days.includes(weekdayOf(d))) return d
    }
  }
  return undefined
}

/**
 * Status of one supplement on `date`.
 * "Every N days" schedules count from the last dose actually taken, so a late dose pushes the next one back.
 */
export function suppStatus(s: Supplement, date: string, logs: SupplementLog[]): SuppStatus {
  if (!s.active) return { state: 'none' }
  const mine = logs.filter((l) => l.supplementId === s.id && l.date <= date)
  const lastTaken = mine.reduce<string | undefined>((m, l) => (!m || l.date > m ? l.date : m), undefined)
  const sch = s.schedule

  if (sch.kind === 'everyNDays') {
    const n = Math.max(1, sch.n)
    const due = lastTaken ? addDays(lastTaken, n) : sch.anchor
    if (lastTaken === date) return { state: 'taken', dueDate: date }
    if (due > date) return { state: 'none', dueDate: due }
    return { state: due === date ? 'due' : 'overdue', dueDate: due }
  }

  const sched = lastScheduled(s, date)
  if (!sched) return { state: 'none' }
  // doses scheduled before tracking began were never expected
  if (s.since && sched < s.since) return { state: 'none', dueDate: sched }
  if (lastTaken === date) return { state: 'taken', dueDate: sched }
  // taken after the scheduled date (a late dose): nothing outstanding until the next scheduled day
  if (lastTaken && lastTaken >= sched) return { state: 'none', dueDate: sched }
  return { state: sched === date ? 'due' : 'overdue', dueDate: sched }
}

export type CellState = 'taken' | 'missed' | 'none'

/** Per-day cells for the adherence calendar (oldest → newest). */
export function adherenceCells(s: Supplement, logs: SupplementLog[], today: string, days = 30): { date: string; state: CellState }[] {
  const taken = new Set(logs.filter((l) => l.supplementId === s.id).map((l) => l.date))
  const cells: { date: string; state: CellState }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    let scheduled = false
    if (s.schedule.kind === 'daily') scheduled = true
    else if (s.schedule.kind === 'weekdays') scheduled = s.schedule.days.includes(weekdayOf(date))
    let state: CellState = 'none'
    if (taken.has(date)) state = 'taken'
    else if (scheduled && date < today && (!s.since || date >= s.since)) state = 'missed'
    cells.push({ date, state })
  }
  return cells
}

export function adherencePct(s: Supplement, logs: SupplementLog[], today: string, days = 30): number | undefined {
  if (s.schedule.kind === 'everyNDays') {
    const n = Math.max(1, s.schedule.n)
    const start = addDays(today, -(days - 1))
    const expected = Math.floor(days / n)
    if (expected === 0) return undefined
    const count = logs.filter((l) => l.supplementId === s.id && l.date >= start && l.date <= today).length
    return Math.min(100, Math.round((count / expected) * 100))
  }
  const cells = adherenceCells(s, logs, today, days)
  const taken = cells.filter((c) => c.state === 'taken').length
  const missed = cells.filter((c) => c.state === 'missed').length
  if (taken + missed === 0) return undefined
  return Math.round((taken / (taken + missed)) * 100)
}

export const scheduleLabel = (s: Supplement): string => {
  const sch = s.schedule
  if (sch.kind === 'daily') return 'Every day'
  if (sch.kind === 'weekdays') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return sch.days.length ? [...sch.days].sort().map((d) => names[d]).join(' · ') : 'No days selected'
  }
  return sch.n === 7 ? 'Once a week' : `Every ${sch.n} days`
}

export const daysUntilDue = (s: SuppStatus, today: string) => (s.dueDate ? diffDays(today, s.dueDate) : undefined)
