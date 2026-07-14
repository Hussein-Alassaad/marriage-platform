import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/utils/cn';
import { AuditPanel } from '@/features/admin/AuditPanel';
import { JobsPanel } from '@/features/admin/JobsPanel';
import { OverviewPanel } from '@/features/admin/OverviewPanel';
import { PaymentsQueue } from '@/features/admin/PaymentsQueue';
import { SettingsEditor } from '@/features/admin/SettingsEditor';
import { TicketsPanel } from '@/features/admin/TicketsPanel';
import { UsersPanel } from '@/features/admin/UsersPanel';
import { VerificationQueue } from '@/features/admin/VerificationQueue';

const TABS = [
  'overview',
  'verification',
  'payments',
  'users',
  'settings',
  'jobs',
  'support',
  'audit',
] as const;
type Tab = (typeof TABS)[number];

/**
 * "Operate the platform without touching code" — that is the promise, and the Settings tab
 * is what finally keeps it: every limit, price and feature flag has always lived in the
 * database, but until now only hand-written SQL could change one.
 *
 * What is deliberately absent: any way to read a private conversation. Moderation is
 * judged from the verdict log, and an admin who wants to browse people's messages will not
 * find a button here.
 */
export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div>
      <PageHeader title={t('page.admin.title')} subtitle={t('page.admin.subtitle')} />

      <div className="border-line mb-6 flex flex-wrap gap-1 border-b">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              tab === key
                ? 'border-brand-500 text-ink'
                : 'text-muted hover:text-ink border-transparent',
            )}
          >
            {t(`admin.tab.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewPanel /> : null}
      {tab === 'verification' ? <VerificationQueue /> : null}
      {tab === 'payments' ? <PaymentsQueue /> : null}
      {tab === 'users' ? <UsersPanel /> : null}
      {tab === 'settings' ? <SettingsEditor /> : null}
      {tab === 'jobs' ? <JobsPanel /> : null}
      {tab === 'support' ? <TicketsPanel /> : null}
      {tab === 'audit' ? <AuditPanel /> : null}
    </div>
  );
}
