import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ROUTES } from './routes';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { RequireVerified } from './guards/RequireVerified';

/**
 * Every page is lazy-loaded, so the browser downloads a section only when the member
 * actually opens it — instead of parsing the whole app (admin, onboarding, finance,
 * everything) before the first screen can paint. The Suspense boundary that shows a
 * fallback while a chunk loads lives inside each layout, so the shell stays put and only
 * the content area waits.
 *
 * Auth pages are the exception: they are the very first thing a signed-out visitor needs,
 * so eager-loading them avoids a blank flash on the login screen itself.
 */
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';

const HomePage = lazy(() =>
  import('@/features/home/HomePage').then((m) => ({ default: m.HomePage })),
);
const MatchPage = lazy(() =>
  import('@/features/match/MatchPage').then((m) => ({ default: m.MatchPage })),
);
const ConversationPage = lazy(() =>
  import('@/features/chat/ConversationPage').then((m) => ({ default: m.ConversationPage })),
);
const FinancePage = lazy(() =>
  import('@/features/finance/FinancePage').then((m) => ({ default: m.FinancePage })),
);
const AssistantPage = lazy(() =>
  import('@/features/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const OnboardingPage = lazy(() =>
  import('@/features/profile/onboarding/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const PlansPage = lazy(() =>
  import('@/features/plans/PlansPage').then((m) => ({ default: m.PlansPage })),
);
const AdminPage = lazy(() =>
  import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);
const GuardianPage = lazy(() =>
  import('@/features/guardian/GuardianPage').then((m) => ({ default: m.GuardianPage })),
);
const GuardiansPage = lazy(() =>
  import('@/features/guardian/GuardiansPage').then((m) => ({ default: m.GuardiansPage })),
);
const GuardianAcceptPage = lazy(() =>
  import('@/features/guardian/GuardianAcceptPage').then((m) => ({ default: m.GuardianAcceptPage })),
);
const PhoneVerificationPage = lazy(() =>
  import('@/features/auth/PhoneVerificationPage').then((m) => ({
    default: m.PhoneVerificationPage,
  })),
);
const VerifyIdentityPage = lazy(() =>
  import('@/features/verification/VerifyIdentityPage').then((m) => ({
    default: m.VerifyIdentityPage,
  })),
);
const LegalPage = lazy(() =>
  import('@/features/legal/LegalPage').then((m) => ({ default: m.LegalPage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

export function AppRouter() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
      </Route>
      <Route path={ROUTES.authCallback} element={<AuthCallbackPage />} />

      {/* Public, and outside every layout: you must be able to read the terms before you
          agree to them — which means before you have an account. */}
      <Route path={ROUTES.terms} element={<LegalPage doc="terms" />} />
      <Route path={ROUTES.privacy} element={<LegalPage doc="privacy" />} />
      <Route path={ROUTES.rules} element={<LegalPage doc="rules" />} />

      {/* Authenticated app */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />

          {/* Matchmaking requires a verified identity (Decision #5) */}
          <Route element={<RequireVerified />}>
            <Route path={ROUTES.match} element={<MatchPage />} />
            <Route path={`${ROUTES.messages}/:matchId`} element={<ConversationPage />} />
          </Route>

          <Route path={ROUTES.finance} element={<FinancePage />} />
          <Route path={ROUTES.assistant} element={<AssistantPage />} />
          <Route path={ROUTES.notifications} element={<NotificationsPage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.onboarding} element={<OnboardingPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.plans} element={<PlansPage />} />
          <Route path={ROUTES.guardians} element={<GuardiansPage />} />
          {/* Redeeming an invite code happens BEFORE the guardian role exists,
              so it must sit outside the role guard. */}
          <Route path={ROUTES.guardianAccept} element={<GuardianAcceptPage />} />
          <Route path={ROUTES.verifyPhone} element={<PhoneVerificationPage />} />
          <Route path={ROUTES.verifyIdentity} element={<VerifyIdentityPage />} />

          {/* Role-scoped */}
          <Route element={<RequireRole roles={['admin', 'super_admin']} />}>
            <Route path={ROUTES.admin} element={<AdminPage />} />
          </Route>
          <Route element={<RequireRole roles={['guardian']} />}>
            <Route path={ROUTES.guardian} element={<GuardianPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
