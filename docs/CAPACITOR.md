# Capacitor — wrapping Sift for Android (and iOS later)

Goal: ship the Sift web app to Google Play Store internal testing in 1–2 weeks. iOS later (the Indian market is Android-dominant for our segment, and iOS App Store review for thin webview wrappers is harsher).

## What's already in place

- `capacitor.config.ts` — app id, name, server URL, allowlist, plugin scaffolding.
- The web app is mobile-first and PWA-friendly already; no UI rewrite needed for the wrapper.

## What you need to do (manually — these are not automated)

### 1. Install Capacitor + plugins

```sh
npm install @capacitor/core @capacitor/cli @capacitor/android \
            @capacitor/camera @capacitor/splash-screen \
            @capacitor-mlkit/barcode-scanning
npx cap init  # Confirms appId/appName from capacitor.config.ts
npx cap add android
```

For iOS later (requires a Mac + Xcode):

```sh
npm install @capacitor/ios
npx cap add ios
```

### 2. Replace `html5-qrcode` with the native scanner

The current `src/components/Scanner.tsx` uses `html5-qrcode` for camera access. On Android Chrome it's flaky (focus issues, slow on older devices) and the App Store rejects PWAs with no native functionality. Use `@capacitor-mlkit/barcode-scanning` when running natively, fall back to html5-qrcode in the browser.

Sketch:

```ts
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

if (Capacitor.isNativePlatform()) {
  const result = await BarcodeScanner.scan();
  // result.barcodes[0].rawValue
} else {
  // existing html5-qrcode path
}
```

The native scanner needs `<uses-permission android:name="android.permission.CAMERA" />` in `android/app/src/main/AndroidManifest.xml`. Capacitor + the plugin add this automatically.

### 3. Replace the file-picker for label photos

`src/app/add/page.tsx` uses `<input type="file" capture="environment">`. On native, swap to `@capacitor/camera`:

```ts
import { Camera, CameraResultType } from "@capacitor/camera";

const photo = await Camera.getPhoto({
  resultType: CameraResultType.Base64,
  quality: 80,
});
// photo.base64String
```

### 4. App icons + splash

Generate via `@capacitor/assets`:

```sh
npm install --save-dev @capacitor/assets
# Place a 1024×1024 logo at resources/icon.png and 2732×2732 splash at resources/splash.png
npx capacitor-assets generate
```

### 5. Build + run on Android

```sh
npm run build
npx cap sync android
npx cap open android   # Opens Android Studio
```

Hit Run in Android Studio. First device run takes ~5 min; subsequent ~30 sec.

### 6. Sign the release APK / AAB

You need a Google Play developer account ($25 one-time) and a signing key:

```sh
keytool -genkey -v -keystore sift-release.keystore -alias sift-release -keyalg RSA -keysize 2048 -validity 10000
```

Add the keystore to `android/app/build.gradle` and gitignore the `.keystore` file. Generate the AAB via Android Studio → Build → Generate Signed Bundle.

### 7. Submit to Internal Testing

- Play Console → Create app → fill metadata
- Upload the AAB to Internal Testing track
- Add 5–10 testers by email
- Roll out — testers get the install link in ~30 minutes

## CORS implications

`src/lib/cors.ts` already allows `capacitor://localhost` (the origin native webviews use). No extra changes needed.

## Server-URL mode vs static-export mode

`capacitor.config.ts` currently uses `server.url = "https://sift-india.vercel.app"` so the native app always shows the latest production. Trade-offs:

| Mode | Pro | Con |
|------|-----|-----|
| **Server URL** (current) | Native app updates instantly with web deploys; smaller APK. | Requires network on every launch. |
| **Static export** (`webDir: out`) | Works offline. | Native app must be re-released on every UI change. |

Recommendation: start with server URL for the closed beta. Switch to static export only if reviewers complain about offline behavior or you ship a v1.0.

## Known caveats

- **iOS App Store review**: Apple has rejected pure-webview apps with no native code as recently as 2024. Including the native barcode scanner (above) gives you a clean answer to "what does this app do that a web page doesn't?". Plan for a 1–2 round review.
- **Push notifications**: Capacitor supports them but it's a separate plugin (`@capacitor/push-notifications`). Skip for v1.
- **Deep links**: handle Sift share links (`https://sift-india.vercel.app/product/...`) inside the app via Android App Links — set up `assetlinks.json` on the live site once you're past internal testing.

## Estimated timeline

- Day 1–2: Install + first native build runs locally.
- Day 3–5: Native scanner integration + permissions hardening.
- Day 6–7: Icons, splash, app metadata, screenshots.
- Day 8–10: Sign keystore, generate AAB, upload to Play internal testing, recruit 5 testers.
- Day 11–14: Iterate on tester feedback, bug-fix sprint.

After internal testing is stable for ~2 weeks, promote to closed testing (up to 1000 users), then open testing, then production.
