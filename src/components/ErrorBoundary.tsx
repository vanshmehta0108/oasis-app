"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

// Catches render-time errors anywhere in the React tree and shows a
// human-readable recovery screen instead of a white page. Does NOT
// catch errors in event handlers, async code, or server components —
// those need their own try/catch. Use cases here:
//
// - A component crashes on a subtle null dereference (e.g. upstream
//   API shape changes and we didn't guard it).
// - Hydration mismatch throws.
// - Unhandled promise rejection that React surfaces as a render error.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    // Log once so we still see the error in Vercel logs even though the
    // user gets a recovery screen.
    console.error("[ErrorBoundary]", err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "#F2F2F7" }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "#FFF0EE" }}>
          <span className="text-3xl">😕</span>
        </div>
        <h1 className="text-[18px] font-bold text-black mb-2">Something broke</h1>
        <p className="text-sm max-w-sm mb-6" style={{ color: "#8E8E93" }}>
          We hit an unexpected error. Refreshing usually fixes it. If it keeps happening, the error below will help us debug.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-full text-white font-semibold text-sm"
          style={{ background: "#007AFF" }}
        >
          Reload
        </button>
        {this.state.message && (
          <details className="mt-6 text-xs max-w-sm text-left" style={{ color: "#8E8E93" }}>
            <summary className="cursor-pointer font-medium">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] p-3 rounded-lg bg-white border border-black/[0.06]">
              {this.state.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
