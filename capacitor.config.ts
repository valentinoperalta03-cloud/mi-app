import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.padelibre.app',
  appName: 'PadeLibre',
  webDir: 'capacitor-dist',
  ios: {
    minVersion: '16.0'
  },
  server: {
    url: 'https://www.padelibre.online',
    cleartext: true
  }
};

export default config;
