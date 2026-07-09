/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import { authService, type AppRole, type Profile } from '@/services/authService';

export interface SessionContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  verificationStatus: Profile['verification_status'] | null;
  hasRole: (...roles: AppRole[]) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const configured = Boolean(getSupabaseClient());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  // If there's no backend configured we are simply unauthenticated — not loading.
  const [isLoading, setIsLoading] = useState(configured);

  const loadProfile = useCallback(async (userId: string) => {
    const { profile: p, roles: r } = await authService.fetchProfileAndRoles(userId);
    setProfile(p);
    setRoles(r);
  }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;

    authService
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (data.session?.user) await loadProfile(data.session.user.id);
      })
      .catch(() => {
        /* offline / not configured — treat as signed out */
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = authService.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((...wanted: AppRole[]) => wanted.some((r) => roles.includes(r)), [roles]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      verificationStatus: profile?.verification_status ?? null,
      hasRole,
      refreshProfile,
      signOut,
    }),
    [session, profile, roles, isLoading, hasRole, refreshProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
