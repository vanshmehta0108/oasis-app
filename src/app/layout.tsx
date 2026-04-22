import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/lib/useToast";
import { ToastContainer } from "@/components/Toast";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F2F2F7",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Sift — Know What's Really in Your Food | India's AI Product Safety App",
  description:
    "Scan any product to know what's really in it. Sift is India's AI-powered food safety app and ingredient scanner. Get instant safety scores, FSSAI compliance checks, and healthier alternatives for 1000+ Indian products.",
  keywords: [
    "food safety app India",
    "ingredient scanner",
    "product safety score",
    "FSSAI checker",
    "food label scanner India",
    "AI food analysis",
    "healthy food India",
    "barcode scanner food",
    "ingredient safety check",
    "sift app",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://sift.app"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sift — Know What's Really in Your Food",
    description:
      "India's AI-powered product safety scanner. Scan any barcode or ingredient list to get instant safety scores and healthier alternatives.",
    type: "website",
    url: "https://sift.app",
    siteName: "Sift",
    locale: "en_IN",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sift - India's AI Product Safety App" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sift — Know What's Really in Your Food",
    description: "India's AI-powered product safety scanner. Instant safety scores for 1000+ Indian products.",
    images: ["/og-image.png"],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sift" },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sift",
  description: "India's AI-powered product safety scanner.",
  url: "https://sift.app",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "1200", bestRating: "5" },
  author: { "@type": "Organization", name: "Sift Health" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-dvh bg-sift-bg text-sift-label antialiased">
        <ServiceWorkerRegistration />
        <ToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-sift-blue focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
          >
            Skip to main content
          </a>
          <OfflineBanner />
          <ToastContainer />
          <main id="main-content" className="pb-20">{children}</main>
          <BottomNav />
          <SpeedInsights />
          <Analytics />
        </ToastProvider>
      </body>
    </html>
  );
}
