// Small sensory helpers: vibration, beeps and screen wake lock. All of them fail silently where unsupported.

export function vibrate(pattern: number | number[] = 30): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

let audio: AudioContext | undefined

export function beep(freq = 880, ms = 160): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + ms / 1000)
  } catch {
    /* unsupported */
  }
}

export function timerDone(): void {
  vibrate([200, 80, 200])
  beep(988, 140)
  setTimeout(() => beep(1318, 200), 180)
}

type WakeLockSentinelLike = { release: () => Promise<void> }

/** Keeps the screen awake while `active`. Re-acquires after the tab returns to the foreground. */
export function acquireWakeLock(): () => void {
  let sentinel: WakeLockSentinelLike | null = null
  let stopped = false
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }
  const request = async () => {
    if (stopped || !nav.wakeLock || document.visibilityState !== 'visible') return
    try {
      sentinel = await nav.wakeLock.request('screen')
    } catch {
      /* denied (e.g. battery saver) */
    }
  }
  const onVisible = () => void request()
  document.addEventListener('visibilitychange', onVisible)
  void request()
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisible)
    void sentinel?.release().catch(() => undefined)
  }
}
