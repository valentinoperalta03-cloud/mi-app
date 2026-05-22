import type { CapacitorConfig } from '@capacitor/cli';

const STATUS_BAR_COLOR = '#1A6BC4';

const config: CapacitorConfig = {
  appId: 'com.padelibre.app',
  appName: 'PadeLibre',
  webDir: 'capacitor-dist',
  // Capacitor 8 no tiene clave oficial anti-overscroll; iOS contentInset + MainActivity + CSS en globals.css.
  ios: {
    backgroundColor: STATUS_BAR_COLOR,
    contentInset: 'never',
  },
  android: {
    backgroundColor: STATUS_BAR_COLOR,
  },
  server: {
    url: 'https://www.padelibre.online',
    cleartext: true,
    /** Ruta inicial en la URL remota (Capacitor 8: appStartPath, no errorPath). */
    appStartPath: '/login',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: STATUS_BAR_COLOR,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: STATUS_BAR_COLOR,
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
