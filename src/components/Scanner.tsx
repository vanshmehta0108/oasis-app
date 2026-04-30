"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ImagePlus, ChevronDown } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

interface ScannerProps {
  onScan: (barcode: string) => void;
  onPhoto?: (base64: string) => void;
  onClose?: () => void;
}

// Progressive nudges shown when a scan is taking longer than usual. We
// translate via the i18n table at render time — string keys are stable.
//
// Cadence (matches the user-requested rule: at 5s tell them to stop shaking
// and stay steady for 5 seconds):
//   0s  — Line up the barcode / Hold steady
//   3s  — Hold steady (reinforce)
//   5s  — Stop shaking, stay steady, wait 5 seconds  ← new
//   7s  — Try moving closer
//  10s  — Better light helps
const NUDGE_KEYS = [
  { atMs: 0,     line1: "scan_nudge_0_line1",  line2: "scan_nudge_0_line2"  },
  { atMs: 3000,  line1: "scan_nudge_3_line1",  line2: "scan_nudge_3_line2"  },
  { atMs: 5000,  line1: "scan_nudge_5_line1",  line2: "scan_nudge_5_line2"  },
  { atMs: 7000,  line1: "scan_nudge_7_line1",  line2: "scan_nudge_7_line2"  },
  { atMs: 10000, line1: "scan_nudge_10_line1", line2: "scan_nudge_10_line2" },
] as const;

