export const notificationsSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window

export const permissionState = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported'

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export interface NotifyArgs {
  title: string
  body: string
  route: string
  tag: string
}

/** Shows a system notification (through the service worker, which Android requires). */
export async function showNotification(a: NotifyArgs): Promise<boolean> {
  if (permissionState() !== 'granted') return false
  const opts: NotificationOptions = {
    body: a.body,
    tag: a.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { route: a.route },
  }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await reg.showNotification(a.title, opts)
      return true
    }
    new Notification(a.title, opts)
    return true
  } catch {
    return false
  }
}
