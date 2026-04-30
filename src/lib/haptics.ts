// Cross-platform haptic feedback.
//
// The Web Vibration API (`navigator.vibrate`) only works on Android Chrome
// and Firefox. iOS Safari has zero vibration support — the call is silently
// ignored. To make scans feel confirmed on iOS too, we layer:
//
//   1. Capacitor native haptics (when running inside the Capacitor shell).
//      Imported lazily so the web bundle isn't bloated.
//   2. Web Vibration API (Android browsers).
//   3. A short, low-volume audio "tick" as a last resort. Generated via
//      WebAudio so we don't ship an asset; volume gated to ~5% so it's
//      perceptible but not intrusive. This is the only signal iOS Safari
//      users actually feel/hear today.
//
// Patterns are tuned for the moments they're called from:
//   - "tap": a single quick tick. Use for button-press style confirmations.
//   - "success": a "did the thing" double-tap.
//   - "error": a longer single buzz that says "something went wrong".
//   - "ping": a soft single tick used for progressive UX prompts.

export type HapticPattern = "tap" | "success" | "error" | "ping";

const VIBRATE: Record<HapticPattern, number | number[]> = {
  tap: 12,
  success: [12, 40, 18],
  error: [25, 50, 25, 50, 80],
  ping: 8,
};

const AUDIO: Record<HapticPattern, { freq: number; durMs: number; volume: number }[]> = {
  tap: [{ freq: 1200, durMs: 18, volume: 0.04 }],
  success: [
    { freq: 1100, durMs: 18, volume: 0.04 },
    { freq: 1500, durMs: 22, volume: 0.05 },
  ],
  error: [
    { freq: 350, durMs: 110, volume: 0.05 },
  ],
  ping: [{ freq: 900, durMs: 12, volume: 0.03 }],
};

let audioCtx: AudioContext | null = null;
let userInteracted = false;
let mutedByUser = false;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  // Lazily construct on first call. If user hasn't interacted yet, the
  // context will start in "suspended" state — calls below will be no-ops
  // (browser policy), which is fine: we'll succeed on the next call after
  // the user taps anything.
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

// Track user interaction so we know audio playback will work. iOS Safari
// requires a same-tick user gesture to start AudioContext. Once any user
// gesture has fired, subsequent haptic() calls within the page lifetime
// can play sound.
function installInteractionTracker() {
  if (typeof window === "undefined" || userInteracted) return;
  const onFirstInteraction = () => {
    userInteracted = true;
    const ctx = audioCtx;
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    window.removeEventListener("touchstart", onFirstInteraction);
    window.removeEventListener("pointerdown", onFirstInteraction);
    window.removeEventListener("keydown", onFirstInteraction);
  };
  window.addEventListener("touchstart", onFirstInteraction, { passive: true, once: true });
  window.addEventListener("pointerdown", onFirstInteraction, { passive: true, once: true });
  window.addEventListener("keydown", onFirstInteraction, { once: true });

  // Respect a saved mute preference.
  try {
    if (window.localStorage.getItem("sift-haptics-muted") === "1") mutedByUser = true;
  } catch { /* private mode / quota — ignore */ }
}

if (typeof window !== "undefined") {
  installInteractionTracker();
}

function playWebAudio(pattern: HapticPattern) {
  const ctx = ensureAudioCtx();
  if (!ctx || ctx.state === "suspended") return;
  const tones = AUDIO[pattern];
  let cursor = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = tone.freq;
    // Short attack/decay envelope so it sounds like a tick, not a beep.
    gain.gain.setValueAtTime(0, cursor);
    gain.gain.linearRampToValueAtTime(tone.volume, cursor + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, cursor + tone.durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(cursor);
    osc.stop(cursor + tone.durMs / 1000 + 0.02);
    cursor += tone.durMs / 1000 + 0.04;
  }
}

function vibrate(pattern: HapticPattern) {
  if (typeof navigator === "undefined") return false;
  // Standard Vibration API — Android only; iOS Safari is a silent no-op.
  if (typeof navigator.vibrate === "function") {
    try {
      return navigator.vibrate(VIBRATE[pattern]);
    } catch {
      return false;
    }
  }
  return false;
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: { Haptics?: { impact: (opts: { style: string }) => Promise<void> } };
  };
}

function tryCapacitorHaptic(pattern: HapticPattern) {
  if (typeof window === "undefined") return false;
  const w = window as unknown as CapacitorWindow;
  if (!w.Capacitor?.isNativePlatform?.()) return false;
  const plugin = w.Capacitor.Plugins?.Haptics;
  if (!plugin?.impact) return false;
  // Map our patterns to iOS-style impact strengths.
  const style = pattern === "error" ? "Heavy" : pattern === "success" ? "Medium" : "Light";
  void plugin.impact({ style }).catch(() => {});
  return true;
}

export function haptic(pattern: HapticPattern = "tap"): void {
  if (typeof window === "undefined") return;
  if (mutedByUser) return;

  // 1. Native (Capacitor on iOS/Android) — best feel, real Taptic engine.
  const nativeFired = tryCapacitorHaptic(pattern);

  // 2. Web Vibration (Android browsers). Always try in addition to native;
  //    Capacitor's bridge already handles native, so vibrate is a no-op
  //    inside the shell.
  const vibrated = vibrate(pattern);

  // 3. Audio fallback for iOS Safari + any browser that ignored the above.
  //    Skip when we already had real haptic feedback.
  if (!nativeFired && !vibrated) {
    playWebAudio(pattern);
  }
}

export function muteHaptics(): void {
  mutedByUser = true;
  try { window.localStorage.setItem("sift-haptics-muted", "1"); } catch {}
}

export function unmuteHaptics(): void {
  mutedByUser = false;
  try { window.localStorage.removeItem("sift-haptics-muted"); } catch {}
}

export function hapticsAreMuted(): boolean {
  return mutedByUser;
}
