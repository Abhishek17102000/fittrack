import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { notificationId, type PlannedReminder } from '../engine/reminderPlan'

/** True inside the Android app (Capacitor), false in a normal browser / installed PWA. */
export const isNative = (): boolean => Capacitor.isNativePlatform()

const CHANNEL = 'reminders'
let perm: NotificationPermission = 'default'

export const nativePermission = (): NotificationPermission => perm

export async function initNative(): Promise<void> {
  if (!isNative()) return
  try {
    const s = await LocalNotifications.checkPermissions()
    perm = s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'default'
  } catch {
    /* plugin unavailable */
  }
}

export async function nativeRequestPermission(): Promise<NotificationPermission> {
  try {
    const s = await LocalNotifications.requestPermissions()
    perm = s.display === 'granted' ? 'granted' : 'denied'
  } catch {
    perm = 'denied'
  }
  return perm
}

async function ensureChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Reminders', description: 'Workout, supplement, meal and weigh-in reminders', importance: 4, vibration: true })
  } catch {
    /* already exists / not Android */
  }
}

export async function nativeShowNow(title: string, body: string, route: string): Promise<boolean> {
  try {
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [{ id: Math.floor(Math.random() * 2e9), title, body, channelId: CHANNEL, smallIcon: 'ic_stat_fittrack', schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }, extra: { route } }],
    })
    return true
  } catch {
    return false
  }
}

const localDate = (date: string, minutes: number): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0)
}

/** Replaces everything scheduled with the given plan (future reminders only). Returns how many were scheduled. */
export async function syncNativeReminders(plan: PlannedReminder[], now = new Date()): Promise<number> {
  await cancelNativeReminders()
  await ensureChannel()
  const items = plan
    .map((r) => ({ r, at: localDate(r.fireDate, r.fireMinutes) }))
    .filter((x) => x.at.getTime() > now.getTime() + 5000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 60) // Android keeps alarms cheap, but stay well below platform limits
  if (!items.length) return 0
  await LocalNotifications.schedule({
    notifications: items.map(({ r, at }) => ({
      id: notificationId(r.id),
      title: r.title,
      body: r.body,
      channelId: CHANNEL,
      smallIcon: 'ic_stat_fittrack',
      schedule: { at, allowWhileIdle: true },
      extra: { route: r.route },
    })),
  })
  return items.length
}

export async function cancelNativeReminders(): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) })
  } catch {
    /* nothing pending / unsupported */
  }
}

/** Calls `cb(route)` when the user taps a reminder. Returns an unsubscribe function. */
export function onNativeTap(cb: (route: string) => void): () => void {
  if (!isNative()) return () => undefined
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const route = (e.notification.extra as { route?: string } | undefined)?.route
    if (route) cb(route)
  })
  return () => void handle.then((h) => h.remove())
}
