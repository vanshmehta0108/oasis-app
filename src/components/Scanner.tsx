"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ImagePlus, ChevronDown } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => void;
  onPhoto?: (base64: string) => void;
  onClose?: () => void;
}

export function Scanner({ onScan, onPhoto, onClose }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [manualBarcode, setManualBarcode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasScannedRef = useRef(false);
  const autoShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScanner = useCallback(async () => {
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

  useEffect(() => {
    if (!scanning) return;

    const mountedRef = { current: true };
    hasScannedRef.current = false;

    const startScanner = async () => {
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
            // Confident double-tap on lock — feels like a confirmation, not noise.
            if (navigator.vibrate) navigator.vibrate([10, 30, 14]);
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
          setError("We need camera access to scan. Allow it in your browser settings, then try again.");
        } else {
          setError("We couldn't start the camera. Close any other apps using it and try again.");
        }
      }
    };

    startScanner();

    // After 10 s without a scan, surface the manual entry form automatically
    autoShowTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !hasScannedRef.current) setShowManual(true);
    }, 10000);

    return () => {
      mountedRef.current = false;
      if (autoShowTimerRef.current) clearTimeout(autoShowTimerRef.current);
      stopScanner();
    };
  }, [scanning, onScan, stopScanner]);

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
      <div className="flex flex-col items-center justify-center h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
          <Camera size={28} className="text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-oasis-text mb-2">Camera unavailable</h3>
        <p className="text-sm text-oasis-muted leading-relaxed max-w-xs mb-6">{error}</p>
        <div className="w-full max-w-xs">
          <p className="text-xs text-oasis-muted mb-2">Or type the barcode</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Barcode number…"
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
              Go
            </button>
          </div>
        </div>
        <button
          onClick={() => { setError(null); setScanning(true); }}
          className="mt-4 px-6 py-2.5 rounded-full bg-oasis-green text-oasis-black font-semibold text-sm"
        >
          Try again
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

      {/* Instruction text */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 text-center pointer-events-none"
            style={{ top: "calc(50% + 72px)" }}
          >
            <p className="text-sm text-white/85 font-medium">Line up the barcode</p>
            <p className="text-xs text-white/55 mt-1">Hold steady — we&apos;ll do the rest.</p>
          </motion.div>
        )}
      </AnimatePresence>

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
                  placeholder="Type the barcode…"
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
                  Go
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
              <ImagePlus size={16} />
              Snap the label
            </motion.button>
          )}

          {/* Can't scan? */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-white/70 text-sm"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span>Type instead</span>
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
