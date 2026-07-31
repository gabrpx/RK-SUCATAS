import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rksucatas.app',
  appName: 'RK Sucatas',
  webDir: 'dist',

  server: {
    // url: 'https://rk-sucatas-api.onrender.com',  // Remova ou comente para builds de produção
    cleartext: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      statsUrl: "https://api.capgo.app/stats/"
    }
  }
};

export default config;
