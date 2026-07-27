/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Explicit empty PostCSS config: Tailwind v4 runs through @tailwindcss/vite, so
  // we must NOT let Vite walk up the directory tree and pick up an unrelated
  // PostCSS/Tailwind-v3 config from a parent folder.
  css: {
    postcss: {},
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Route pages are already React.lazy-split (AppRouter.tsx); this splits the
        // remaining single ~967 kB vendor blob so a change to app code doesn't
        // invalidate the browser cache for these rarely-changing libraries, and the
        // heaviest ones (Sentry, motion) aren't on the critical path for first paint.
        //
        // No catch-all bucket: only libraries known to be imported eagerly (from the
        // app shell, not behind a route/lazy() boundary) get named here. A blanket
        // `return 'vendor'` for everything else previously swept `recharts` — which
        // is only ever reached via FinancePage's `lazy(() => import('./FinanceCharts'))`
        // — into the same physical chunk as always-eager utilities like clsx, forcing
        // it to load on every page and undoing that existing code-split. Anything
        // unmatched here falls through to Rollup's own automatic chunking, which is
        // what correctly kept recharts lazy in the first place.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/react-router|\/react\/|\/react-dom\//.test(id)) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('i18next')) return 'vendor-i18n';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (/react-hook-form|@hookform|\/zod\//.test(id)) return 'vendor-forms';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Keep tests hermetic: no Supabase env → the client is null → the session
    // resolves to "unauthenticated" without any network calls.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
});
