import { Outlet, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/hooks/useSession';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { ROUTES } from '@/app/routes';

/**
 * Verification gate for matchmaking surfaces (Decision #5). A user may browse the
 * app while unverified, but matching/interests/communication require a verified
 * identity — enforced at the DB (RLS) too. Renders a clear gated state rather
 * than a silent redirect. The verification flow itself lands in Phase 5.
 */
export function RequireVerified() {
  const { isLoading, verificationStatus } = useSession();
  const { t } = useTranslation();

  if (isLoading) return <FullScreenLoader />;
  if (verificationStatus === 'verified') return <Outlet />;

  return (
    <>
      <PageHeader title={t('page.match.title')} subtitle={t('page.match.subtitle')} />
      <EmptyState
        icon={ShieldCheck}
        title={t('verification.gate.title')}
        description={t('verification.gate.body')}
        action={
          <Link to={ROUTES.verifyIdentity}>
            <Button magnetic>{t('verification.gate.cta')}</Button>
          </Link>
        }
      />
    </>
  );
}
