import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { db } from '../db/db'
import { useApp } from '../hooks/app'
import { useLoad } from '../hooks/data'
import { discardSession, finishSession, setRpe, swapBlockExercise, toggleSet, updateSet } from '../db/ops'
import { Bar, Btn, Chip, Confirm, Icon, NumInput, Sheet, Splash } from '../components/ui'
import { ExerciseSheet } from '../components/ExerciseGuide'
import { getExercise } from '../data/exercises'
import { formatClock } from '../engine/dateEngine'
import { acquireWakeLock, timerDone, vibrate } from '../lib/feedback'
import type { Rpe, Section, SetLog } from '../types'

const SECTION_LABEL: Record<Section, string> = { warmup: 'Warm-up', main: 'Main work', finisher: 'Finisher', cooldown: 'Cool-down' }

interface Block {
  blockIdx: number
  exerciseId: string
  section: Section
  restSec: number
  sets: SetLog[]
}

/** Remaining seconds of a wall-clock based timer; ticks 4×/s while active. */
function useCountdown(end: number | null): number {
  const [, force] = useState(0)
  useEffect(() => {
    if (end === null) return
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [end])
  return end === null ? 0 : Math.max(0, (end - Date.now()) / 1000)
}

export default function SessionPage() {
  const sid = Number(useParams().id)
  const nav = useNavigate()
  const { toast } = useApp()
  const load = useLoad()

  const session = useLiveQuery(async () => (await db.sessions.get(sid)) ?? null, [sid])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sid).toArray(), [sid])

  const blocks: Block[] = useMemo(() => {
    const map = new Map<number, SetLog[]>()
    for (const s of sets ?? []) map.set(s.blockIdx, [...(map.get(s.blockIdx) ?? []), s])
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([blockIdx, rows]) => {
        rows.sort((a, b) => a.setNo - b.setNo)
        const current = rows.find((r) => !r.done) ?? rows[rows.length - 1]
        return { blockIdx, exerciseId: current.exerciseId, section: rows[0].section, restSec: rows[0].restSec, sets: rows }
      })
  }, [sets])

  const [cur, setCur] = useState(0)
  const initialised = useRef(false)
  const [guide, setGuide] = useState<string | null>(null)
  const [swapOpen, setSwapOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null)
  const [work, setWork] = useState<{ end: number; total: number; setId: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // start on the first exercise that still has work to do (resume support)
  useEffect(() => {
    if (initialised.current || !blocks.length || !session) return
    initialised.current = true
    const firstTodo = blocks.findIndex((b) => b.sets.some((s) => !s.done))
    const saved = session.cursor
    const start = saved !== undefined && saved < blocks.length ? saved : firstTodo === -1 ? blocks.length - 1 : firstTodo
    setCur(start)
  }, [blocks, session])

  const active = session?.status === 'in_progress'
  useEffect(() => (active ? acquireWakeLock() : undefined), [active])

  const restLeft = useCountdown(rest?.end ?? null)
  const workLeft = useCountdown(work?.end ?? null)
  const block = blocks[Math.min(cur, blocks.length - 1)]

  const startRest = useCallback((sec: number) => {
    if (sec > 0) setRest({ end: Date.now() + sec * 1000, total: sec })
  }, [])

  // rest timer finished
  useEffect(() => {
    if (rest && restLeft <= 0) {
      timerDone()
      setRest(null)
    }
  }, [rest, restLeft])

  // timed set finished: log it, then rest if the block has more to do
  useEffect(() => {
    if (!work || workLeft > 0) return
    const w = work
    setWork(null)
    timerDone()
    void (async () => {
      const row = await db.sets.get(w.setId)
      if (!row || row.done) return
      await db.sets.update(w.setId, { done: true, seconds: row.seconds ?? w.total })
      const more = await db.sets.where('sessionId').equals(row.sessionId).and((s) => s.blockIdx === row.blockIdx && !s.done && s.id !== row.id).count()
      if (more > 0) startRest(row.restSec)
    })()
  }, [work, workLeft, startRest])

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(blocks.length - 1, i))
      setCur(next)
      void db.sessions.update(sid, { cursor: next })
      setWork(null)
      setRest(null)
      scroller.current?.scrollTo({ top: 0 })
    },
    [blocks.length, sid],
  )

  if (session === undefined || sets === undefined) return <Splash />
  if (session === null) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold">That workout was not found.</p>
          <Btn onClick={() => nav('/', { replace: true })}>Back to today</Btn>
        </div>
      </div>
    )
  }
  if (session.status === 'done') return <Navigate to={`/summary/${sid}`} replace />
  if (!block) return <Splash />

  const ex = getExercise(block.exerciseId)
  const doneCount = sets.filter((s) => s.done).length
  const blockDone = block.sets.every((s) => s.done)
  const isLast = cur >= blocks.length - 1
  const timed = ex.measure === 'time'
  const nextUndone = block.sets.find((s) => !s.done)
  const anyDoneInBlock = block.sets.some((s) => s.done)
  const swapOptions = [ex.easierId && { id: ex.easierId, label: 'Easier' }, ex.harderId && { id: ex.harderId, label: 'Harder' }].filter(Boolean) as { id: string; label: string }[]

  const onToggle = async (s: SetLog) => {
    vibrate(20)
    await toggleSet(s)
    const becameDone = !s.done
    const otherUndone = block.sets.some((x) => !x.done && x.id !== s.id)
    if (becameDone && otherUndone) startRest(block.restSec)
    if (!becameDone) setRest(null)
  }

  const finish = async () => {
    if (doneCount === 0) return setDiscardOpen(true)
    await finishSession(sid)
    nav(`/summary/${sid}`, { replace: true })
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-bg">
      {/* header */}
      <div className="safe-top shrink-0 px-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setLeaveOpen(true)} aria-label="Leave workout" className="grid h-10 w-10 place-items-center rounded-full bg-surface2">
            <Icon name="x" size={20} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {SECTION_LABEL[block.section]} · {cur + 1} of {blocks.length}
            </p>
          </div>
          <Chip tone="accent">
            {doneCount}/{sets.length} sets
          </Chip>
        </div>
        <Bar value={doneCount} max={sets.length} className="mt-3" />
      </div>

      {/* body */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${block.blockIdx}-${block.exerciseId}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.15 }}
            className="mx-auto max-w-xl space-y-4"
          >
            <div>
              <h1 className="text-2xl font-bold leading-tight">{ex.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {ex.muscles.join(' · ')}
                {ex.perSide && ' · each side'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn size="sm" variant="soft" onClick={() => setGuide(block.exerciseId)}>
                  <Icon name="video" size={16} /> How to · video
                </Btn>
                {swapOptions.length > 0 && !blockDone && (
                  <Btn size="sm" variant="soft" onClick={() => setSwapOpen(true)}>
                    <Icon name="swap" size={16} /> Swap
                  </Btn>
                )}
              </div>
            </div>

            {ex.tips[0] && (
              <p className="flex gap-2 rounded-xl bg-accent-soft p-3 text-sm">
                <Icon name="bolt" size={16} className="mt-0.5 text-accent" />
                <span>{ex.tips[0]}</span>
              </p>
            )}

            {load.mode !== 'normal' && ex.loaded && <p className="text-xs font-semibold text-warn">{load.mode === 'deload' ? 'Deload week: weights reduced' : 'Easing back in: weights reduced'}</p>}

            <ul className="space-y-2" aria-label="Sets">
              {block.sets.map((s) => {
                const target = timed ? `${s.targetSeconds}s` : s.targetLo === s.targetHi ? `${s.targetHi}` : `${s.targetLo}-${s.targetHi}`
                return (
                  <li key={s.id} className={clsx('flex items-center gap-2 rounded-2xl p-2 pr-2', s.done ? 'bg-accent-soft' : 'bg-surface')}>
                    <div className="w-12 shrink-0 text-center leading-tight">
                      <div className="text-[10px] uppercase text-muted">Set</div>
                      <div className="text-lg font-bold">{s.setNo}</div>
                      <div className="text-[10px] text-muted">goal {target}</div>
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      {ex.loaded ? (
                        <NumInput label={`Set ${s.setNo} weight`} unit="kg" value={s.weightKg} step={ex.increment ?? 2.5} onChange={(v) => void updateSet(s.id!, { weightKg: v })} max={500} />
                      ) : (
                        <div className="grid place-items-center rounded-xl bg-surface2 text-xs text-muted">
                          {ex.loaded ? '' : timed ? 'Time' : 'Bodyweight'}
                        </div>
                      )}
                      {timed ? (
                        <NumInput label={`Set ${s.setNo} seconds`} unit="sec" value={s.seconds} step={5} onChange={(v) => void updateSet(s.id!, { seconds: v })} max={7200} />
                      ) : (
                        <NumInput label={`Set ${s.setNo} reps`} unit="reps" value={s.reps} step={1} onChange={(v) => void updateSet(s.id!, { reps: v })} max={500} />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onToggle(s)}
                      aria-label={s.done ? `Undo set ${s.setNo}` : `Complete set ${s.setNo}`}
                      aria-pressed={s.done}
                      className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2', s.done ? 'border-accent bg-accent text-accent-fg' : 'border-line text-muted')}
                    >
                      <Icon name="check" size={24} />
                    </button>
                  </li>
                )
              })}
            </ul>

            {timed && nextUndone && !work && (
              <Btn block size="lg" onClick={() => setWork({ end: Date.now() + (nextUndone.seconds ?? nextUndone.targetSeconds ?? 30) * 1000, total: nextUndone.seconds ?? nextUndone.targetSeconds ?? 30, setId: nextUndone.id! })}>
                <Icon name="timer" /> Start {formatClock(nextUndone.seconds ?? nextUndone.targetSeconds ?? 30)} timer
              </Btn>
            )}
            {work && (
              <div className="rounded-2xl bg-accent p-5 text-center text-accent-fg">
                <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Go!</p>
                <p className="text-6xl font-bold tabular-nums" aria-live="off">
                  {formatClock(Math.ceil(workLeft))}
                </p>
                <Btn variant="soft" size="sm" className="mt-3" onClick={() => setWork(null)}>
                  Cancel timer
                </Btn>
              </div>
            )}

            {anyDoneInBlock && block.section !== 'warmup' && block.section !== 'cooldown' && (
              <div>
                <p className="mb-1.5 text-sm font-medium">How did that feel?</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Effort">
                  {(['easy', 'good', 'hard'] as Rpe[]).map((r) => {
                    const selected = block.sets.some((s) => s.rpe === r)
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => void setRpe(sid, block.blockIdx, selected ? undefined : r)}
                        className={clsx('min-h-11 rounded-xl text-sm font-semibold capitalize', selected ? 'bg-accent text-accent-fg' : 'bg-surface2 text-muted')}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* rest timer */}
      <AnimatePresence>
        {rest && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-xl"
            role="timer"
            aria-label="Rest timer"
          >
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Rest</p>
              <p className="text-3xl font-bold tabular-nums leading-none">{formatClock(Math.ceil(restLeft))}</p>
            </div>
            <button type="button" onClick={() => setRest((r) => (r ? { end: r.end + 15000, total: r.total + 15 } : r))} className="min-h-10 rounded-xl bg-bg/20 px-3 text-sm font-bold">
              +15s
            </button>
            <button type="button" onClick={() => setRest(null)} className="min-h-10 rounded-xl bg-bg px-3 text-sm font-bold text-ink">
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* bottom nav */}
      <div className="safe-bottom flex shrink-0 items-center gap-3 border-t border-line bg-bg px-4 pt-3">
        <Btn variant="soft" onClick={() => goTo(cur - 1)} disabled={cur === 0} aria-label="Previous exercise">
          <Icon name="left" />
        </Btn>
        {isLast ? (
          <Btn block size="lg" onClick={() => void finish()}>
            <Icon name="check" /> Finish workout
          </Btn>
        ) : (
          <Btn block size="lg" variant={blockDone ? 'primary' : 'soft'} onClick={() => goTo(cur + 1)}>
            {blockDone ? 'Next exercise' : 'Skip exercise'} <Icon name={blockDone ? 'right' : 'skip'} size={20} />
          </Btn>
        )}
        {!isLast && (
          <Btn variant="soft" onClick={() => void finish()} aria-label="Finish workout now" className="shrink-0">
            <Icon name="trophy" />
          </Btn>
        )}
      </div>

      <ExerciseSheet exerciseId={guide} onClose={() => setGuide(null)} />

      <Sheet open={swapOpen} onClose={() => setSwapOpen(false)} title="Swap exercise">
        <p className="mb-3 text-sm text-muted">Sets you have not completed will switch to the new exercise.</p>
        <div className="space-y-2">
          {swapOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left"
              onClick={async () => {
                await swapBlockExercise(sid, block.blockIdx, o.id, load.factor)
                setSwapOpen(false)
                toast(`Swapped to ${getExercise(o.id).name}`)
              }}
            >
              <span>
                <span className="block text-xs font-semibold uppercase text-muted">{o.label}</span>
                <span className="font-semibold">{getExercise(o.id).name}</span>
              </span>
              <Icon name="right" className="text-muted" />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave workout?">
        <div className="space-y-2">
          <Btn block variant="soft" onClick={() => nav('/', { replace: true })}>
            Pause - keep my progress
          </Btn>
          {doneCount > 0 && (
            <Btn
              block
              onClick={() => {
                setLeaveOpen(false)
                void finish()
              }}
            >
              Finish now ({doneCount} sets logged)
            </Btn>
          )}
          <Btn
            block
            variant="danger"
            onClick={() => {
              setLeaveOpen(false)
              setDiscardOpen(true)
            }}
          >
            Discard this workout
          </Btn>
        </div>
      </Sheet>

      <Confirm
        open={discardOpen}
        danger
        title="Discard workout?"
        body={doneCount === 0 ? 'No sets were logged. This will remove the workout.' : `This deletes the ${doneCount} sets you logged.`}
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={async () => {
          await discardSession(sid)
          nav('/', { replace: true })
        }}
      />
    </div>
  )
}
