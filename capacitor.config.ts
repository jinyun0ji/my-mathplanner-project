import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chaesooyong.management',
  appName: '채수용 수학',
  webDir: 'build',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
    hostname: 'localhost',
  },

  ios: {
    isInspectable: true
  }
};

export default config;
