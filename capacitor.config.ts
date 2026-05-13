import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.padelibre.app',
  appName: 'PadeLibre',
  webDir: 'public',
  server: {
    url: 'https://www.padelibre.online',
    cleartext: false
  }
};

export default config;
