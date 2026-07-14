import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuditLog } from '@/hooks/useAdmin';

/**
 * The audit log is append-only (a `prevent_mutation` trigger blocks update and delete), so
 * this panel is read-only by construction — there is no edit affordance to build.
 */
export function AuditPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: entries, isLoading } = useAuditLog(true);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="rounded-card h-12" />
        ))}
      </div>
    );
  }

  if (!entries?.length) {
    return <EmptyState icon={ScrollText} title={t('admin.audit.empty')} />;
  }

  return (
    <Card className="divide-line divide-y">
      {entries.map((e) => (
        <div key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3.5">
          <code className="text-ink text-sm font-medium">{e.action}</code>
          <span className="text-muted text-sm">
            {e.actorName ?? (e.actor_id ? t('admin.audit.unknownActor') : t('admin.audit.system'))}
          </span>
          {e.entity_type ? (
            <span className="text-faint text-xs">
              {e.entity_type}
              {e.entity_id ? ` · ${String(e.entity_id).slice(0, 8)}` : ''}
            </span>
          ) : null}
          {e.reason ? <span className="text-muted text-xs italic">“{e.reason}”</span> : null}
          <span className="text-faint ms-auto text-xs">
            {new Date(e.created_at).toLocaleString(language)}
          </span>
        </div>
      ))}
    </Card>
  );
}
