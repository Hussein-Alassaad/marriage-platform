/** Canonical route paths — imported everywhere instead of hardcoded strings. */
export const ROUTES = {
  home: '/',
  match: '/match',
  finance: '/finance',
  assistant: '/assistant',
  notifications: '/notifications',
  profile: '/profile',
  settings: '/settings',
  admin: '/admin',
  guardian: '/guardian',
  login: '/login',
  register: '/register',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
