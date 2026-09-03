import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hosteleaze.app',
  appName: 'HostelEaze',
  webDir: 'public',
  server: {
    url: 'https://www.hosteleaze.com'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '729813273338-btdk8vrja4u1eqmba6hdi3cicp0d4n4h.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
