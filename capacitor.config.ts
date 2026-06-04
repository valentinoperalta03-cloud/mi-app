import type { CapacitorConfig } from '@capacitor/cli';

const STATUS_BAR_COLOR = '#0585FC';

const config: CapacitorConfig = {
  appId: 'com.padelibre.app',
  appName: 'PadeLibre',
  webDir: 'capacitor-dist',
  // Capacitor 8 no tiene clave oficial anti-overscroll; iOS contentInset + MainActivity + CSS en globals.css.
  ios: {
    backgroundColor: STATUS_BAR_COLOR,
    contentInset: 'never',
    /** Evita conflictos de chrome del sistema en iOS 26+ (iPad). */
    limitsNavigationsToAppBoundDomains: false,
    // OAuth + chrome nativo (StatusBar no crashea al launch; evitar SplashScreen).
      includePlugins: ["@capacitor/app", "@capacitor/browser", "@capacitor/status-bar", "@capacitor/preferences", "@onesignal/capacitor-plugin"],
  },
  android: {
    backgroundColor: STATUS_BAR_COLOR,
  },
  // iOS 26: server.url carga remoto en el bridge al instante y crashea en cold start.
  // Shell local (capacitor-dist/index.html) redirige a /login; allowNavigation mantiene el dominio.
  server: {
    cleartext: false,
    allowNavigation: [
      'padelibre.online',
      '*.padelibre.online',
      'www.padelibre.online',
      'vercel.app',
      '*.vercel.app',
    ],
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: STATUS_BAR_COLOR,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: STATUS_BAR_COLOR,
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
