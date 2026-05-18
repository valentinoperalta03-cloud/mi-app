import type { CapacitorConfig } from '@capacitor/cli';

const STATUS_BAR_COLOR = '#1A6BC4';

const config: CapacitorConfig = {
  appId: 'com.padelibre.app',
  appName: 'PadeLibre',
  webDir: 'capacitor-dist',
  ios: {
    backgroundColor: STATUS_BAR_COLOR,
  },
  server: {
    url: 'https://www.padelibre.online',
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: STATUS_BAR_COLOR,
    },
  },
};

export default config;
