import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useApp } from '../hooks/app'
import { useDayFood } from '../hooks/data'
import { addCustomFood, addFood, setFoodPortions } from '../db/ops'
import { Bar, Btn, Card, Chip, Field, Icon, inputCls, NumInput, Ring, Screen, Sheet } from '../components/ui'
import { addDays, formatDate } from '../engine/dateEngine'
import type { Food, MealKey } from '../types'

const MEALS: { key: MealKey; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Evening snack' },
  { key: 'pregym', label: 'Pre-gym' },
  { key: 'dinner', label: 'Dinner' },
]

const fmtPortions = (p: number) => (p === 0.5 ? '½' : Number.isInteger(p) ? `${p}` : `${Math.floor(p)}½`)
const g = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

export default function Diet() {
  const { profile, today } = useApp()
  const [offset, setOffset] = useState(0)
  const date = addDays(today, offset)
  const { logs, foods, proteinG, kcal } = useDayFood(date)
  const [addTo, setAddTo] = useState<MealKey | null>(null)

  const byMeal = useMemo(() => {
    const m: Record<MealKey, typeof logs> = { breakfast: [], lunch: [], snack: [], pregym: [], dinner: [] }
    for (const l of logs) m[l.meal]?.push(l)
    return m
  }, [logs])

  const kcalLeft = profile.kcalTarget - kcal
  return (
    <Screen
      title="Diet"
      subtitle="Protein is the priority"
      right={
        <div className="flex items-center gap-1 rounded-full bg-surface2 p-1">
          <button type="button" aria-label="Previous day" onClick={() => setOffset((o) => o - 1)} className="grid h-9 w-9 place-items-center rounded-full">
            <Icon name="left" size={18} />
          </button>
          <span className="min-w-20 text-center text-sm font-semibold">{offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : formatDate(date, { day: 'numeric', month: 'short' })}</span>
          <button type="button" aria-label="Next day" disabled={offset === 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} className="grid h-9 w-9 place-items-center rounded-full">
            <Icon name="right" size={18} />
          </button>
        </div>
      }
    >
      <Card className="flex items-center gap-4">
        <Ring name="Protein" value={proteinG} max={profile.proteinTargetG} size={104} label={`${Math.round(proteinG)}g`} sub={`of ${profile.proteinTargetG}g`} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">Calories</span>
              <span className="tabular-nums text-muted">
                {Math.round(kcal)} / {profile.kcalTarget}
              </span>
            </div>
            <Bar value={kcal} max={profile.kcalTarget} />
          </div>
          <p className="text-sm text-muted">
            {proteinG >= profile.proteinTargetG
              ? 'Protein target reached 🎯'
              : `${Math.round(profile.proteinTargetG - proteinG)} g protein to go`}
            {' · '}
            {kcalLeftLabel(kcalLeft)}
          </p>
        </div>
      </Card>

      {MEALS.map((m) => {
        const items = byMeal[m.key]
        const mealProtein = items.reduce((a, l) => a + (foods[l.foodId]?.proteinG ?? 0) * l.portions, 0)
        return (
          <Card key={m.key} className="space-y-1 !p-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <div>
                <h2 className="font-semibold">{m.label}</h2>
                {items.length > 0 && <p className="text-xs text-muted">{g(Math.round(mealProtein * 10) / 10)} g protein</p>}
              </div>
              <Btn size="sm" variant="soft" onClick={() => setAddTo(m.key)} aria-label={`Add food to ${m.label}`}>
                <Icon name="plus" size={16} /> Add
              </Btn>
            </div>
            {items.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-muted">Nothing logged</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((l) => {
                  const f = foods[l.foodId]
                  return (
                    <li key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f?.name ?? 'Unknown food'}</p>
                        <p className="text-xs text-muted">
                          {f ? `${fmtPortions(l.portions)} × ${f.serving} · ${g(Math.round(f.proteinG * l.portions * 10) / 10)} g protein` : ''}
                        </p>
                      </div>
                      <div className="flex items-center rounded-xl bg-surface2">
                        <button type="button" aria-label={`Less ${f?.name ?? 'food'}`} onClick={() => void setFoodPortions(l.id!, l.portions - 0.5)} className="grid h-10 w-10 place-items-center text-muted">
                          <Icon name={l.portions <= 0.5 ? 'trash' : 'minus'} size={16} />
                        </button>
                        <span className="w-8 text-center font-semibold tabular-nums">{fmtPortions(l.portions)}</span>
                        <button type="button" aria-label={`More ${f?.name ?? 'food'}`} onClick={() => void setFoodPortions(l.id!, l.portions + 0.5)} className="grid h-10 w-10 place-items-center text-muted">
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )
      })}

      <FoodSheet meal={addTo} date={date} onClose={() => setAddTo(null)} />
    </Screen>
  )
}

function kcalLeftLabel(left: number) {
  return left >= 0 ? `${Math.round(left)} kcal left` : `${Math.round(-left)} kcal over`
}

function FoodSheet({ meal, date, onClose }: { meal: MealKey | null; date: string; onClose: () => void }) {
  const { profile, toast } = useApp()
  const [q, setQ] = useState('')
  const [portion, setPortion] = useState(1)
  const [custom, setCustom] = useState(false)
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const recent = useLiveQuery(() => db.foodLogs.orderBy('id').reverse().limit(150).toArray(), [])

  const list = useMemo(() => {
    const all = (foods ?? []).filter((f) => !profile.vegetarian || f.veg)
    const needle = q.trim().toLowerCase()
    if (needle) return all.filter((f) => f.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name))
    const counts = new Map<string, number>()
    for (const l of recent ?? []) counts.set(l.foodId, (counts.get(l.foodId) ?? 0) + 1)
    const freq = all.filter((f) => counts.has(f.id)).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, 8)
    const rest = all.filter((f) => !freq.includes(f)).sort((a, b) => a.name.localeCompare(b.name))
    return [...freq, ...rest]
  }, [foods, recent, q, profile.vegetarian])

  const add = async (f: Food) => {
    if (!meal) return
    await addFood(date, meal, f.id, portion)
    toast(`Added ${fmtPortions(portion)} × ${f.name}`)
  }

  const close = () => {
    setQ('')
    setCustom(false)
    onClose()
  }

  return (
    <Sheet open={!!meal} onClose={close} title={`Add to ${MEALS.find((m) => m.key === meal)?.label ?? ''}`}>
      {custom ? (
        <CustomFood
          onCancel={() => setCustom(false)}
          onSave={async (f) => {
            const id = await addCustomFood(f)
            if (meal) await addFood(date, meal, id, portion)
            toast(`Added ${f.name}`)
            setCustom(false)
          }}
        />
      ) : (
        <div className="space-y-3">
          <input aria-label="Search foods" className={inputCls} placeholder="Search roti, dal, paneer…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Portion size">
            <span className="text-sm text-muted">Portions</span>
            {[0.5, 1, 1.5, 2].map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={portion === p}
                onClick={() => setPortion(p)}
                className={`min-h-10 min-w-12 rounded-xl px-3 text-sm font-bold ${portion === p ? 'bg-accent text-accent-fg' : 'bg-surface2 text-muted'}`}
              >
                {fmtPortions(p)}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {list.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => void add(f)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {f.name} {f.custom && <Chip>custom</Chip>}
                    </span>
                    <span className="block text-xs text-muted">
                      {f.serving} · {f.kcal} kcal
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums text-accent">{g(f.proteinG)}g</span>
                    <span className="block text-[10px] uppercase text-muted">protein</span>
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg">
                    <Icon name="plus" size={18} />
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="p-6 text-center text-sm text-muted">No match. Add it as a custom food below.</li>}
          </ul>
          <Btn block variant="soft" onClick={() => setCustom(true)}>
            <Icon name="plus" size={18} /> Add a custom food
          </Btn>
        </div>
      )}
    </Sheet>
  )
}

function CustomFood({ onSave, onCancel }: { onSave: (f: Omit<Food, 'id' | 'custom'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [serving, setServing] = useState('1 serving')
  const [protein, setProtein] = useState<number | undefined>(0)
  const [kcal, setKcal] = useState<number | undefined>(0)
  const valid = name.trim().length > 0 && protein !== undefined && kcal !== undefined
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), serving: serving.trim() || '1 serving', proteinG: protein!, kcal: kcal!, veg: true })
      }}
    >
      <Field label="Food name">
        <input aria-label="Food name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sattu drink" autoFocus />
      </Field>
      <Field label="Serving size">
        <input aria-label="Serving size" className={inputCls} value={serving} onChange={(e) => setServing(e.target.value)} placeholder="1 glass" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Protein (g)">
          <NumInput label="Protein in grams" value={protein} onChange={setProtein} step={1} max={200} />
        </Field>
        <Field label="Calories (kcal)">
          <NumInput label="Calories" value={kcal} onChange={setKcal} step={10} max={3000} decimals={0} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Btn variant="soft" onClick={onCancel}>
          Back
        </Btn>
        <Btn type="submit" disabled={!valid}>
          Save &amp; add
        </Btn>
      </div>
    </form>
  )
}
