import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/i18n';
import '@/index.css';

// Self-hosted fonts (no external CDN calls): Latin + Arabic.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
// Display faces (--font-display, src/index.css): previously fetched render-blocking
// from fonts.googleapis.com — self-hosted here to match the rest of the type system.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';

import { App } from '@/app/App';
import { initTelemetry, installGlobalErrorHandlers } from '@/lib/telemetry';

// Sentry (if VITE_SENTRY_DSN is set) must be initialized before anything else can throw.
initTelemetry();

// Catches what the React error boundary cannot: throws outside the render tree and
// promise rejections nobody awaited.
installGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
