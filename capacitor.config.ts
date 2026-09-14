import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rksucatas.app',
  appName: 'RK Sucatas',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      statsUrl: 'https://api.capgo.app/stats/',
      appId: 'com.rksucatas.app'
    }
  }
};

export default config;
