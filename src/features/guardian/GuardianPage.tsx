import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function GuardianPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.guardian.title')} subtitle={t('page.guardian.subtitle')} />;
}
