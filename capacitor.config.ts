// Capacitor config — wraps the Sift Next.js app in a native Android (and
// later iOS) shell. This file alone is not enough to ship — see
// docs/CAPACITOR.md for the install + build sequence.
//
// Once installed, Capacitor sync uses webDir (a static export) or the live
// production URL depending on which mode you want to ship. We default to
// the production URL so the native app gets fresh content without a
// rebuild for non-native changes.

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.sift.india",
  appName: "Sift",
  // Pointing webDir at out/ assumes you've run `next export` first; if
  // unset, Capacitor expects a `dist/` directory, which next doesn't
  // produce. Override with --static-build if you need an offline build.
  webDir: "out",
  server: {
    // Live-server mode: native app loads the production URL directly.
    // Comment this out and ship the static webDir for fully offline builds.
    url: "https://sift-india.vercel.app",
    cleartext: false,
    // Allow Supabase (auth callbacks) and other allowlisted hosts.
    allowNavigation: [
      "*.vercel.app",
      "wcdtiyrdmhsxkxtxlgsr.supabase.co",
      "accounts.google.com",
      "www.googleapis.com",
    ],
  },
  android: {
    backgroundColor: "#F2F2F7",
  },
  ios: {
    backgroundColor: "#F2F2F7",
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#F2F2F7",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    BarcodeScanner: {
      // @capacitor-mlkit/barcode-scanning — replaces html5-qrcode in the
      // native shell. Requires installing the plugin (see docs/CAPACITOR.md).
    },
    Camera: {
      // For the label-photo flow — gives the native picker access. Replaces
      // <input type="file" capture="environment"> which is unreliable on
      // some Android devices.
    },
  },
};

export default config;
