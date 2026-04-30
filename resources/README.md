# Capacitor asset sources

This directory feeds `@capacitor/assets` (run via `npm run cap:assets`),
which generates every Android (and later iOS) icon and splash size from
these source images.

## What's required

| File                  | Required size     | Status     |
| --------------------- | ----------------- | ---------- |
| `icon-only.png`       | 1024×1024         | ⚠️ 512×512 placeholder, regenerate at 1024+ |
| `icon-foreground.png` | 1024×1024         | ⚠️ 512×512 placeholder, regenerate at 1024+ |
| `splash.png`          | 2732×2732         | ⚠️ 512×512 placeholder, regenerate at 2732 |
| `splash-dark.png`     | 2732×2732         | ⚠️ 512×512 placeholder, regenerate at 2732 |

The 512×512 placeholders we ship are the same source as
`public/icons/icon-512.png`. Capacitor's asset generator will up-scale
them, but Play Store reviewers will flag fuzzy icons. Replace before the
real listing goes live.

## Regenerating

After dropping in higher-res source images, run:

```sh
npm run cap:assets
```

That writes:

- `android/app/src/main/res/mipmap-*` (legacy + adaptive icons)
- `android/app/src/main/res/drawable-*` (splash)
- (When iOS is added) `ios/App/App/Assets.xcassets/*`

## Design rules

- **icon-only.png** — the Sift mark on a transparent or solid background.
  Used for legacy launcher icons.
- **icon-foreground.png** — the foreground layer for adaptive icons.
  Keep the meaningful art inside the inner 66% (devices crop the outer
  edges into circle / squircle / teardrop shapes). Background is
  generated from `--iconBackgroundColor` in the npm script (`#F2F2F7`).
- **splash.png** — square; the visible content lives in the inner 1024px
  square. Edges get cropped on tall devices.
- **splash-dark.png** — same constraints; shown when the device is in
  dark mode.

If you only have one version of the splash, copy `splash.png` to
`splash-dark.png` — Capacitor errors if dark variant is missing.
