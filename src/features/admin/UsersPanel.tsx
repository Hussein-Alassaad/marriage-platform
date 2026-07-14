import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useAdminUsers, useSetUserStatus } from '@/hooks/useAdmin';
import type { AdminUser } from '@/services/adminService';

/**
 * Suspension bites at the point of ACTION, not at login — the Edge Functions check
 * `is_account_active` before they let anyone send a message or an interest. A session
 * issued a minute before a suspension must not buy an hour of harassment.
 *
 * An admin cannot suspend another admin here, and cannot suspend themselves. That is how
 * one compromised account would otherwise lock everyone else out of their own platform.
 */
export function UsersPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const { data: users, isLoading } = useAdminUsers(query, true);
  const [target, setTarget] = useState<AdminUser | null>(null);

  return (
    <div>
      <div className="relative mb-4">
        <Search
          className="text-faint pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.users.search')}
          className="ps-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="rounded-card h-16" />
          ))}
        </div>
      ) : (
        <Card className="divide-line divide-y">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">
                  {u.display_name ?? t('admin.users.unnamed')}
                </p>
                <p className="text-faint mt-0.5 text-xs">
                  {[u.country, new Date(u.created_at).toLocaleDateString(language)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={u.verification_status === 'verified' ? 'success' : 'neutral'}>
                  {t(`verification.status.${u.verification_status}`, {
                    defaultValue: u.verification_status,
                  })}
                </Badge>
                <Badge variant={u.subscription_tier === 'free' ? 'neutral' : 'gold'}>
                  {t(`tier.${u.subscription_tier}`, { defaultValue: u.subscription_tier })}
                </Badge>
                {u.status !== 'active' ? (
                  <Badge variant="danger">{t(`admin.users.status.${u.status}`)}</Badge>
                ) : null}
              </div>

              <Button size="sm" variant="ghost" onClick={() => setTarget(u)}>
                {t('admin.users.manage')}
              </Button>
            </div>
          ))}
          {!users?.length ? (
            <p className="text-muted p-6 text-center text-sm">{t('admin.users.none')}</p>
          ) : null}
        </Card>
      )}

      <StatusModal user={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function StatusModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { t } = useTranslation();
  const setStatus = useSetUserStatus();
  const [status, setStatusValue] = useState<'active' | 'suspended' | 'banned'>('suspended');
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    setError(null);
    try {
      await setStatus.mutateAsync({
        userId: user.id,
        status,
        days: status === 'suspended' ? Number(days) || 0 : undefined,
        reason: reason || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.users.error'));
    }
  };

  return (
    <Modal open={Boolean(user)} onClose={onClose} title={t('admin.users.manageTitle')}>
      <p className="text-muted mb-5 text-sm">
        {t('admin.users.manageBody', { name: user?.display_name ?? t('admin.users.unnamed') })}
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">
            {t('admin.users.newStatus')}
          </span>
          <Select value={status} onChange={(e) => setStatusValue(e.target.value as typeof status)}>
            <option value="active">{t('admin.users.status.active')}</option>
            <option value="suspended">{t('admin.users.status.suspended')}</option>
            <option value="banned">{t('admin.users.status.banned')}</option>
          </Select>
        </label>

        {status === 'suspended' ? (
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('admin.users.days')}
            </span>
            <Input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
            <span className="text-faint mt-1 block text-xs">{t('admin.users.daysHint')}</span>
          </label>
        ) : null}

        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">
            {t('admin.users.reason')}
          </span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {error ? <p className="text-danger text-xs">{error}</p> : null}

        <Button fullWidth onClick={submit} disabled={setStatus.isPending}>
          {t('admin.users.apply')}
        </Button>
      </div>
    </Modal>
  );
}
