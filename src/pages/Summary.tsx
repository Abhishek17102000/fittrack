import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { db } from '../db/db'
import { sessionPRs, type PR } from '../db/ops'
import { useLevelStatus, useStreak } from '../hooks/data'
import { useApp } from '../hooks/app'
import { Bar, Btn, Card, Icon, Screen, SectionTitle, Splash } from '../components/ui'
import { getExercise } from '../data/exercises'
import { TEMPLATES } from '../data/templates'
import { LEVEL_LABEL } from '../types'

export default function Summary() {
  const sid = Number(useParams().id)
  const nav = useNavigate()
  const { profile } = useApp()
  const session = useLiveQuery(async () => (await db.sessions.get(sid)) ?? null, [sid])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sid).toArray(), [sid])
  const streak = useStreak()
  const level = useLevelStatus()
  const [prs, setPrs] = useState<PR[]>([])

  useEffect(() => {
    if (session?.status === 'done') void sessionPRs(sid).then(setPrs)
  }, [sid, session?.status])

  if (session === undefined || sets === undefined) return <Splash />
  if (session === null || session.status !== 'done') return <Navigate to="/" replace />

  const done = sets.filter((s) => s.done)
  const volume = done.reduce((a, s) => a + (s.weightKg && s.reps ? s.weightKg * s.reps : 0), 0)
  const exercises = new Set(done.map((s) => s.exerciseId)).size
  const minutes = session.finishedAt ? Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000)) : 0
  const stats = [
    { label: 'Time', value: `${minutes}`, unit: 'min' },
    { label: 'Sets', value: `${done.length}`, unit: `of ${sets.length}` },
    { label: 'Exercises', value: `${exercises}`, unit: '' },
    { label: 'Volume', value: volume >= 1000 ? (volume / 1000).toFixed(1) : `${Math.round(volume)}`, unit: volume >= 1000 ? 't' : 'kg' },
  ]

  return (
    <Screen title="Workout complete 🎉" subtitle={TEMPLATES[session.dayKey].name}>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
              <p className="text-3xl font-bold tabular-nums">
                {s.value} <span className="text-base font-medium text-muted">{s.unit}</span>
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="flex items-center gap-3">
        <Icon name="flame" size={28} className="text-orange-500" />
        <div>
          <p className="font-semibold">{streak.current}-day streak</p>
          <p className="text-sm text-muted">Best: {streak.best} days</p>
        </div>
      </Card>

      {prs.length > 0 && (
        <>
          <SectionTitle>Personal records</SectionTitle>
          <Card className="divide-y divide-line !p-0">
            {prs.map((p) => (
              <div key={p.exerciseId} className="flex items-center gap-3 px-4 py-3">
                <Icon name="trophy" className="text-accent" />
                <span className="flex-1 font-medium">{getExercise(p.exerciseId).name}</span>
                <span className="font-bold tabular-nums">{p.detail}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {level?.rule && (
        <>
          <SectionTitle>Road to {LEVEL_LABEL[level.rule.next]}</SectionTitle>
          <Card className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Consistency</span>
              <span className="font-semibold">{Math.round(level.consistency * 100)}%</span>
            </div>
            <Bar value={level.consistency * 100} max={100} />
            <p className="text-sm text-muted">
              {level.eligible
                ? 'You are ready to level up. Open Today to accept.'
                : level.windowElapsed
                  ? 'Keep going - a few checks are left (see Progress).'
                  : `${level.daysLeft} days left in your ${LEVEL_LABEL[profile.level]} evaluation period.`}
            </p>
          </Card>
        </>
      )}

      <Btn block size="lg" onClick={() => nav('/', { replace: true })}>
        Done
      </Btn>
    </Screen>
  )
}
