import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function SettingsPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.settings.title')} subtitle={t('page.settings.subtitle')} />;
}
