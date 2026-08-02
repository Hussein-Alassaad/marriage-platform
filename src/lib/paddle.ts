/**
 * Loads Paddle.js on demand — only when a member actually opens the card
 * checkout, never on every page load. Paddle's checkout overlay has no
 * self-hosted alternative (unlike this app's fonts/analytics), so this is a
 * deliberate, narrow exception to loading third-party scripts.
 */

interface PaddleCheckoutItem {
  priceId: string;
  quantity: number;
}

interface PaddleCheckoutOpenOptions {
  items: PaddleCheckoutItem[];
  customData?: Record<string, unknown>;
  settings?: { successUrl?: string };
}

interface PaddleGlobal {
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: {
    token: string;
    eventCallback?: (event: { name: string }) => void;
  }) => void;
  Checkout: { open: (opts: PaddleCheckoutOpenOptions) => void };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let loadPromise: Promise<PaddleGlobal> | null = null;

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('paddle-js')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'paddle-js';
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paddle.js'));
    document.head.appendChild(script);
  });
}

/** Loads Paddle.js (if not already loaded) and initializes it once per session. */
export async function getPaddle(
  clientToken: string,
  environment: 'sandbox' | 'production',
): Promise<PaddleGlobal> {
  if (loadPromise) return loadPromise;
  loadPromise = loadScript().then(() => {
    if (!window.Paddle) throw new Error('Paddle.js did not load correctly');
    window.Paddle.Environment.set(environment);
    window.Paddle.Initialize({ token: clientToken });
    return window.Paddle;
  });
  return loadPromise;
}
