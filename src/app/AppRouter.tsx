import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ROUTES } from './routes';

import { HomePage } from '@/features/home/HomePage';
import { MatchPage } from '@/features/match/MatchPage';
import { FinancePage } from '@/features/finance/FinancePage';
import { AssistantPage } from '@/features/assistant/AssistantPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { GuardianPage } from '@/features/guardian/GuardianPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { NotFoundPage } from '@/features/errors/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.match} element={<MatchPage />} />
        <Route path={ROUTES.finance} element={<FinancePage />} />
        <Route path={ROUTES.assistant} element={<AssistantPage />} />
        <Route path={ROUTES.notifications} element={<NotificationsPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path={ROUTES.admin} element={<AdminPage />} />
        <Route path={ROUTES.guardian} element={<GuardianPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
