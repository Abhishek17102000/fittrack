import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../hooks/app'
import { dayName, useDayFood, useLevelStatus, useLoad, usePlannedDay, useSessionsOn, useStreak, useSupplements } from '../hooks/data'
import { usePending } from '../hooks/reminders'
import {
  changeLevel,
  completeRestDay,
  markSupplement,
  saveBody,
  setDayOverride,
  snoozeLevelOffer,
  startSession,
} from '../db/ops'
import { Banner, Btn, Card, Chip, Icon, NumInput, Ring, Screen, SectionTitle, Sheet } from '../components/ui'
import { ExerciseSheet } from '../components/ExerciseGuide'
import { getExercise } from '../data/exercises'
import { DAY_KEYS, TEMPLATES } from '../data/templates'
import { resolveDayKey, targetLabel, type ResolvedBlock } from '../engine/scheduleEngine'
import { suggestWeight } from '../engine/progression'
import { addDays, formatDate, localParts, weekdayOf } from '../engine/dateEngine'
import { LEVEL_LABEL, type DayKey, type Section } from '../types'
import type { Reminder } from '../engine/reminderEngine'

const SECTION_LABEL: Record<Section, string> = { warmup: 'Warm-up', main: 'Main work', finisher: 'Finisher', cooldown: 'Cool-down' }

