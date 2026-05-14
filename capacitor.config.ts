type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: { url?: string; cleartext?: boolean };
};

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
