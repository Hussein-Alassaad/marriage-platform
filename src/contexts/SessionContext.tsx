/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import { authService, type AppRole, type Profile } from '@/services/authService';
import { useSettings } from '@/hooks/useSettings';
import { ROUTES } from '@/app/routes';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

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

  /**
   * The profile carries things the SERVER changes while the member is sitting there: an
   * admin approves their payment (tier), approves their documents (verification), or
   * suspends them. Loading it once at sign-in meant a member who paid kept seeing "Free"
   * until they logged out and back in — the platform had already granted the tier and was
   * simply not telling them.
   *
   * So: re-read it when the tab regains focus (the natural moment — they switched away to
   * pay and came back), and on a slow timer as a floor.
   */
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const refresh = () => void loadProfile(userId);
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(refresh, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(timer);
    };
  }, [session?.user?.id, loadProfile]);

  /**
   * Online/Activity Status (PRD Privacy Controls): a plain "last seen" timestamp on
   * my own row, touched while the tab is visible. Whether anyone else gets to see it
   * is gated entirely by MY OWN `privacy.onlineStatus`/`activityStatus` toggle when
   * it's read back out (matchmaking) — writing the timestamp here is unconditional,
   * same as any other self-editable field; the privacy choice lives at the read side.
   */
  useEffect(() => {
    const userId = session?.user?.id;
    const client = getSupabaseClient();
    if (!userId || !client) return;

    const touch = () => {
      if (document.visibilityState === 'visible') {
        void client.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
      }
    };
    touch();
    const timer = window.setInterval(touch, 120_000);
    document.addEventListener('visibilitychange', touch);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', touch);
    };
  }, [session?.user?.id]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  /**
   * Auto sign-out after inactivity (`session_inactivity_minutes`, seeded Phase 2,
   * never wired up until now). A session issued at a shared/public computer must
   * not stay open indefinitely just because nobody explicitly signed out — this is
   * the floor, independent of anyone remembering to click "sign out".
   */
  const idleMinutes = useSettings().number('session_inactivity_minutes', 60);
  const navigate = useNavigate();
  const idleTimer = useRef<number>();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const idleMs = idleMinutes * 60_000;
    const onIdle = () => {
      void signOut();
      navigate(ROUTES.login, { replace: true, state: { idleLogout: true } });
    };
    const reset = () => {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(onIdle, idleMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      window.clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session?.user?.id, idleMinutes, signOut, navigate]);

  const hasRole = useCallback(
    (...wanted: AppRole[]) => wanted.some((r) => roles.includes(r)),
    [roles],
  );

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
