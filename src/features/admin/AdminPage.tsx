import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { PaymentsQueue } from '@/features/admin/PaymentsQueue';

/**
 * Admin home. The full dashboard lands in the Admin phase; the payments review
 * queue lives here now because a manual payment claim has no other way to be
 * approved — and an unapprovable payment is a broken payment.
 */
export function AdminPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('page.admin.title')} subtitle={t('page.admin.subtitle')} />
      <PaymentsQueue />
    </div>
  );
}
