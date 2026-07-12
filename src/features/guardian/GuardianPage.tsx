import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { EASE_OUT } from '@/lib/motion';
import { useSession } from '@/hooks/useSession';
import { useSharedMatches } from '@/hooks/useGuardian';
import type { GuardianPerson } from '@/services/guardianService';

function age(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a;
}

function details(p: GuardianPerson | null): string {
  if (!p) return '—';
  return [age(p.dob), p.occupation, [p.city, p.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The guardian's whole world. They never browse the platform: this page shows only
 * the connections the woman explicitly shared, and she can revoke any of them at any
 * time — at which point they disappear from here.
 */
export function GuardianPage() {
  const { t } = useTranslation();
  const { hasRole } = useSession();
  const { data: matches, isLoading } = useSharedMatches(hasRole('guardian'));

  return (
    <div>
      <PageHeader title={t('page.guardian.title')} subtitle={t('guardianView.subtitle')} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
        </div>
      ) : (matches ?? []).length === 0 ? (
        <EmptyState icon={Inbox} title={t('guardianView.emptyTitle')} description={t('guardianView.emptyBody')} />
      ) : (
        <div className="space-y-3">
          {(matches ?? []).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: i * 0.05 }}
            >
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    {t('guardianView.connectionOf', { name: m.ward?.display_name ?? '—' })}
                  </p>
                  <Badge variant="brand">{t(`match.stage.${m.stage}`, { defaultValue: m.stage })}</Badge>
                </div>
                <p className="font-display text-lg font-semibold text-ink">{m.candidate?.display_name ?? '—'}</p>
                <p className="mt-1 text-sm text-muted">{details(m.candidate)}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-faint">{t('guardianView.privacyNote')}</p>
    </div>
  );
}
