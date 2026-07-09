import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      title={t('page.notifications.title')}
      subtitle={t('page.notifications.subtitle')}
    />
  );
}
