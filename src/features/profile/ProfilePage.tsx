import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function ProfilePage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.profile.title')} subtitle={t('page.profile.subtitle')} />;
}
