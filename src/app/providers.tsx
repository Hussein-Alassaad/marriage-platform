import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import { queryClient } from '@/lib/queryClient';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

/**
 * Global providers: server-state cache, theme (light/dark), motion config
 * (auto-honours the OS "reduce motion" setting for every Framer animation),
 * language/direction, and routing.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <LanguageProvider>
            <BrowserRouter>{children}</BrowserRouter>
          </LanguageProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
