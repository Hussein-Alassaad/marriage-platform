import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a routed page and shows a readable message
 * instead of a blank screen. Reset per-route by keying it on the pathname.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the console for debugging.
    console.error('Page error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-card border-line bg-surface mx-auto max-w-lg border p-6 [box-shadow:var(--shadow-card),var(--inner-hi)]">
          <h2 className="font-display text-ink text-lg font-semibold">
            Something went wrong on this page
          </h2>
          <p className="text-muted mt-2 text-sm">
            The rest of the app is fine. Try again, or head back home.
          </p>
          <pre className="bg-bg-3 text-danger mt-4 max-h-40 overflow-auto rounded-md p-3 text-xs">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-fg)]"
            >
              Try again
            </button>
            <a
              href="/"
              className="border-line-strong text-ink rounded-md border px-4 py-2 text-sm font-medium"
            >
              Back home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
