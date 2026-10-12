import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

// ───────── Icons (24px stroke icons, hand-picked paths) ─────────
const PATHS = {
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  bowl: 'M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 1-3 2-3M13 8c0-2 1-3 2-3',
  pill: 'M10.5 20.5l-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7zM8.5 8.5l7 7',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M13 4v4M7 10v4M15 16v4',
  play: 'M7 4l13 8-13 8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  video: 'M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3zM17 10l4-2v8l-4-2',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  download: 'M12 4v11M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V5M7 9l5-5 5 5M4 20h16',
  scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  rest: 'M3 18h18M5 18v-5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, className, fill }: { name: IconName; size?: number; className?: string; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx('shrink-0', className)}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

// ───────── Layout primitives ─────────
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const base = 'rounded-2xl border border-line bg-surface p-4'
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx(base, 'block w-full text-left', className)}>
        {children}
      </button>
    )
  }
  return <div className={clsx(base, className)}>{children}</div>
}

export function Screen({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28">
      <header className="safe-top flex items-end justify-between gap-3 pb-3 pt-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
}

export function Btn({ variant = 'primary', size = 'md', block, className, type = 'button', ...p }: BtnProps) {
  return (
    <button
      type={type}
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-12 px-4 text-base',
        size === 'lg' && 'min-h-14 px-5 text-lg',
        block && 'w-full',
        variant === 'primary' && 'bg-accent text-accent-fg',
        variant === 'soft' && 'bg-surface2 text-ink',
        variant === 'ghost' && 'text-muted hover:text-ink',
        variant === 'danger' && 'bg-bad/15 text-bad',
        className,
      )}
    />
  )
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'neutral' && 'bg-surface2 text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'warn' && 'bg-warn-soft text-warn',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Banner({ tone = 'accent', icon, title, children, action }: { tone?: 'accent' | 'warn'; icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={clsx('flex items-start gap-3 rounded-2xl p-4', tone === 'accent' ? 'bg-accent-soft' : 'bg-warn-soft')}>
      {icon && <Icon name={icon} className={clsx('mt-0.5', tone === 'accent' ? 'text-accent' : 'text-warn')} />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-sm text-muted">{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  )
}

// ───────── Controls ─────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full', checked ? 'bg-accent' : 'bg-line')}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export const inputCls =
  'min-h-12 w-full rounded-xl border border-line bg-surface2 px-3 text-base placeholder:text-muted/70 focus:border-accent focus:outline-none'

/** Number input with +/- buttons. Commits on every valid keystroke; empty = undefined. */
export function NumInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
  label,
  decimals = 1,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  label: string
  decimals?: number
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value === undefined ? '' : String(value))
  }, [value])

  const clamp = (n: number) => Math.min(max, Math.max(min, Number(n.toFixed(decimals))))
  const bump = (dir: 1 | -1) => {
    const next = clamp((value ?? 0) + dir * step)
    onChange(next)
    setText(String(next))
  }
  return (
    <div className="flex items-center rounded-xl bg-surface2">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-1)} className="grid h-11 w-10 place-items-center text-muted">
        <Icon name="minus" size={18} />
      </button>
      <div className="min-w-0 flex-1 py-1">
        <input
          aria-label={label}
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            focused.current = true
            e.currentTarget.select()
          }}
          onBlur={() => {
            focused.current = false
            setText(value === undefined ? '' : String(value))
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.')
            if (!/^\d*\.?\d*$/.test(raw)) return
            setText(raw)
            if (raw === '' || raw === '.') return onChange(undefined)
            const n = parseFloat(raw)
            if (!Number.isNaN(n)) onChange(Math.min(max, n))
          }}
          className={clsx("w-full bg-transparent text-center text-lg font-semibold tabular-nums focus:outline-none", unit ? "h-7" : "h-9")}
        />
        {unit && <span className="pointer-events-none block truncate text-center text-[10px] uppercase leading-none text-muted">{unit}</span>}
      </div>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(1)} className="grid h-11 w-10 place-items-center text-muted">
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}

// ───────── Progress visuals ─────────
export function Ring({ value, max, size = 96, stroke = 10, label, sub, name }: { value: number; max: number; size?: number; stroke?: number; label: string; sub?: string; name: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${name}: ${Math.round(value)} of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
        />
      </svg>
      <div className="absolute text-center leading-tight">
        <div className="text-xl font-bold tabular-nums">{label}</div>
        {sub && <div className="text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  )
}

export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={clsx('h-2 overflow-hidden rounded-full bg-line', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  )
}

// ───────── Bottom sheet ─────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-bg shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <SheetHandle onClose={onClose} title={title} />
            <div className="overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function SheetHandle({ onClose, title }: { onClose: () => void; title?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
      <div className="mx-auto absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
      <h2 className="mt-2 min-w-0 truncate text-lg font-bold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted">
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {body && <p className="mb-5 text-muted">{body}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Btn variant="soft" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Btn>
      </div>
    </Sheet>
  )
}

export function Splash() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" role="status" aria-label="Loading" />
    </div>
  )
}
