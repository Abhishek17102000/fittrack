// Everything date-related is a plain 'YYYY-MM-DD' string in the user's own timezone.
// The "day boundary" (default 04:00) means a session at 01:30 still belongs to the previous day.

const fmtCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    fmtCache.set(tz, f)
  }
  return f
}

export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz)
    return true
  } catch {
    return false
  }
}

export interface LocalParts {
  y: number
  m: number
  d: number
  hour: number
  minute: number
}

export function localParts(at: Date, tz: string): LocalParts {
  const safe = isValidTimeZone(tz) ? tz : 'UTC'
  const o: Record<string, number> = {}
  for (const p of formatter(safe).formatToParts(at)) {
    if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10)
  }
  return { y: o.year, m: o.month, d: o.day, hour: o.hour % 24, minute: o.minute }
}

const p2 = (n: number) => String(n).padStart(2, '0')
export const toDateStr = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`

function utcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function weekdayOf(date: string): number {
  return new Date(utcMs(date)).getUTCDay()
}

export function addDays(date: string, n: number): string {
  const dt = new Date(utcMs(date) + n * 86400000)
  return toDateStr(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** b - a in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86400000)
}

export interface AppDay {
  date: string
  weekday: number
}

/** The app's "today": local date after applying the day boundary. */
export function getAppDay(now: Date, tz: string, boundaryHour: number): AppDay {
  const shifted = new Date(now.getTime() - boundaryHour * 3600000)
  const p = localParts(shifted, tz)
  const date = toDateStr(p.y, p.m, p.d)
  return { date, weekday: weekdayOf(date) }
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutes since the start of the app-day (i.e. since the day boundary), 0..1439. */
export function minutesIntoAppDay(now: Date, tz: string, boundaryHour: number): number {
  const p = localParts(now, tz)
  return (p.hour * 60 + p.minute - boundaryHour * 60 + 1440) % 1440
}

/** Position of a wall-clock time (HH:MM) within the app-day. */
export function shiftToAppDay(hhmm: string, boundaryHour: number): number {
  return (parseHHMM(hhmm) - boundaryHour * 60 + 1440) % 1440
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatDate(
  date: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  return new Date(utcMs(date)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
}

export function formatDuration(sec: number): string {
  if (sec >= 120) return `${Math.round(sec / 60)} min`
  return `${sec}s`
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${p2(s % 60)}`
}
