import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { db, exportAll, importAll, patchNotif, patchProfile, resetAll, validateBackup, ensureSeeded, type BackupFile } from '../db/db'
import { useApp } from '../hooks/app'
import { changeLevel } from '../db/ops'
import { Btn, Card, Confirm, Field, Icon, inputCls, NumInput, Screen, SectionTitle, Segmented, Toggle } from '../components/ui'
import { DAY_KEYS, TEMPLATES } from '../data/templates'
import { WEEKDAYS_LONG } from '../engine/dateEngine'
import { LEVELS, LEVEL_LABEL, type DayKey, type Level, type NotifPrefs } from '../types'
import { permissionState, requestPermission, showNotification } from '../lib/notify'
import { useInstall } from '../lib/install'

const ORDER = [1, 2, 3, 4, 5, 6, 0]

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const { profile, today, tz, schedule, toast } = useApp()
  const n = profile.notif
  const nav = useNavigate()
  const install = useInstall()
  const [perm, setPerm] = useState(permissionState())
  const [levelTarget, setLevelTarget] = useState<Level | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const setN = (p: Partial<NotifPrefs>) => void patchNotif(p)

  const enableNotifications = async (on: boolean) => {
    if (!on) return setN({ enabled: false })
    const res = await requestPermission()
    setPerm(res)
    if (res === 'granted') {
      setN({ enabled: true })
      toast('Reminders on 🔔')
    } else if (res === 'unsupported') {
      toast("This browser doesn't support notifications")
    } else {
      toast('Notifications are blocked. Allow them for this app in your phone/browser settings.')
    }
  }

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fittrack-backup-${today}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Backup downloaded')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateBackup(parsed)) throw new Error('bad')
      setPendingImport(parsed)
    } catch {
      toast("That file isn't a FitTrack backup")
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Screen title="Settings" subtitle={`${tz} · day starts at ${String(profile.dayBoundaryHour).padStart(2, '0')}:00`}>
      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-4">
        <Field label="Name">
          <input aria-label="Name" className={inputCls} value={profile.name} onChange={(e) => void patchProfile({ name: e.target.value })} placeholder="Your name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)">
            <NumInput label="Height in centimetres" value={profile.heightCm} onChange={(v) => v && void patchProfile({ heightCm: v })} min={100} max={230} step={1} decimals={0} />
          </Field>
          <Field label="Goal weight (kg)">
            <NumInput label="Goal weight in kilograms" value={profile.goalKg} onChange={(v) => v && void patchProfile({ goalKg: v })} min={30} max={200} step={0.5} />
          </Field>
          <Field label="Protein target (g)">
            <NumInput label="Protein target in grams" value={profile.proteinTargetG} onChange={(v) => v && void patchProfile({ proteinTargetG: v })} min={20} max={300} step={5} decimals={0} />
          </Field>
          <Field label="Calorie target">
            <NumInput label="Calorie target" value={profile.kcalTarget} onChange={(v) => v && void patchProfile({ kcalTarget: v })} min={800} max={5000} step={50} decimals={0} />
          </Field>
        </div>
        <Row title="Vegetarian" hint="Hides egg items from the food list">
          <Toggle label="Vegetarian" checked={profile.vegetarian} onChange={(v) => void patchProfile({ vegetarian: v })} />
        </Row>
      </Card>

      <SectionTitle>Training</SectionTitle>
      <Card className="space-y-4">
        <Field label="Level" hint="You level up automatically when you're consistent. Changing it here restarts the evaluation period.">
          <Segmented label="Level" value={profile.level} onChange={(l) => l !== profile.level && setLevelTarget(l)} options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l].slice(0, 5) === 'Inter' ? 'Inter.' : LEVEL_LABEL[l] }))} />
        </Field>
        <Field label="Weekly schedule">
          <div className="space-y-2">
            {ORDER.map((wd) => (
              <div key={wd} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted">{WEEKDAYS_LONG[wd]}</span>
                <select
                  aria-label={`${WEEKDAYS_LONG[wd]} workout`}
                  className={clsx(inputCls, 'min-h-11 flex-1')}
                  value={schedule[wd]}
                  onChange={(e) => void db.schedule.put({ weekday: wd, dayKey: e.target.value as DayKey })}
                >
                  {DAY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {TEMPLATES[k].name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Field>
        <Field label="New day starts at" hint="Late-night sessions before this hour count towards the previous day.">
          <select aria-label="Day boundary hour" className={inputCls} value={profile.dayBoundaryHour} onChange={(e) => void patchProfile({ dayBoundaryHour: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00{h === 4 ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card className="divide-y divide-line !py-1">
        <Row title="Notifications" hint={perm === 'denied' ? 'Blocked - allow notifications for this app in your phone settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Workout, supplements, meals, weigh-ins'}>
          <Toggle label="Notifications" checked={n.enabled && perm === 'granted'} onChange={(v) => void enableNotifications(v)} />
        </Row>
        <div className={clsx('divide-y divide-line', !n.enabled && 'opacity-50')}>
          <TimeRow title="Workout" on={n.gym} time={n.gymTime} onOn={(v) => setN({ gym: v })} onTime={(t) => setN({ gymTime: t })} />
          <Row title="Supplements" hint="Time is set per supplement">
            <Toggle label="Supplement reminders" checked={n.supplements} onChange={(v) => setN({ supplements: v })} />
          </Row>
          <TimeRow title="Log your meals" hint="If nothing is logged by then" on={n.meals} time={n.mealsTime} onOn={(v) => setN({ meals: v })} onTime={(t) => setN({ mealsTime: t })} />
          <TimeRow title="Protein check" hint="If under 60% of target" on={n.protein} time={n.proteinTime} onOn={(v) => setN({ protein: v })} onTime={(t) => setN({ proteinTime: t })} />
          <TimeRow title="Weigh-in" hint={`Asked when ${n.weighInEveryDays}+ days since the last one`} on={n.weighIn} time={n.weighInTime} onOn={(v) => setN({ weighIn: v })} onTime={(t) => setN({ weighInTime: t })} />
          <Row title="Weigh-in every" hint="days">
            <div className="w-36">
              <NumInput label="Days between weigh-ins" value={n.weighInEveryDays} onChange={(v) => v && setN({ weighInEveryDays: Math.round(v) })} min={1} max={30} decimals={0} />
            </div>
          </Row>
          <Row title="Waist measurement" hint={`Asked every ${n.waistEveryDays} days`}>
            <Toggle label="Waist reminders" checked={n.waist} onChange={(v) => setN({ waist: v })} />
          </Row>
          <Row title="Waist every" hint="days">
            <div className="w-36">
              <NumInput label="Days between waist measurements" value={n.waistEveryDays} onChange={(v) => v && setN({ waistEveryDays: Math.round(v) })} min={1} max={60} decimals={0} />
            </div>
          </Row>
        </div>
      </Card>
      <p className="px-1 text-xs text-muted">
        Notifications are delivered while FitTrack is running on your phone (open or recently in the background). Anything pending always appears at the top of Today when you open the app, so nothing is missed.
      </p>
      <Btn
        variant="soft"
        block
        onClick={async () => {
          const ok = await showNotification({ title: 'FitTrack test', body: 'Reminders are working 🎉', route: '/', tag: `test-${Date.now()}` })
          toast(ok ? 'Test notification sent' : perm === 'granted' ? 'Could not show a notification' : 'Turn on notifications first')
        }}
      >
        <Icon name="bell" size={18} /> Send a test notification
      </Btn>

      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Segmented
          label="Theme"
          value={profile.theme}
          onChange={(t) => void patchProfile({ theme: t })}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
        />
      </Card>

      <SectionTitle>Install on your phone</SectionTitle>
      <Card className="space-y-3">
        {install.installed ? (
          <p className="flex items-center gap-2 text-sm">
            <Icon name="check" className="text-accent" /> Installed. You're running FitTrack as an app.
          </p>
        ) : install.canPrompt ? (
          <Btn block onClick={() => void install.prompt()}>
            <Icon name="download" size={18} /> Install FitTrack
          </Btn>
        ) : install.ios ? (
          <p className="text-sm text-muted">On iPhone: tap the Share button in Safari, then <b>Add to Home Screen</b>.</p>
        ) : (
          <p className="text-sm text-muted">On Android: open the browser menu (⋮) and choose <b>Install app</b> / <b>Add to Home screen</b>.</p>
        )}
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Everything is stored only on this device. {persisted === false && 'The browser may clear it if storage runs low, so back up regularly.'}</p>
        <div className="grid grid-cols-2 gap-3">
          <Btn variant="soft" onClick={() => void doExport()}>
            <Icon name="download" size={18} /> Export
          </Btn>
          <Btn variant="soft" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> Import
          </Btn>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Import backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Btn variant="danger" block onClick={() => setResetOpen(true)}>
          <Icon name="trash" size={18} /> Erase all data
        </Btn>
      </Card>

      <p className="pb-2 text-center text-xs text-muted">FitTrack · keep showing up 💪</p>

      <Confirm
        open={!!levelTarget}
        title={`Switch to ${levelTarget ? LEVEL_LABEL[levelTarget] : ''}?`}
        body="Your workouts change to that level's exercises and volume, and the evaluation period restarts today."
        confirmLabel="Switch level"
        onCancel={() => setLevelTarget(null)}
        onConfirm={async () => {
          if (levelTarget) await changeLevel(profile.level, levelTarget, today, 'Changed manually')
          setLevelTarget(null)
          toast('Level updated')
        }}
      />
      <Confirm
        open={!!pendingImport}
        danger
        title="Replace all data with this backup?"
        body={pendingImport ? `Backup from ${new Date(pendingImport.exportedAt).toLocaleString()}. Your current data on this device will be overwritten.` : ''}
        confirmLabel="Restore"
        onCancel={() => setPendingImport(null)}
        onConfirm={async () => {
          if (pendingImport) {
            try {
              await importAll(pendingImport)
              toast('Backup restored ✓')
            } catch {
              toast('Restore failed. Your data was not changed.')
            }
          }
          setPendingImport(null)
        }}
      />
      <Confirm
        open={resetOpen}
        danger
        title="Erase everything?"
        body="All workouts, food logs, supplements and measurements on this device will be deleted. Export a backup first if you might want them."
        confirmLabel="Erase all"
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await resetAll()
          await ensureSeeded(today, tz)
          setResetOpen(false)
          nav('/', { replace: true })
        }}
      />
    </Screen>
  )
}

function TimeRow({ title, hint, on, time, onOn, onTime }: { title: string; hint?: string; on: boolean; time: string; onOn: (v: boolean) => void; onTime: (t: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <input aria-label={`${title} time`} type="time" value={time} disabled={!on} onChange={(e) => e.target.value && onTime(e.target.value)} className="min-h-10 rounded-lg bg-surface2 px-2 text-sm disabled:opacity-40" />
        <Toggle label={`${title} reminder`} checked={on} onChange={onOn} />
      </div>
    </div>
  )
}