function greeting(hour: number) {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Today() {
  const { profile, today, weekday, now, tz, schedule, overrides, toast } = useApp()
  const nav = useNavigate()
  const { dayKey, workout } = usePlannedDay()
  const sessions = useSessionsOn(today)
  const yesterdaySessions = useSessionsOn(addDays(today, -1))
  const load = useLoad()
  const level = useLevelStatus()
  const streak = useStreak()
  const { pending, dismiss } = usePending()
  const food = useDayFood(today)
  const supps = useSupplements(today)
  const [guide, setGuide] = useState<string | null>(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const hour = localParts(now, tz).hour
  const template = TEMPLATES[dayKey]
  const doneSession = sessions?.find((s) => s.status === 'done')
  const openSession = sessions?.find((s) => s.status === 'in_progress')

  // suggested weights for the cards
  const loadedIds = useMemo(() => [...new Set(workout.blocks.map((b) => b.exerciseId).filter((id) => getExercise(id).loaded))], [workout])
  const history = useLiveQuery(() => (loadedIds.length ? db.sets.where('exerciseId').anyOf(loadedIds).toArray() : []), [loadedIds])
  const suggestions = useMemo(() => {
    const m: Record<string, number | undefined> = {}
    for (const id of loadedIds) m[id] = suggestWeight(getExercise(id), history ?? [], load.factor)
    return m
  }, [loadedIds, history, load.factor])

  // missed yesterday?
  const yesterday = addDays(today, -1)
  const yKey = resolveDayKey(weekdayOf(yesterday), schedule, overrides[yesterday])
  const missedYesterday =
    yesterday >= profile.programStart &&
    TEMPLATES[yKey].kind === 'gym' &&
    yesterdaySessions !== undefined &&
    !yesterdaySessions.some((s) => s.status === 'done') &&
    dayKey !== yKey &&
    TEMPLATES[dayKey].kind !== 'gym'

  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      const id = await startSession({ date: today, dayKey, level: profile.level, workout, factor: load.factor })
      nav(`/session/${id}`)
    } finally {
      setBusy(false)
    }
  }

  const chooseDay = async (k: DayKey) => {
    const planned = resolveDayKey(weekday, schedule, undefined)
    await setDayOverride(today, k === planned ? null : k)
    setSwitchOpen(false)
    toast(`Today: ${TEMPLATES[k].name}`)
  }

  const groups = (['warmup', 'main', 'finisher', 'cooldown'] as Section[])
    .map((s) => ({ section: s, blocks: workout.blocks.filter((b) => b.section === s) }))
    .filter((g) => g.blocks.length)

  const inbox = pending.filter((r) => r.kind !== 'gym' && r.kind !== 'supp')
  const dueSupps = supps.rows.filter((r) => r.status.state === 'due' || r.status.state === 'overdue')
  const takenSupps = supps.rows.filter((r) => r.status.state === 'taken')

  return (
    <Screen
      title={`${greeting(hour)}${profile.name ? `, ${profile.name}` : ''}`}
      subtitle={`${formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })} · ${tz.replace('_', ' ')}`}
      right={
        <div className="flex items-center gap-2">
          <Chip tone="accent">{LEVEL_LABEL[profile.level]}</Chip>
          <span
            className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-sm font-bold"
            title={`Best streak: ${streak.best}`}
            aria-label={`Current streak ${streak.current} days`}
          >
            <Icon name="flame" size={16} className={streak.current ? 'text-orange-500' : 'text-muted'} />
            {streak.current}
          </span>
        </div>
      }
    >
      {level?.eligible && level.rule && (
        <Banner
          icon="trophy"
          title={`You've earned ${LEVEL_LABEL[level.rule.next]}!`}
          action={
            <>
              <Btn
                size="sm"
                onClick={async () => {
                  await changeLevel(profile.level, level.rule!.next, today, 'Met all promotion checks')
                  toast(`Welcome to ${LEVEL_LABEL[level.rule!.next]} 🎉`)
                }}
              >
                Level up
              </Btn>
              <Btn size="sm" variant="soft" onClick={() => snoozeLevelOffer(addDays(today, 7))}>
                Stay one more week
              </Btn>
            </>
          }
        >
          {level.sessionsDone} sessions, {Math.round(level.consistency * 100)}% consistency, {level.progressed.length} lifts progressed. Harder variants and more volume are waiting.
        </Banner>
      )}

      {load.mode !== 'normal' && (
        <Banner tone="warn" icon="timer" title={load.mode === 'deload' ? 'Deload week' : 'Welcome back - ease in'}>
          {load.mode === 'deload'
            ? 'Weights are cut to 60% this week so your body can recover and come back stronger.'
            : `It's been a while since your last workout. Weights are set to 80% for now - build back up gradually.`}
        </Banner>
      )}

      {inbox.map((r) => (
        <InboxCard key={r.id} r={r} onDismiss={() => dismiss(r.id)} />
      ))}

      {/* ───── Today's workout ───── */}
      <Card className="space-y-4 !p-0">
        <div className="p-4 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Today's plan</p>
              <h2 className="text-xl font-bold">{template.name}</h2>
              {template.kind !== 'rest' && (
                <p className="text-sm text-muted">
                  {workout.blocks.reduce((a, b) => a + b.sets, 0)} sets · about {template.estMin} min
                </p>
              )}
            </div>
            <Btn size="sm" variant="soft" onClick={() => setSwitchOpen(true)}>
              <Icon name="swap" size={16} /> Change
            </Btn>
          </div>
          {template.note && <p className="mt-2 rounded-xl bg-surface2 p-3 text-sm text-muted">{template.note}</p>}
          {missedYesterday && (
            <button
              type="button"
              onClick={() => chooseDay(yKey)}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-warn-soft px-3 py-2 text-left text-sm text-warn"
            >
              <span>You missed yesterday's {TEMPLATES[yKey].name}. Do it today instead?</span>
              <Icon name="right" size={16} />
            </button>
          )}
        </div>

        {template.kind !== 'rest' && (
          <div className="px-4">
            {doneSession ? (
              <Btn block size="lg" variant="soft" onClick={() => nav(`/summary/${doneSession.id}`)}>
                <Icon name="check" /> Completed - view summary
              </Btn>
            ) : (
              <Btn block size="lg" onClick={start} disabled={busy}>
                <Icon name="play" size={20} fill /> {openSession ? 'Resume workout' : 'Start workout'}
              </Btn>
            )}
          </div>
        )}

        {template.kind === 'rest' ? (
          <RestDay
            done={!!doneSession}
            onDone={async () => {
              await completeRestDay(today, profile.level)
              toast('Rest day logged. Recovery counts 💚')
            }}
          />
        ) : (
          <div className="space-y-3 px-4 pb-4">
            {groups.map((g) => (
              <SectionList key={g.section} section={g.section} blocks={g.blocks} suggestions={suggestions} onOpen={setGuide} />
            ))}
          </div>
        )}

      </Card>

      {/* ───── Supplements ───── */}
      {(dueSupps.length > 0 || takenSupps.length > 0) && (
        <>
          <SectionTitle right={dueSupps.length === 0 ? <Chip tone="accent">All done</Chip> : <Chip tone="warn">{dueSupps.length} due</Chip>}>Supplements</SectionTitle>
          <Card className="divide-y divide-line !p-0">
            {[...dueSupps, ...takenSupps].map(({ supp, status }) => {
              const taken = status.state === 'taken'
              return (
                <button
                  key={supp.id}
                  type="button"
                  onClick={() => markSupplement(supp.id, today, !taken)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
                  aria-pressed={taken}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${taken ? 'border-accent bg-accent text-accent-fg' : 'border-line'}`}>
                    {taken && <Icon name="check" size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${taken ? 'text-muted line-through' : ''}`}>{supp.name}</span>
                    <span className="block text-xs text-muted">
                      {supp.dose} {supp.unit}
                      {status.state === 'overdue' && <span className="ml-2 font-semibold text-warn">overdue</span>}
                    </span>
                  </span>
                </button>
              )
            })}
          </Card>
        </>
      )}

      {/* ───── Protein ───── */}
      <Card onClick={() => nav('/diet')} className="flex items-center gap-4">
        <Ring name="Protein" value={food.proteinG} max={profile.proteinTargetG} label={`${Math.round(food.proteinG)}g`} sub={`of ${profile.proteinTargetG}g`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Protein today</p>
          <p className="text-sm text-muted">
            {food.logs.length === 0
              ? 'Nothing logged yet. Tap to add your meals.'
              : food.proteinG >= profile.proteinTargetG
                ? 'Target reached 🎯'
                : `${Math.round(profile.proteinTargetG - food.proteinG)} g to go · ${Math.round(food.kcal)} kcal so far`}
          </p>
        </div>
        <Icon name="right" className="text-muted" />
      </Card>

      <ExerciseSheet exerciseId={guide} onClose={() => setGuide(null)} />

      <Sheet open={switchOpen} onClose={() => setSwitchOpen(false)} title="Choose today's workout">
        <div className="space-y-2">
          {DAY_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => chooseDay(k)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${k === dayKey ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
            >
              <span>
                <span className="block font-semibold">{dayName(k)}</span>
                <span className="text-sm text-muted">{TEMPLATES[k].kind === 'rest' ? 'Recovery' : `about ${TEMPLATES[k].estMin} min`}</span>
              </span>
              {k === dayKey && <Icon name="check" className="text-accent" />}
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  )
}

function SectionList({
  section,
  blocks,
  suggestions,
  onOpen,
}: {
  section: Section
  blocks: ResolvedBlock[]
  suggestions: Record<string, number | undefined>
  onOpen: (id: string) => void
}) {
  const compact = section === 'warmup' || section === 'cooldown'
  const [open, setOpen] = useState(!compact)
  return (
    <section aria-label={SECTION_LABEL[section]}>
      <button type="button" onClick={() => compact && setOpen((o) => !o)} className="mb-1.5 flex w-full items-center justify-between text-left" aria-expanded={open}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{SECTION_LABEL[section]}</h3>
        {compact && (
          <span className="flex items-center gap-1 text-xs text-muted">
            {blocks.length} moves <Icon name={open ? 'up' : 'down'} size={14} />
          </span>
        )}
      </button>
      {open ? (
        <ul className="space-y-2">
          {blocks.map((b, i) => (
            <ExerciseRow key={b.blockIdx} block={b} index={i + 1} suggestion={suggestions[b.exerciseId]} onOpen={() => onOpen(b.exerciseId)} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{blocks.map((b) => getExercise(b.exerciseId).name).join(' · ')}</p>
      )}
    </section>
  )
}

function ExerciseRow({ block, index, suggestion, onOpen }: { block: ResolvedBlock; index: number; suggestion?: number; onOpen: () => void }) {
  const ex = getExercise(block.exerciseId)
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl bg-surface2 p-3 text-left" aria-label={`${ex.name}, ${targetLabel(block)}. Open guide`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-sm font-bold text-muted">{index}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{ex.name}</span>
          <span className="block text-sm text-muted">
            {targetLabel(block)}
            {ex.perSide && ' per side'}
            {suggestion !== undefined && <span className="ml-2 font-semibold text-accent">{suggestion} kg</span>}
          </span>
        </span>
        <Icon name="video" size={18} className="text-muted" />
      </button>
    </li>
  )
}

function RestDay({ done, onDone }: { done: boolean; onDone: () => void }) {
  return (
    <div className="space-y-3 px-4 pb-4">
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <Icon name="rest" size={18} className="text-accent" /> Recovery is when muscle is built - take it easy.
        </li>
        <li className="flex gap-2">
          <Icon name="flame" size={18} className="text-accent" /> Still aim for 7,000-8,000 steps and a daylight walk.
        </li>
        <li className="flex gap-2">
          <Icon name="bowl" size={18} className="text-accent" /> Hit your protein target even on rest days.
        </li>
        <li className="flex gap-2">
          <Icon name="moon" size={18} className="text-accent" /> Protect 7-8 hours of sleep tonight.
        </li>
      </ul>
      {done ? (
        <Btn block variant="soft" disabled>
          <Icon name="check" /> Rest day logged
        </Btn>
      ) : (
        <Btn block onClick={onDone}>
          <Icon name="check" /> Mark rest day done
        </Btn>
      )}
    </div>
  )
}

function InboxCard({ r, onDismiss }: { r: Reminder; onDismiss: () => void }) {
  const { today, toast, profile } = useApp()
  const nav = useNavigate()
  const lastWeight = useLiveQuery(() => db.bodyLogs.orderBy('date').filter((b) => b.weightKg !== undefined).last(), [])
  const lastWaist = useLiveQuery(() => db.bodyLogs.orderBy('date').filter((b) => b.waistCm !== undefined).last(), [])
  const [val, setVal] = useState<number | undefined>(undefined)

  const isWeight = r.kind === 'weight'
  const isWaist = r.kind === 'waist'
  const initial = isWeight ? (lastWeight?.weightKg ?? profile.weightKg) : isWaist ? lastWaist?.waistCm : undefined
  const shown = val ?? initial

  const save = async () => {
    if (shown === undefined || shown <= 0) return toast('Enter a number first')
    await saveBody(today, isWeight ? { weightKg: shown } : { waistCm: shown })
    toast(isWeight ? `Weight saved: ${shown} kg` : `Waist saved: ${shown} cm`)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.title}</p>
          <p className="text-sm text-muted">{r.body}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss reminder" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted">
          <Icon name="x" size={16} />
        </button>
      </div>
      {(isWeight || isWaist) && (
        <div className="flex items-center gap-3">
          <div className="w-44">
            <NumInput label={isWeight ? 'Weight in kilograms' : 'Waist in centimetres'} value={shown} onChange={setVal} step={isWeight ? 0.1 : 0.5} unit={isWeight ? 'kg' : 'cm'} min={20} max={300} />
          </div>
          <Btn onClick={save}>Save</Btn>
        </div>
      )}
      {(r.kind === 'meals' || r.kind === 'protein') && (
        <Btn variant="soft" size="sm" onClick={() => nav('/diet')}>
          Open diet log
        </Btn>
      )}
    </Card>
  )
}
