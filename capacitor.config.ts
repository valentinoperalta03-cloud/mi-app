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
    /** Evita conflictos de chrome del sistema en iOS 26+ (iPad). */
    limitsNavigationsToAppBoundDomains: false,
    // DIAGNOSTIC BUILD (iOS 26): sin plugins nativos iOS. Restaurar eliminando includePlugins.
    includePlugins: [],
  },
  android: {
    backgroundColor: STATUS_BAR_COLOR,
  },
  // DIAGNOSTIC BUILD (iOS 26): server deshabilitado para cargar solo capacitor-dist/index.html local.
  // Restaurar descomentando el bloque server y revirtiendo capacitor-dist/index.html.
  // server: {
  //   url: 'https://www.padelibre.online',
  //   cleartext: false,
  //   /** Ruta inicial en la URL remota (Capacitor 8: appStartPath, no errorPath). */
  //   appStartPath: '/login',
  //   allowNavigation: [
  //     'padelibre.online',
  //     '*.padelibre.online',
  //     'www.padelibre.online',
  //     'vercel.app',
  //     '*.vercel.app',
  //   ],
  // },
  // DIAGNOSTIC BUILD (iOS 26): plugins deshabilitados vía ios.includePlugins: [].
  // Restaurar descomentando el bloque plugins.
  // plugins: {
  //   StatusBar: {
  //     overlaysWebView: true,
  //     style: 'LIGHT',
  //     backgroundColor: STATUS_BAR_COLOR,
  //   },
  //   SplashScreen: {
  //     launchShowDuration: 300,
  //     launchAutoHide: true,
  //     backgroundColor: STATUS_BAR_COLOR,
  //     showSpinner: false,
  //   },
  // },
};

export default config;
