import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';

export interface ComingSoonProps {
  title: string;
  subtitle?: string;
}

/**
 * Placeholder page body used by feature routes until their phase lands.
 * Keeps every route on the shared design language (no blank/disconnected pages).
 */
export function ComingSoon({ title, subtitle }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        icon={Sparkles}
        title={t('common.comingSoonTitle')}
        description={t('common.comingSoonBody')}
      />
    </>
  );
}
