import {
  Bell,
  Gem,
  Heart,
  Home,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

import { ROUTES } from '@/app/routes';
// Verification lives at ROUTES.verifyIdentity (reached via the match gate + the
// profile status badge), not the primary nav.

export interface NavItem {
  /** Translation key under `nav.*`. */
  key: string;
  path: string;
  icon: LucideIcon;
}

/** Core navigation available to every signed-in user. */
export const primaryNav: NavItem[] = [
  { key: 'home', path: ROUTES.home, icon: Home },
  { key: 'match', path: ROUTES.match, icon: Heart },
  { key: 'finance', path: ROUTES.finance, icon: Wallet },
  { key: 'assistant', path: ROUTES.assistant, icon: Sparkles },
  { key: 'notifications', path: ROUTES.notifications, icon: Bell },
  { key: 'profile', path: ROUTES.profile, icon: User },
];

export const settingsNav: NavItem = { key: 'settings', path: ROUTES.settings, icon: Settings };

/** Membership lives beside settings — reached when a gate asks for a paid tier. */
export const plansNav: NavItem = { key: 'plans', path: ROUTES.plans, icon: Gem };

/** Her guardian screen (invite + per-connection sharing). Shown to women only. */
export const guardiansNav: NavItem = {
  key: 'guardians',
  path: ROUTES.guardians,
  icon: ShieldCheck,
};

/**
 * Role-gated destinations. Shown as a preview in Phase 1 so the routes are
 * reachable; real role gating (admin / guardian) arrives with auth in Phase 3.
 */
export const roleNav: NavItem[] = [
  { key: 'admin', path: ROUTES.admin, icon: Shield },
  { key: 'guardian', path: ROUTES.guardian, icon: Users },
];

/** Condensed set for the mobile bottom bar (max five). */
export const bottomNav: NavItem[] = [
  primaryNav[0],
  primaryNav[1],
  primaryNav[2],
  primaryNav[3],
  primaryNav[5],
];
