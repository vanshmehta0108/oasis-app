"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ImagePlus } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => void;
  onPhoto?: (base64: string) => void;
  onClose?: () => void;
}

export function Scanner({ onScan, onPhoto, onClose }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scanner = html5QrRef.current as any;
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // ignore cleanup errors
      }
      html5QrRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !scannerRef.current) return;

        const scanner = new Html5Qrcode("oasis-scanner");
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 120 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onScan(decodedText);
            setScanning(false);
          },
          () => {
            // ignore scan failures
          }
        );
      } catch (err) {
        if (!mounted) return;
        if (err instanceof Error && err.message.includes("Permission")) {
          setError("Camera access denied. Please allow camera permission in your browser settings to scan barcodes.");
        } else {
          setError("Could not start camera. Please make sure no other app is using the camera.");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [scanning, onScan, stopScanner]);

  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhoto) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
          <Camera size={28} className="text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-oasis-text mb-2">Camera Unavailable</h3>
        <p className="text-sm text-oasis-muted leading-relaxed max-w-xs">{error}</p>
        <button
          onClick={() => { setError(null); setScanning(true); }}
          className="mt-6 px-6 py-2.5 rounded-full bg-oasis-green text-oasis-black font-semibold text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100dvh-5rem)] bg-black overflow-hidden">
      {/* Camera feed */}
      <div id="oasis-scanner" ref={scannerRef} className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

      {/* Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Dark overlay with cutout */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Scan area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32">
          {/* Clear cutout */}
          <div className="absolute inset-0 bg-black/0 ring-[9999px] ring-black/50" />

          {/* Corner brackets */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-oasis-green rounded-tl" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-oasis-green rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-oasis-green rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-oasis-green rounded-br" />

          {/* Animated scan line */}
          <div className="absolute left-2 right-2 h-0.5 bg-oasis-green/80 scan-line shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
        </div>
      </div>

      {/* Instructions */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-32 left-0 right-0 text-center pointer-events-none"
          >
            <p className="text-sm text-white/80 font-medium">Point at barcode</p>
            <p className="text-xs text-white/50 mt-1">Hold steady for best results</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
        {onPhoto && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handlePhotoCapture}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/10 text-white text-sm font-medium"
          >
            <ImagePlus size={18} />
            Photo of Label
          </motion.button>
        )}
        {onClose && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </motion.button>
        )}
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
