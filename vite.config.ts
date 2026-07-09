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
