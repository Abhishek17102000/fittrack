import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { db, patchNotif, patchProfile } from '../db/db'
import { useApp } from '../hooks/app'
import { Btn, Field, Icon, inputCls, NumInput, Toggle } from '../components/ui'
import { LEVEL_LABEL, type Level } from '../types'
import { requestPermission } from '../lib/notify'
import { saveBody } from '../db/ops'

const LEVEL_INFO: Record<Exclude<Level, 'pro'>, string> = {
  beginner: 'New to the gym, or coming back after a long break.',
  intermediate: 'Training regularly for 6+ months and comfortable with the main lifts.',
  advanced: 'Years of consistent training; you can do pull-ups and squat heavy.',
}

export default function Onboarding() {
  const { profile, today, toast } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)
  const [height, setHeight] = useState<number | undefined>(profile.heightCm)
  const [weight, setWeight] = useState<number | undefined>(profile.weightKg)
  const [goal, setGoal] = useState<number | undefined>(profile.goalKg)
  const [veg, setVeg] = useState(profile.vegetarian)
  const [level, setLevel] = useState<Level>('beginner')
  const [remind, setRemind] = useState(true)
  const [gymTime, setGymTime] = useState(profile.notif.gymTime)
  const [saving, setSaving] = useState(false)

  const profileOk = !!height && height >= 100 && !!weight && weight >= 30 && !!goal && goal >= 30
  const steps = 3

  const finish = async () => {
    if (saving) return
    setSaving(true)
    try {
      // vitamin D (every-N-days) starts counting from today
      const vitd = await db.supplements.get('vitd')
      if (vitd && vitd.schedule.kind === 'everyNDays') await db.supplements.put({ ...vitd, schedule: { ...vitd.schedule, anchor: today } })
      await saveBody(today, { weightKg: weight! })
      await patchNotif({ enabled: false, gymTime })
      // Save everything first: the permission prompt can take as long as the user likes (or never resolve).
      await patchProfile({
        name: name.trim(),
        heightCm: height!,
        weightKg: weight!,
        goalKg: goal!,
        vegetarian: veg,
        level,
        levelSince: today,
        programStart: today,
        onboarded: true,
      })
    } finally {
      setSaving(false)
    }
    if (remind) {
      void requestPermission().then(async (res) => {
        if (res === 'granted') await patchNotif({ enabled: true })
        else toast('Notifications are off. You can turn them on later in Settings.')
      })
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 pb-8 safe-top">
      <div className="flex items-center gap-2 pt-4" aria-label={`Step ${step + 1} of ${steps}`}>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className={clsx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
        ))}
      </div>

      <div className="flex-1 pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.18 }} className="space-y-5">
            {step === 0 && (
              <>
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-accent-fg">
                  <Icon name="dumbbell" size={34} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Welcome to FitTrack</h1>
                  <p className="mt-1 text-muted">Your daily workout, diet and supplements in one place. Everything stays on your phone.</p>
                </div>
                <Field label="What should we call you?">
                  <input aria-label="Your name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" autoComplete="given-name" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Height (cm)">
                    <NumInput label="Height in centimetres" value={height} onChange={setHeight} min={100} max={230} step={1} decimals={0} />
                  </Field>
                  <Field label="Weight (kg)">
                    <NumInput label="Current weight in kilograms" value={weight} onChange={setWeight} min={30} max={300} step={0.5} />
                  </Field>
                  <Field label="Goal (kg)">
                    <NumInput label="Goal weight in kilograms" value={goal} onChange={setGoal} min={30} max={300} step={0.5} />
                  </Field>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
                  <span className="font-medium">I'm vegetarian</span>
                  <Toggle label="Vegetarian" checked={veg} onChange={setVeg} />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Where are you starting?</h1>
                  <p className="mt-1 text-muted">Be honest, it's how you earn the next level. You'll be promoted automatically when you're consistent.</p>
                </div>
                <div className="space-y-3" role="radiogroup" aria-label="Starting level">
                  {(Object.keys(LEVEL_INFO) as (keyof typeof LEVEL_INFO)[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={level === l}
                      onClick={() => setLevel(l)}
                      className={clsx('flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left', level === l ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
                    >
                      <span className={clsx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', level === l ? 'border-accent bg-accent text-accent-fg' : 'border-line')}>{level === l && <Icon name="check" size={14} />}</span>
                      <span>
                        <span className="block text-lg font-bold">{LEVEL_LABEL[l]}</span>
                        <span className="text-sm text-muted">{LEVEL_INFO[l]}</span>
                      </span>
                    </button>
                  ))}
                  <p className="px-1 text-sm text-muted">Pro is unlocked by progressing through Advanced.</p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Stay on track</h1>
                  <p className="mt-1 text-muted">FitTrack reminds you to train, take supplements, log meals and weigh in, and asks for the data it needs.</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon name="bell" size={18} /> Enable reminders
                  </span>
                  <Toggle label="Enable reminders" checked={remind} onChange={setRemind} />
                </div>
                <Field label="When do you usually train?">
                  <input aria-label="Workout reminder time" type="time" className={inputCls} value={gymTime} onChange={(e) => e.target.value && setGymTime(e.target.value)} />
                </Field>
                <p className="text-sm text-muted">Your plan: Mon-Fri gym, Saturday mobility, Sunday rest. You can change this anytime in Settings.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <Btn variant="soft" size="lg" onClick={() => setStep(step - 1)} aria-label="Back">
            <Icon name="left" />
          </Btn>
        )}
        {step < steps - 1 ? (
          <Btn block size="lg" disabled={step === 0 && !profileOk} onClick={() => setStep(step + 1)}>
            Continue <Icon name="right" size={20} />
          </Btn>
        ) : (
          <Btn block size="lg" disabled={saving} onClick={() => void finish()}>
            Let's go <Icon name="check" size={20} />
          </Btn>
        )}
      </div>
    </div>
  )
}
