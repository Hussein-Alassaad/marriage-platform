import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { authService } from '@/services/authService';

/**
 * "Continue with Google" — shared by Login and Register (Supabase OAuth creates
 * the account automatically on first sign-in, so there's no separate Google
 * "register" flow). Redirects away from the page entirely on success, so there's
 * nothing to navigate here; only a failure to even START the redirect surfaces
 * an error (e.g. the Google provider not yet enabled in Supabase).
 */
export function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const start = async () => {
    setPending(true);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) {
        onError(error.message);
        setPending(false);
      }
      // On success the browser navigates to Google — nothing left to do here.
    } catch {
      onError(t('auth.unexpectedError'));
      setPending(false);
    }
  };

  return (
    <Button variant="outline" fullWidth type="button" disabled={pending} onClick={start}>
      <GoogleMark className="h-[18px] w-[18px]" />
      {t('auth.continueWithGoogle')}
    </Button>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.98v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.98a9 9 0 0 0 0 8.08l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.96l2.99 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
