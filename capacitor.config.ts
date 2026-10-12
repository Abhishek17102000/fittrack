import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.fittrack.tracker',
  appName: 'FitTrack',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_fittrack', iconColor: '#A3E635' },
  },
}

export default config
