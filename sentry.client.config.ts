import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentryScrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || "development",

  // Capture 10% of transactions for performance monitoring in production
  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Capture 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Capture 1% of all sessions for session replay
  replaysSessionSampleRate: 0.01,

  // PII off by default; the replay integration also masks all text.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Don't send events when DSN is not configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
