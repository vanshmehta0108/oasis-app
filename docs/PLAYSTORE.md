# Play Store internal testing — Sift Android

Step-by-step to get the app on real devices via Google Play's internal
testing track. Internal testing is the right starting tier: no Play
review delay, up to 100 testers, you control the email allowlist.

This doc assumes Capacitor is already configured (`capacitor.config.ts`
exists at the repo root). For the architecture overview see
`docs/CAPACITOR.md`.

## What's already automated

The repo ships these npm scripts (added in commit after this doc was
written):

| Command | What it does |
| --- | --- |
| `npm run cap:add:android` | One-time. Runs `npx cap add android`, creates `./android/` Gradle project. |
| `npm run cap:sync` | Copies plugin manifests + web assets into `./android/`. Run after every web change you want to surface in the build. |
| `npm run cap:assets` | Generates every Android icon and splash size from `resources/`. Re-run when you replace those source images. |
| `npm run cap:open:android` | Opens the project in Android Studio for emulator runs / debugging. |
| `npm run android:keystore` | One-time. Generates a signing keystore + Gradle props file. Backs up to `.gitignore` automatically. |
| `npm run android:bundle` | Builds a signed AAB (Android App Bundle) ready to upload to Play Console. |

Plus the Scanner component (`src/components/Scanner.tsx`) detects the
native shell at runtime and uses `@capacitor-mlkit/barcode-scanning`
instead of `html5-qrcode` when it's available. No code change needed
between web and native builds.

## What you do manually (one-time setup)

### 1. Pre-flight

You need:

- macOS / Linux box with Java 17+ (for Gradle).
- [Android Studio](https://developer.android.com/studio) installed (only
  needed if you want to debug in an emulator; not strictly required for
  the AAB build, but the SDK platform tools are useful).
- A [Google Play Console account](https://play.google.com/console)
  (one-time **$25 USD** developer fee).
- 5–10 tester email addresses (Gmail accounts).

### 2. Bootstrap the Android project

```sh
npm run cap:add:android        # creates ./android/
npm run cap:assets             # generates icons + splash
npm run cap:sync               # syncs web assets + plugins
```

After `cap:add:android`, open the new `android/app/src/main/AndroidManifest.xml`
and verify the `android:label` is `Sift` and the launch activity has
`android:exported="true"`. Most defaults are correct.

### 3. Generate the signing keystore (one-time, permanent)

```sh
npm run android:keystore
```

It will prompt for:

- A keystore password.
- A key password (can be the same).
- A "Distinguished Name" (CN, OU, O, L, ST, C). Use real values — the
  CN appears in Play Console.

After generation, the script creates:

- `android/app/sift-release.keystore` — the keystore (gitignored).
- `android/keystore.properties` — Gradle reads this at build time
  (gitignored).

**Back this file up immediately to a password manager + secure cloud
storage.** If you lose it you cannot publish updates to the same Play
Store listing — you'd have to ship a new app under a new appId, and
existing users are orphaned.

### 4. Wire signing into Gradle

Open `android/app/build.gradle` and add the signing configs after
`buildTypes { ... }`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

(One-time. Capacitor's default `build.gradle` doesn't include a release
signing config.)

### 5. Build the AAB

```sh
npm run android:bundle
```

First run takes 2–3 minutes (Gradle downloads the Android toolchain).
Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Typical size: 3–6 MB (the WebView is provided by Android, so we don't
ship one).

### 6. Upload to Play Console

1. Go to https://play.google.com/console → **Create app**.
2. App name **Sift**, default language **English (India)**, **Free**, app
   category **Health & Fitness**.
3. Complete the **App content** sections (privacy policy URL, content
   rating, ads disclosure, target audience). Use
   `https://sift-india.vercel.app/privacy` for the privacy policy.
4. **Internal testing** → **Create new release** → upload the AAB.
5. Add a release name (e.g. `v0.1.0 internal-1`) and release notes.
6. **Testers** tab → create an email list, add 5–10 testers.
7. Copy the **opt-in URL**. Each tester opens that URL on their Android
   phone and clicks Install — bypasses the public Play Store entirely.

### 7. Iterating

For each subsequent build:

```sh
# 1. Bump versionCode in android/app/build.gradle (must increase every release).
# 2. Optionally bump versionName for the human-readable string.
npm run cap:sync           # if you changed web assets
npm run android:bundle     # produces a fresh signed AAB
# 3. Upload AAB → Play Console → Internal testing → Create new release.
```

## Common pitfalls

- **"This app cannot be installed"** on the tester's phone: the email is
  not in the testers list, OR they're using a different Google account
  on their phone than the one on the testers list.
- **App opens to a blank screen on launch**: usually the WebView's CSP
  is blocking something. Check `chrome://inspect` (USB-debug to the
  phone) for the actual error.
- **Camera doesn't work on a specific device**: ML Kit's
  `installGoogleBarcodeScannerModule` triggers a one-time download. If
  the device has no Google Play Services (e.g. a Huawei phone), the
  Scanner component automatically falls back to the html5-qrcode path.
- **Gradle out of memory**: increase the heap in `android/gradle.properties`:
  `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8`.

## What's NOT in this doc

- iOS / TestFlight — separate path. Capacitor supports it, but a Mac
  with Xcode + an Apple Developer Program membership ($99/year) is
  required. Indian market for our segment is ~95% Android.
- Production track on Play Store. Internal testing is enough for the
  first 50–100 users; promote to closed → open testing → production
  once the funnel data is solid and the privacy policy / data safety
  declarations are reviewed by counsel.
