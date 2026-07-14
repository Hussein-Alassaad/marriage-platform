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
  guardianAccept: '/guardian/accept',
  guardians: '/guardians',
  verifyPhone: '/verify-phone',
  verifyIdentity: '/verify-identity',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',
  // Legal pages are public: someone must be able to read the terms BEFORE agreeing to them.
  terms: '/terms',
  privacy: '/privacy',
  rules: '/community-rules',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
