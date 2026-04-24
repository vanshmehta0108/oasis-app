// Structured logger for API routes.
//
// Emits one JSON line per event so Vercel log drain + any downstream
// log aggregator (Datadog, Axiom, BetterStack, etc.) can parse fields
// without regex. Intentionally minimal — no external dependencies.

type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: Level;
  event: string;
  [key: string]: unknown;
}

function emit(level: Level, event: string, props?: Record<string, unknown>) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, event, ...(props ?? {}) };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (event: string, props?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", event, props);
  },
  info: (event: string, props?: Record<string, unknown>) => emit("info", event, props),
  warn: (event: string, props?: Record<string, unknown>) => emit("warn", event, props),
  error: (event: string, props?: Record<string, unknown>) => emit("error", event, props),
};
