/**
 * Error reporting.
 *
 * This is deliberately NOT a Sentry integration. Wiring an SDK we have no account for
 * would produce a file that looks like observability and reports nothing — the worst of
 * both worlds, because it stops anyone from noticing the gap.
 *
 * Instead: errors always reach the console, and if `VITE_ERROR_ENDPOINT` is set they are
 * also POSTed there as plain JSON. Any collector that accepts a POST works, and swapping
 * in a real SDK later means changing this one file.
 *
 * Reporting must never throw. An error in the error reporter is how a page goes blank.
 */

const ENDPOINT = import.meta.env.VITE_ERROR_ENDPOINT as string | undefined;

export interface ErrorContext {
  /** Where it happened — a route, a feature, an action. */
  where?: string;
  [key: string]: unknown;
}

export function captureError(error: unknown, context: ErrorContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error('[mithaq]', message, context, stack);

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
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, { where: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { where: 'unhandledrejection' });
  });
}
