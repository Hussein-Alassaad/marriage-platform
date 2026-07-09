import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function FinancePage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.finance.title')} subtitle={t('page.finance.subtitle')} />;
}
