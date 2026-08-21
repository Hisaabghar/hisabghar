import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hisaabghar.ledger',
  appName: 'Ledger',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
