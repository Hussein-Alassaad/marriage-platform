/**
 * Error reporting.
 *
 * Wired to Sentry once `VITE_SENTRY_DSN` is set (2026-07-27) — before that, this
 * deliberately did NOT integrate the SDK: shipping one with no account behind it
 * would have produced a file that looks like observability and reports nothing,
 * which is worse than being honest about the gap. Errors always reach the
 * console regardless; Sentry and/or a generic `VITE_ERROR_ENDPOINT` collector
 * are both optional, additive layers on top of that.
 *
 * Reporting must never throw. An error in the error reporter is how a page goes blank.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENDPOINT = import.meta.env.VITE_ERROR_ENDPOINT as string | undefined;

/** Call once, before rendering (see main.tsx). A no-op with no DSN configured. */
export function initTelemetry(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    // No session replay / performance tracing enabled — this is error reporting
    // only, and adding those is a deliberate later decision, not a default.
    sendDefaultPii: false,
  });
}

export interface ErrorContext {
  /** Where it happened — a route, a feature, an action. */
  where?: string;
  [key: string]: unknown;
}

export function captureError(error: unknown, context: ErrorContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error('[rahma]', message, context, stack);

  if (SENTRY_DSN) {
    Sentry.captureException(error instanceof Error ? error : new Error(message), { extra: context });
  }

  if (!ENDPOINT) return;

  try {
    const payload = JSON.stringify({
      message,
      stack,
      context,
      url: window.location.pathname, // path only — a query string can carry an id
      userAgent: navigator.userAgent,
      at: new Date().toISOString(),
    });
    // keepalive so the report survives the navigation that an error often triggers.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* A failed report must never become a second error. */
    });
  } catch {
    /* Reporting must never throw. */
  }
}

/**
 * Catches what React's error boundary cannot: errors thrown outside the render tree, and
 * promise rejections nobody awaited. Without this, a failing background query is invisible.
 *
 * Sentry's own default integrations already catch these two cases once
 * `initTelemetry()` has configured a DSN, so a window-level error may reach
 * Sentry twice (once here, once via its own global handler) — a harmless,
 * minor duplicate, not worth the fragility of disabling Sentry's default
 * integration to avoid. These listeners stay regardless, because the
 * `VITE_ERROR_ENDPOINT` fallback path needs them even without Sentry configured.
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, { where: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { where: 'unhandledrejection' });
  });
}
