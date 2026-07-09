import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';

export function AssistantPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t('page.assistant.title')} subtitle={t('page.assistant.subtitle')} />;
}
