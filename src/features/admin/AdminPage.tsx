import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function AdminPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.admin.title')} subtitle={t('page.admin.subtitle')} />;
}
