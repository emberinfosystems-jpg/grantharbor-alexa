import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emberinfo.grantharbor',
  appName: 'GrantHarbor',
  webDir: 'dist-web',
  // CapacitorHttp patches the WebView's fetch/XHR to go through the NATIVE HTTP layer, which is
  // CORS-free — exactly what the Electron main process gave the desktop build. This is what lets
  // the mobile ingestion agent (Discover) hit the public Grants.gov / USAspending APIs directly.
  // Both are HTTPS, so no cleartext/mixed-content allowance is needed.
  plugins: {
    CapacitorHttp: { enabled: true }
  }
};

export default config;
