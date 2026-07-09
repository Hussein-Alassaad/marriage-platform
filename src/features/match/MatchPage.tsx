import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function MatchPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.match.title')} subtitle={t('page.match.subtitle')} />;
}
