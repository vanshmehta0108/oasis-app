import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentryScrub";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || "development",

  tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.1 : 1.0,

  // PII off by default; further scrubbed via beforeSend in case our own
  // logging strings leak emails/secrets into exception messages.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: (bc) => {
    if (bc.message) bc.message = bc.message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
    return bc;
  },

  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
});
