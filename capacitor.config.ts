import type { CapacitorConfig } from '@capacitor/cli'

// The Android app opens the live website, so it always has the latest version
// without reinstalling; the website's service worker keeps it working offline.
const config: CapacitorConfig = {
  appId: 'com.hisaabghar.ledger',
  appName: 'Mera Khata',
  webDir: 'dist',
  server: {
    url: 'https://mera-khata-30f9b.web.app',
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#0F766E',
    },
  },
}

export default config
