import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db/db'
import { useApp } from '../hooks/app'
import { useFoodMap, useLevelStatus, useStreak } from '../hooks/data'
import { saveBody } from '../db/ops'
import { Bar, Btn, Card, Chip, Empty, Icon, NumInput, Screen, SectionTitle, Segmented } from '../components/ui'
import { EXERCISES } from '../data/exercises'
import { TEMPLATES } from '../data/templates'
import { addDays, formatDate, weekdayOf } from '../engine/dateEngine'
import { resolveDayKey } from '../engine/scheduleEngine'
import { setScore } from '../engine/progression'
import { LEVEL_LABEL } from '../types'

const axis = { fontSize: 11, fill: 'var(--muted)' }
const tip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', fontSize: 12 },
  labelStyle: { color: 'var(--muted)' },
}

export default function Progress() {
  const { profile, today, schedule, overrides, toast } = useApp()
  const streak = useStreak()
  const level = useLevelStatus()
  const foods = useFoodMap()
  const body = useLiveQuery(() => db.bodyLogs.orderBy('date').toArray(), [])
  const doneSessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  const foodLogs = useLiveQuery(() => db.foodLogs.where('date').aboveOrEqual(addDays(today, -13)).toArray(), [today])
  const mainSets = useLiveQuery(() => db.sets.filter((s) => s.done && (s.weightKg !== undefined || s.reps !== undefined)).toArray(), [])
  const [range, setRange] = useState<30 | 90 | 365>(90)

  const lastWeight = [...(body ?? [])].reverse().find((b) => b.weightKg !== undefined)
  const lastWaist = [...(body ?? [])].reverse().find((b) => b.waistCm !== undefined)
  const [w, setW] = useState<number | undefined>(undefined)
  const [c, setC] = useState<number | undefined>(undefined)
  const todayLog = body?.find((b) => b.date === today)
  const wShown = w ?? todayLog?.weightKg ?? lastWeight?.weightKg ?? profile.weightKg
  const cShown = c ?? todayLog?.waistCm ?? lastWaist?.waistCm

  const weightPoints = useMemo(() => {
    const from = addDays(today, -range)
    return (body ?? []).filter((b) => b.weightKg !== undefined && b.date >= from).map((b) => ({ date: b.date, label: formatDate(b.date, { day: 'numeric', month: 'short' }), kg: b.weightKg as number }))
  }, [body, range, today])
  const waistPoints = useMemo(
    () => (body ?? []).filter((b) => b.waistCm !== undefined).map((b) => ({ label: formatDate(b.date, { day: 'numeric', month: 'short' }), cm: b.waistCm as number })),
    [body],
  )

  const proteinDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, -(13 - i))
      const g = (foodLogs ?? []).filter((l) => l.date === date).reduce((a, l) => a + (foods[l.foodId]?.proteinG ?? 0) * l.portions, 0)
      return { label: formatDate(date, { day: 'numeric' }), g: Math.round(g) }
    })
  }, [foodLogs, foods, today])

  const prs = useMemo(() => {
    const rows: { id: string; name: string; text: string; score: number }[] = []
    for (const ex of EXERCISES) {
      if (!ex.mainLift) continue
      const sets = (mainSets ?? []).filter((s) => s.exerciseId === ex.id)
      if (!sets.length) continue
      const best = sets.reduce((b, s) => (setScore(ex, s) > setScore(ex, b) ? s : b))
      const text = ex.loaded && best.weightKg ? `${best.weightKg} kg × ${best.reps ?? '-'}` : `${best.reps ?? best.seconds} ${ex.measure === 'time' ? 's' : 'reps'}`
      rows.push({ id: ex.id, name: ex.name, text, score: setScore(ex, best) })
    }
    return rows
  }, [mainSets])

  // this week (Mon-Sun) workout days done vs planned
  const week = useMemo(() => {
    const monday = addDays(today, -((weekdayOf(today) + 6) % 7))
    let planned = 0
    let done = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i)
      if (d > today) break
      const k = resolveDayKey(weekdayOf(d), schedule, overrides[d])
      const isDone = (doneSessions ?? []).some((s) => s.date === d)
      if (TEMPLATES[k].kind === 'gym') planned++
      if (isDone && TEMPLATES[k].kind === 'gym') done++
    }
    return { planned, done }
  }, [today, schedule, overrides, doneSessions])

  const startKg = (body ?? []).find((b) => b.weightKg !== undefined)?.weightKg ?? profile.weightKg
  const nowKg = lastWeight?.weightKg ?? profile.weightKg
  const lost = startKg - nowKg
  const toGo = nowKg - profile.goalKg
  const bmi = nowKg / Math.pow(profile.heightCm / 100, 2)
  const recent = [...(doneSessions ?? [])].filter((s) => s.dayKey !== 'rest').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)

  return (
    <Screen title="Progress" subtitle="Consistency beats intensity">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon="flame" label="Streak" value={`${streak.current}`} sub={`best ${streak.best}`} />
        <Stat icon="dumbbell" label="This week" value={`${week.done}/${week.planned || '-'}`} sub="gym days" />
        <Stat icon="trophy" label="Workouts" value={`${(doneSessions ?? []).filter((s) => s.dayKey !== 'rest').length}`} sub="all time" />
      </div>

      {/* ───── Level ───── */}
      <SectionTitle right={<Chip tone="accent">{LEVEL_LABEL[profile.level]}</Chip>}>Level</SectionTitle>
      <Card className="space-y-3">
        {level?.rule ? (
          <>
            <p className="font-semibold">Road to {LEVEL_LABEL[level.rule.next]}</p>
            <ul className="space-y-2">
              {level.checks.map((ck) => (
                <li key={ck.label} className="flex items-start gap-2.5 text-sm">
                  <span className={clsx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full', ck.ok ? 'bg-accent text-accent-fg' : 'bg-surface2 text-muted')}>{ck.ok ? <Icon name="check" size={13} /> : <Icon name="minus" size={13} />}</span>
                  <span className="flex-1">{ck.label}</span>
                  <span className="text-muted">{ck.detail}</span>
                </li>
              ))}
            </ul>
            {level.progressed.length > 0 && <p className="text-xs text-muted">Progressing: {level.progressed.join(', ')}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">You're at the top level. Keep the streak alive and keep adding load.</p>
        )}
      </Card>

      {/* ───── Body ───── */}
      <SectionTitle>Body</SectionTitle>
      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Start" value={`${startKg}`} unit="kg" />
          <Mini label="Now" value={`${nowKg}`} unit="kg" strong />
          <Mini label="Goal" value={`${profile.goalKg}`} unit="kg" />
        </div>
        <Bar value={Math.max(0, lost)} max={Math.max(0.1, startKg - profile.goalKg)} />
        <p className="text-sm text-muted">
          {toGo <= 0 ? 'Goal weight reached 🎉' : `${toGo.toFixed(1)} kg to go`}
          {lost > 0 && ` · ${lost.toFixed(1)} kg down`} · BMI {bmi.toFixed(1)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-sm font-medium">Weight</p>
            <NumInput label="Weight in kilograms" value={wShown} onChange={setW} step={0.1} unit="kg" min={20} max={300} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Waist</p>
            <NumInput label="Waist in centimetres" value={cShown} onChange={setC} step={0.5} unit="cm" min={30} max={250} />
          </div>
        </div>
        <Btn
          block
          onClick={async () => {
            const patch: { weightKg?: number; waistCm?: number } = {}
            if (w !== undefined && w > 0) patch.weightKg = w
            else if (!todayLog?.weightKg && wShown) patch.weightKg = wShown
            if (c !== undefined && c > 0) patch.waistCm = c
            if (patch.weightKg === undefined && patch.waistCm === undefined) return toast('Enter a weight or waist first')
            await saveBody(today, patch)
            setW(undefined)
            setC(undefined)
            toast('Saved ✓')
          }}
        >
          Save today's measurements
        </Btn>

        {weightPoints.length >= 2 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Weight trend</p>
              <div className="w-44">
                <Segmented label="Range" value={range} onChange={setRange} options={[{ value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 365, label: '1y' }]} />
              </div>
            </div>
            <div className="h-48" role="img" aria-label="Weight trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightPoints} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={[(min: number) => Math.floor(Math.min(min, profile.goalKg) - 1), (max: number) => Math.ceil(max + 1)]} tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tip} formatter={(v) => [`${v} kg`, 'Weight']} />
                  <ReferenceLine y={profile.goalKg} stroke="var(--good)" strokeDasharray="4 4" label={{ value: `Goal ${profile.goalKg}`, fill: 'var(--good)', fontSize: 11, position: 'insideBottomRight' }} />
                  <Line type="monotone" dataKey="kg" stroke="var(--accent)" strokeWidth={3} dot={{ r: 3, fill: 'var(--accent)' }} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <Empty title="Your trend appears here">Log your weight at least twice to see the line.</Empty>
        )}

        {waistPoints.length >= 2 && (
          <div>
            <p className="mb-2 text-sm font-medium">Waist (cm)</p>
            <div className="h-36" role="img" aria-label="Waist trend chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waistPoints} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tip} formatter={(v) => [`${v} cm`, 'Waist']} />
                  <Line type="monotone" dataKey="cm" stroke="var(--warn)" strokeWidth={3} dot={{ r: 3, fill: 'var(--warn)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* ───── Protein ───── */}
      <SectionTitle>Protein · last 14 days</SectionTitle>
      <Card>
        <div className="h-40" role="img" aria-label="Protein per day chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={proteinDays} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tip} cursor={{ fill: 'var(--surface2)' }} formatter={(v) => [`${v} g`, 'Protein']} />
              <ReferenceLine y={profile.proteinTargetG} stroke="var(--good)" strokeDasharray="4 4" />
              <RBar dataKey="g" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ───── PRs ───── */}
      <SectionTitle>Personal bests</SectionTitle>
      {prs.length === 0 ? (
        <Empty title="No lifts logged yet">Complete a workout and your best sets show up here.</Empty>
      ) : (
        <Card className="divide-y divide-line !p-0">
          {prs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate font-medium">{p.name}</span>
              <span className="font-bold tabular-nums">{p.text}</span>
            </div>
          ))}
        </Card>
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle>Recent workouts</SectionTitle>
          <Card className="divide-y divide-line !p-0">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{TEMPLATES[s.dayKey].name}</span>
                <span className="text-sm text-muted">{formatDate(s.date)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}

function Stat({ icon, label, value, sub }: { icon: 'flame' | 'dumbbell' | 'trophy'; label: string; value: string; sub: string }) {
  return (
    <Card className="!p-3 text-center">
      <Icon name={icon} size={18} className="mx-auto text-accent" />
      <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </Card>
  )
}

function Mini({ label, value, unit, strong }: { label: string; value: string; unit: string; strong?: boolean }) {
  return (
    <div className={clsx('rounded-xl p-2', strong ? 'bg-accent-soft' : 'bg-surface2')}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums">
        {value} <span className="text-xs font-medium text-muted">{unit}</span>
      </p>
    </div>
  )
}
