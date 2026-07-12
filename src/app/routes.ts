/** Canonical route paths — imported everywhere instead of hardcoded strings. */
export const ROUTES = {
  home: '/',
  match: '/match',
  messages: '/messages',
  finance: '/finance',
  assistant: '/assistant',
  notifications: '/notifications',
  profile: '/profile',
  onboarding: '/onboarding',
  settings: '/settings',
  plans: '/plans',
  admin: '/admin',
  guardian: '/guardian',
  verifyPhone: '/verify-phone',
  verifyIdentity: '/verify-identity',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
