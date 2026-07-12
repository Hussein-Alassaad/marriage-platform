import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ROUTES } from './routes';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { RequireVerified } from './guards/RequireVerified';

import { HomePage } from '@/features/home/HomePage';
import { MatchPage } from '@/features/match/MatchPage';
import { ConversationPage } from '@/features/chat/ConversationPage';
import { FinancePage } from '@/features/finance/FinancePage';
import { AssistantPage } from '@/features/assistant/AssistantPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { OnboardingPage } from '@/features/profile/onboarding/OnboardingPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { PlansPage } from '@/features/plans/PlansPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { GuardianPage } from '@/features/guardian/GuardianPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { PhoneVerificationPage } from '@/features/auth/PhoneVerificationPage';
import { VerifyIdentityPage } from '@/features/verification/VerifyIdentityPage';
import { NotFoundPage } from '@/features/errors/NotFoundPage';

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
