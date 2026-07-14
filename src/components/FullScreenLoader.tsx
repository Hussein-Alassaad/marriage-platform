import { Logo } from './Logo';

/** Centered brand loader shown while the session/guard state resolves. */
export function FullScreenLoader() {
  return (
    <div className="app-backdrop flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo />
      <span
        className="border-line border-t-brand-600 h-6 w-6 animate-spin rounded-full border-2"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
