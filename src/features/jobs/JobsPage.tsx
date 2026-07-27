import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

/**
 * Reachable in the nav so the destination exists, but there is nothing behind it yet —
 * no schema, no listings, no employer side. Building it is a separate, larger feature
 * (what counts as a halal listing, who can post, moderation) than a UI stub can cover.
 */
export function JobsPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('nav.jobs')} subtitle={t('jobs.subtitle')} />;
}
