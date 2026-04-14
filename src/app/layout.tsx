import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/lib/useToast";
import { ToastContainer } from "@/components/Toast";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f0d",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Oasis — Know What's Really in Your Food | India's AI Product Safety App",
  description:
    "Scan any product to know what's really in it. Oasis is India's AI-powered food safety app and ingredient scanner. Get instant safety scores, FSSAI compliance checks, and healthier alternatives for 1000+ Indian products.",
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
    "oasis app",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://oasis.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Oasis — Know What's Really in Your Food",
    description:
      "India's AI-powered product safety scanner. Scan any barcode or ingredient list to get instant safety scores and healthier alternatives.",
    type: "website",
    url: "https://oasis.app",
    siteName: "Oasis",
    locale: "en_IN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Oasis - India's AI Product Safety App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oasis — Know What's Really in Your Food",
    description:
      "India's AI-powered product safety scanner. Instant safety scores for 1000+ Indian products.",
    images: ["/og-image.png"],
    creator: "@oaborea",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oasis",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Oasis",
  description:
    "India's AI-powered product safety scanner. Scan any barcode or ingredient list to get instant safety scores, FSSAI compliance checks, and healthier alternatives.",
  url: "https://oasis.app",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "1200",
    bestRating: "5",
  },
  author: {
    "@type": "Organization",
    name: "Oasis Health",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh bg-oasis-black text-oasis-text antialiased">
        <ServiceWorkerRegistration />
        <ToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-oasis-green focus:text-oasis-black focus:rounded-lg focus:text-sm focus:font-semibold"
          >
            Skip to main content
          </a>
          <OfflineBanner />
          <ToastContainer />
          <main id="main-content" className="pb-20">{children}</main>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