export function Scanner({ onScan, onPhoto, onClose }: ScannerProps) {
  const { language } = useLanguage();
  const tr = useMemo(() => (k: Parameters<typeof t>[0]) => t(k, language), [language]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [nudgeIndex, setNudgeIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasScannedRef = useRef(false);
  const autoShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const nativeListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  const stopScanner = useCallback(async () => {
    // Stop the native ML Kit scanner if one is running. Wrapped in try/catch
    // because cleanup happens during unmount when the plugin may already be
    // gone.
    const nativeListener = nativeListenerRef.current;
    nativeListenerRef.current = null;
    if (nativeListener) {
      try {
        await nativeListener.remove();
        const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
        await BarcodeScanner.stopScan();
        document.body.classList.remove("sift-native-scanning");
      } catch {
        /* ignore */
      }
    }

    const scanner = html5QrRef.current;
    html5QrRef.current = null;
    if (scanner) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = scanner as any;
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        // ignore cleanup errors
      }
    }
  }, []);

  // Detect Capacitor native shell at runtime. Safe in SSR — returns false
  // when window is undefined or Capacitor isn't loaded.
  const isNativePlatform = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    return !!w.Capacitor?.isNativePlatform?.();
  }, []);

  useEffect(() => {
    if (!scanning) return;

    const mountedRef = { current: true };
    hasScannedRef.current = false;

    // Native ML Kit path — used when running inside the Capacitor Android /
    // iOS shell. Hardware decoder is faster, more battery-efficient, and
    // works on devices that block the WebView's getUserMedia (e.g. some
    // Indian budget Android skins).
    const startNativeScanner = async (): Promise<boolean> => {
      try {
        const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
        if (!mountedRef.current) return false;

        const supported = await BarcodeScanner.isSupported();
        if (!supported.supported) return false;

        const moduleAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!moduleAvailable.available) {
          // First-launch on Android: pull the on-device ML model. Small
          // (~3MB), one-shot. We continue scanning while it downloads;
          // ML Kit falls back to the bundled lite scanner.
          void BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {});
        }

        const perm = await BarcodeScanner.requestPermissions();
        if (perm.camera !== "granted" && perm.camera !== "limited") {
          setError(tr("scan_camera_permission"));
          return true; // we tried; don't fall back to web in native shell
        }

        // ML Kit's startScan renders the camera in the native layer
        // *behind* the WebView. We hide the WebView's solid background so
        // it shows through.
        document.body.classList.add("sift-native-scanning");

        const listener = await BarcodeScanner.addListener("barcodesScanned", (event) => {
          if (!mountedRef.current || hasScannedRef.current) return;
          const first = event.barcodes?.[0];
          const decodedText = first?.rawValue || first?.displayValue;
          if (!decodedText) return;
          hasScannedRef.current = true;
          haptic("success");
          for (const tm of nudgeTimersRef.current) clearTimeout(tm);
          nudgeTimersRef.current = [];
          setLocked(true);
          onScan(decodedText);
          setScanning(false);
        });
        nativeListenerRef.current = listener;

        await BarcodeScanner.startScan({
          formats: [
            BarcodeFormat.Ean13,
            BarcodeFormat.Ean8,
            BarcodeFormat.UpcA,
            BarcodeFormat.UpcE,
            BarcodeFormat.Code128,
            BarcodeFormat.Code39,
            BarcodeFormat.Itf,
            BarcodeFormat.QrCode,
          ],
        });
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        // Fall through to web scanner on any native error — better to scan
        // via WebView than to fail entirely.
        if (err instanceof Error && err.message.toLowerCase().includes("permission")) {
          setError(tr("scan_camera_permission"));
          return true;
        }
        return false;
      }
    };

    const startScanner = async () => {
      // Try native first if we're in the Capacitor shell. If it returns
      // false (unsupported or hard error), fall back to the web scanner.
      if (isNativePlatform()) {
        const ok = await startNativeScanner();
        if (ok) return;
      }
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mountedRef.current || !scannerRef.current) return;
        if (html5QrRef.current) return;

        const scanner = new Html5Qrcode("oasis-scanner", {
          // Explicitly support all common 1-D barcode formats used on Indian grocery products
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        html5QrRef.current = scanner;

        const w = Math.round(Math.min(window.innerWidth, 420) * 0.78);
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 20,
            qrbox: { width: w, height: Math.round(w * 0.4) },
            aspectRatio: window.innerHeight / window.innerWidth,
          },
          (decodedText) => {
            // Guard against late callbacks after unmount or after a prior scan in this session
            if (!mountedRef.current || hasScannedRef.current) return;
            hasScannedRef.current = true;
            // Cross-platform success haptic (Android: vibrate, iOS: audio tick,
            // Capacitor native: real Taptic engine impact). Feels like a
            // "lock-on" confirmation across all surfaces.
            haptic("success");
            // Stop firing nudges as soon as we've locked.
            for (const tm of nudgeTimersRef.current) clearTimeout(tm);
            nudgeTimersRef.current = [];
            setLocked(true);
            onScan(decodedText);
            setScanning(false);
          },
          () => {
            // ignore per-frame failures
          }
        );
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof Error && err.message.toLowerCase().includes("permission")) {
          setError(tr("scan_camera_permission"));
        } else {
          setError(tr("scan_camera_busy"));
        }
      }
    };

    startScanner();

    // Progressive prompts — fire each NUDGE_KEYS entry on its schedule. A subtle
    // "ping" haptic accompanies each so the user feels something is happening
    // even when the visual nudge is easy to miss.
    nudgeTimersRef.current = NUDGE_KEYS.slice(1).map((nudge, i) =>
      setTimeout(() => {
        if (!mountedRef.current || hasScannedRef.current) return;
        setNudgeIndex(i + 1);
        haptic("ping");
      }, nudge.atMs),
    );

    // After 12 s without a scan, surface the manual entry form automatically
    autoShowTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !hasScannedRef.current) setShowManual(true);
    }, 12000);

    return () => {
      mountedRef.current = false;
      if (autoShowTimerRef.current) clearTimeout(autoShowTimerRef.current);
      for (const tm of nudgeTimersRef.current) clearTimeout(tm);
      nudgeTimersRef.current = [];
      stopScanner();
    };
  }, [scanning, onScan, stopScanner, tr, isNativePlatform]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhoto) return;
    // Reject non-images and oversize files before they reach FileReader.
    // 7MB raw is the server cap; we leave a small headroom for base64
    // expansion (~33%) and bail out client-side so users see a helpful
    // error instead of a 413 from the API.
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Please pick a JPG, PNG, or HEIC photo.");
      return;
    }
    const MAX_BYTES = 7 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB — please pick one under 7MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onPhoto(reader.result);
    };
    reader.onerror = () => {
      setError("Couldn't read that image. Try a different photo.");
    };
    reader.readAsDataURL(file);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] px-6 text-center" role="alert">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
          <Camera size={28} className="text-red-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-oasis-text mb-2">{tr("scan_camera_unavailable")}</h3>
        <p className="text-sm text-oasis-muted leading-relaxed max-w-xs mb-6">{error}</p>
        <div className="w-full max-w-xs">
          <p className="text-xs text-oasis-muted mb-2">{tr("scan_type_barcode")}</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={tr("scan_barcode_placeholder")}
              aria-label={tr("scan_type_barcode")}
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && manualBarcode && onScan(manualBarcode)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-oasis-card border border-oasis-border text-sm text-oasis-text placeholder:text-oasis-muted focus:outline-none focus:border-oasis-green/40"
            />
            <button
              onClick={() => manualBarcode && onScan(manualBarcode)}
              disabled={!manualBarcode}
              className="px-4 py-2.5 rounded-xl bg-oasis-green text-oasis-black font-semibold text-sm disabled:opacity-50"
            >
              {tr("scan_go")}
            </button>
          </div>
        </div>
        <button
          onClick={() => { setError(null); setScanning(true); }}
          className="mt-4 px-6 py-2.5 rounded-full bg-oasis-green text-oasis-black font-semibold text-sm"
        >
          {tr("scan_try_again")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Camera feed — html5-qrcode injects <video> here */}
      <div
        id="oasis-scanner"
        ref={scannerRef}
        className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&>img]:hidden"
      />

      {/* Custom overlay on top */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-black/55" />
        {/* Scan window — punched out visually */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-[88px]">
          <div className="absolute inset-0 bg-transparent ring-[9999px] ring-black/50" />
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br" />
          <div className="absolute left-2 right-2 h-0.5 bg-white/70 scan-line shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        </div>
      </div>

      {/* Instruction text — swaps to a progressive nudge if the scan is
          taking longer than usual. Wrapped in aria-live so screen readers
          announce the new guidance, and a separate hidden region announces
          the lock-on event. */}
      <AnimatePresence mode="wait">
        {scanning && (
          <motion.div
            key={nudgeIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute left-0 right-0 text-center pointer-events-none px-6"
            style={{ top: "calc(50% + 72px)" }}
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-sm text-white/90 font-medium">
              {tr(NUDGE_KEYS[nudgeIndex].line1 as Parameters<typeof t>[0])}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {tr(NUDGE_KEYS[nudgeIndex].line2 as Parameters<typeof t>[0])}
            </p>
            {nudgeIndex >= 3 && (
              <p className="text-[11px] text-white/45 mt-3">{tr("scan_nudge_fallback")}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen-reader-only barcode-locked announcement */}
      <span className="sr-only" role="status" aria-live="assertive">
        {locked ? tr("scan_locked_aria") : ""}
      </span>

      {/* Bottom controls */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-3 px-6"
        style={{ bottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
      >
        {/* Manual entry toggle — shown as last resort */}
        <AnimatePresence>
          {showManual && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-xs overflow-hidden"
            >
              <div className="flex gap-2 pb-1">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={tr("scan_barcode_placeholder")}
                  aria-label={tr("scan_type_barcode")}
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && manualBarcode && onScan(manualBarcode)}
                  autoFocus
                  className="flex-1 px-3 py-2.5 rounded-xl bg-black/70 backdrop-blur border border-white/25 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
                />
                <button
                  onClick={() => manualBarcode && onScan(manualBarcode)}
                  disabled={!manualBarcode}
                  className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-sm disabled:opacity-40"
                >
                  {tr("scan_go")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          {/* Photo of label button */}
          {onPhoto && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-medium"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <ImagePlus size={16} aria-hidden="true" />
              {tr("scan_snap_label")}
            </motion.button>
          )}

          {/* Can't scan? */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowManual((v) => !v)}
            aria-expanded={showManual}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white/70 text-sm"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span>{tr("scan_type_instead")}</span>
            <ChevronDown
              size={14}
              className={`transition-transform ${showManual ? "rotate-180" : ""}`}
            />
          </motion.button>

          {onClose && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <X size={18} className="text-white" />
            </motion.button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
