import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import { queryClient } from '@/lib/queryClient';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SessionProvider } from '@/contexts/SessionContext';

/**
 * Global providers: server-state cache, theme (light/dark), motion config
 * (auto-honours the OS "reduce motion" setting), auth session, language/
 * direction, and routing. SessionProvider sits inside the router so guards can
 * use navigation.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <LanguageProvider>
            <BrowserRouter>
              <SessionProvider>{children}</SessionProvider>
            </BrowserRouter>
          </LanguageProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
