import { useState } from 'react'
import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../hooks/app'
import { useSupplements, type SuppRow } from '../hooks/data'
import { deleteSupplement, markSupplement, saveSupplement } from '../db/ops'
import { Banner, Btn, Card, Chip, Confirm, Empty, Field, Icon, inputCls, NumInput, Screen, SectionTitle, Sheet, Toggle } from '../components/ui'
import { adherenceCells, adherencePct, scheduleLabel } from '../engine/supplementEngine'
import { formatDate, WEEKDAYS } from '../engine/dateEngine'
import type { DoseUnit, Supplement, SuppSchedule } from '../types'

const UNITS: DoseUnit[] = ['g', 'mg', 'mcg', 'IU', 'capsule']
const doseStep = (u: DoseUnit) => (u === 'IU' ? 1000 : u === 'mg' ? 50 : u === 'mcg' ? 100 : 1)

export default function Supplements() {
  const { today, toast } = useApp()
  const { rows, ready } = useSupplements(today)
  const logs = useLiveQuery(() => db.supplementLogs.toArray(), [])
  const [editing, setEditing] = useState<Supplement | null>(null)

  const todayRows = rows.filter((r) => r.status.state !== 'none')
  const dueCount = rows.filter((r) => r.status.state === 'due' || r.status.state === 'overdue').length

  const blank = (): Supplement => ({
    id: `custom_${Date.now().toString(36)}`,
    name: '',
    dose: 1,
    unit: 'capsule',
    schedule: { kind: 'daily' },
    reminderTime: '10:30',
    active: true,
    since: today,
  })

  return (
    <Screen
      title="Supplements"
      subtitle="Track what you take, and when"
      right={
        <Btn size="sm" onClick={() => setEditing(blank())}>
          <Icon name="plus" size={16} /> Add
        </Btn>
      }
    >
      <SectionTitle right={ready && (dueCount === 0 ? <Chip tone="accent">All done</Chip> : <Chip tone="warn">{dueCount} due</Chip>)}>Today</SectionTitle>
      {ready && todayRows.length === 0 ? (
        <Empty title="Nothing due today">Your next dose will show up here on its day.</Empty>
      ) : (
        <Card className="divide-y divide-line !p-0">
          {todayRows.map(({ supp, status }) => {
            const taken = status.state === 'taken'
            return (
              <button
                key={supp.id}
                type="button"
                aria-pressed={taken}
                onClick={async () => {
                  await markSupplement(supp.id, today, !taken)
                  if (!taken) toast(`${supp.name} logged ✓`)
                }}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full border-2', taken ? 'border-accent bg-accent text-accent-fg' : 'border-line')}>{taken && <Icon name="check" size={18} />}</span>
                <span className="min-w-0 flex-1">
                  <span className={clsx('block font-semibold', taken && 'text-muted line-through')}>{supp.name}</span>
                  <span className="block text-sm text-muted">
                    {supp.dose.toLocaleString('en-IN')} {supp.unit}
                    {status.state === 'overdue' && <span className="ml-2 font-semibold text-warn">overdue since {status.dueDate && formatDate(status.dueDate, { day: 'numeric', month: 'short' })}</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </Card>
      )}

      <Banner icon="info" title="Check your doses">
        B12 is in <b>mcg</b> (micrograms), not mg. For vitamin D, follow the dose and schedule from your blood test and doctor.
      </Banner>

      <SectionTitle>All supplements</SectionTitle>
      {rows.map((r) => (
        <SuppCard key={r.supp.id} row={r} logs={logs ?? []} today={today} onEdit={() => setEditing(r.supp)} />
      ))}

      <EditSheet key={editing?.id ?? 'none'} supp={editing} isNew={!!editing && !rows.some((r) => r.supp.id === editing.id)} onClose={() => setEditing(null)} />
    </Screen>
  )
}

function SuppCard({ row, logs, today, onEdit }: { row: SuppRow; logs: { supplementId: string; date: string; takenAt: number }[]; today: string; onEdit: () => void }) {
  const { supp, status } = row
  const cells = adherenceCells(supp, logs, today, 30)
  const pct = adherencePct(supp, logs, today, 30)
  return (
    <Card className={clsx('space-y-3', !supp.active && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{supp.name}</p>
          <p className="text-sm text-muted">
            {supp.dose.toLocaleString('en-IN')} {supp.unit} · {scheduleLabel(supp)} · {supp.reminderTime}
          </p>
          {supp.schedule.kind === 'everyNDays' && status.state === 'none' && status.dueDate && (
            <p className="text-sm text-muted">Next dose: {formatDate(status.dueDate)}</p>
          )}
        </div>
        <button type="button" onClick={onEdit} aria-label={`Edit ${supp.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-muted">
          <Icon name="edit" size={16} />
        </button>
      </div>
      {supp.note && <p className="text-xs text-muted">{supp.note}</p>}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Last 30 days</span>
          <span className="font-semibold">{pct === undefined ? '-' : `${pct}%`}</span>
        </div>
        <div className="flex gap-[3px]" role="img" aria-label={`Adherence over 30 days: ${pct ?? 0} percent`}>
          {cells.map((c) => (
            <span key={c.date} title={`${formatDate(c.date)}: ${c.state}`} className={clsx('h-5 flex-1 rounded-[3px]', c.state === 'taken' ? 'bg-accent' : c.state === 'missed' ? 'bg-bad/40' : 'bg-surface2')} />
          ))}
        </div>
      </div>
    </Card>
  )
}

function EditSheet({ supp, isNew, onClose }: { supp: Supplement | null; isNew: boolean; onClose: () => void }) {
  const { today, toast } = useApp()
  const [d, setD] = useState<Supplement | null>(supp)
  const [confirmDel, setConfirmDel] = useState(false)
  if (!supp || !d) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const set = (p: Partial<Supplement>) => setD({ ...d, ...p })
  const kind = d.schedule.kind
  const setKind = (k: SuppSchedule['kind']) => {
    if (k === 'daily') set({ schedule: { kind: 'daily' } })
    else if (k === 'weekdays') set({ schedule: { kind: 'weekdays', days: d.schedule.kind === 'weekdays' ? d.schedule.days : [1, 3, 5] } })
    else set({ schedule: { kind: 'everyNDays', n: d.schedule.kind === 'everyNDays' ? d.schedule.n : 7, anchor: d.schedule.kind === 'everyNDays' ? d.schedule.anchor : today } })
  }
  const valid = d.name.trim().length > 0 && d.dose > 0 && (d.schedule.kind !== 'weekdays' || d.schedule.days.length > 0) && (d.schedule.kind !== 'everyNDays' || d.schedule.n >= 1)

  return (
    <>
      <Sheet open onClose={onClose} title={isNew ? 'Add supplement' : 'Edit supplement'}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!valid) return
            await saveSupplement({ ...d, name: d.name.trim() })
            toast('Saved')
            onClose()
          }}
        >
          <Field label="Name">
            <input aria-label="Supplement name" className={inputCls} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Magnesium" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dose">
              <NumInput label="Dose" value={d.dose} onChange={(v) => set({ dose: v ?? 0 })} step={doseStep(d.unit)} max={1000000} decimals={2} />
            </Field>
            <Field label="Unit">
              <select aria-label="Unit" className={inputCls} value={d.unit} onChange={(e) => set({ unit: e.target.value as DoseUnit })}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="How often">
            <div className="flex rounded-xl bg-surface2 p-1" role="radiogroup" aria-label="Schedule">
              {([
                ['daily', 'Daily'],
                ['weekdays', 'Set days'],
                ['everyNDays', 'Every N days'],
              ] as const).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={clsx('min-h-10 flex-1 rounded-lg px-1 text-sm font-semibold', kind === k ? 'bg-surface shadow-sm' : 'text-muted')}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {d.schedule.kind === 'weekdays' && (
            <div className="flex justify-between gap-1" role="group" aria-label="Days of the week">
              {WEEKDAYS.map((name, i) => {
                const sch = d.schedule as Extract<SuppSchedule, { kind: 'weekdays' }>
                const on = sch.days.includes(i)
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ schedule: { kind: 'weekdays', days: on ? sch.days.filter((x) => x !== i) : [...sch.days, i].sort() } })}
                    className={clsx('h-11 flex-1 rounded-xl text-sm font-semibold', on ? 'bg-accent text-accent-fg' : 'bg-surface2 text-muted')}
                  >
                    {name[0]}
                    <span className="sr-only">{name}</span>
                  </button>
                )
              })}
            </div>
          )}
          {d.schedule.kind === 'everyNDays' && (
            <Field label="Repeat every (days)" hint="The next dose is counted from the day you actually take it.">
              <NumInput label="Days between doses" value={d.schedule.n} onChange={(v) => set({ schedule: { ...(d.schedule as Extract<SuppSchedule, { kind: 'everyNDays' }>), n: Math.max(1, Math.round(v ?? 1)) } })} step={1} min={1} max={365} decimals={0} />
            </Field>
          )}
          <Field label="Reminder time">
            <input aria-label="Reminder time" type="time" className={inputCls} value={d.reminderTime} onChange={(e) => set({ reminderTime: e.target.value || '10:00' })} />
          </Field>
          <Field label="Note (optional)">
            <input aria-label="Note" className={inputCls} value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. take with food" />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
            <span className="font-medium">Active</span>
            <Toggle label="Active" checked={d.active} onChange={(v) => set({ active: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isNew ? (
              <Btn variant="danger" onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={18} /> Delete
              </Btn>
            ) : (
              <Btn variant="soft" onClick={onClose}>
                Cancel
              </Btn>
            )}
            <Btn type="submit" disabled={!valid}>
              Save
            </Btn>
          </div>
        </form>
      </Sheet>
      <Confirm
        open={confirmDel}
        danger
        title={`Delete ${d.name || 'supplement'}?`}
        body="Its history will be deleted too. To just pause it, switch off Active instead."
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(false)}
        onConfirm={async () => {
          await deleteSupplement(d.id)
          setConfirmDel(false)
          onClose()
        }}
      />
    </>
  )
}
