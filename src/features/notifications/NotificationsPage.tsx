import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BellOff, Check, CheckCheck, Settings2, X } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/hooks/useLanguage';
import {
  useDismissNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { CATEGORIES, type AppNotification } from '@/services/notificationService';
import { PreferencesPanel } from './PreferencesPanel';

/** Where a notification takes you when you act on it. An unknown type simply doesn't link. */
function destination(n: AppNotification): string | null {
  const matchId = typeof n.data?.matchId === 'string' ? n.data.matchId : null;
  switch (n.type) {
    case 'message.received':
    case 'stage.advanced':
      return matchId ? `${ROUTES.messages}/${matchId}` : ROUTES.messages;
    case 'interest.received':
    case 'interest.accepted':
    case 'interest.declined':
      return ROUTES.match;
    case 'payment.approved':
    case 'payment.rejected':
    case 'subscription.expiring':
    case 'subscription.expired':
      return ROUTES.plans;
    case 'verification.approved':
    case 'verification.rejected':
      return ROUTES.verifyIdentity;
    case 'guardian.accepted':
      return ROUTES.guardians;
    case 'guardian.access_granted':
      return ROUTES.guardian;
    case 'finance.shared_connected':
      return ROUTES.finance;
    default:
      return null;
  }
}

const TONE: Record<string, 'brand' | 'gold' | 'success' | 'neutral'> = {
  match: 'brand',
  chat: 'brand',
  family: 'gold',
  subscription: 'gold',
  verification: 'success',
  finance: 'success',
  system: 'neutral',
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();

  const [category, setCategory] = useState<string>('all');
  const [showPrefs, setShowPrefs] = useState(false);

  const rows = useMemo(() => notifications ?? [], [notifications]);
  const filtered = useMemo(
    () => (category === 'all' ? rows : rows.filter((n) => n.category === category)),
    [rows, category],
  );
  const unread = rows.filter((n) => !n.read_at).length;

  // Grouped by day: thirty rows in a flat list is a wall; "Today / Yesterday" is a page.
  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const day = n.created_at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), n]);
    }
    return [...map.entries()];
  }, [filtered]);

  const dayLabel = (day: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (day === today) return t('notifications.today');
    if (day === yesterday) return t('notifications.yesterday');
    return new Date(day).toLocaleDateString(language, { day: 'numeric', month: 'long' });
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const to = destination(n);
    if (to) navigate(to);
  };

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        eyebrow={t('notifications.eyebrow')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowPrefs(true)}>
              <Settings2 className="h-4 w-4" aria-hidden />
              {t('notifications.preferences')}
            </Button>
            <Button
              variant="outline"
              disabled={!unread || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" aria-hidden />
              {t('notifications.markAllRead')}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {['all', ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              category === c
                ? 'bg-brand-wash text-brand-700 ring-1 ring-[color:var(--color-border-accent)] ring-inset'
                : 'text-muted hover:bg-bg-3 hover:text-ink',
            )}
          >
            {t(`notifications.category.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="rounded-card h-20" />
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon={BellOff}
          title={t('notifications.empty.title')}
          description={t('notifications.empty.body')}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
                {dayLabel(day)}
              </h2>
              <Card className="divide-line divide-y">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={cn('flex items-start gap-3 p-4', !n.read_at && 'bg-brand-wash/40')}
                  >
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className="min-w-0 flex-1 text-start"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {/* The row stores type + data, never a rendered sentence — so
                            switching language re-renders the entire history. */}
                        <span className="text-ink text-sm font-medium">
                          {t(`notifications.type.${n.type}.title`, { defaultValue: n.title })}
                        </span>
                        <Badge variant={TONE[n.category] ?? 'neutral'}>
                          {t(`notifications.category.${n.category}`, { defaultValue: n.category })}
                        </Badge>
                        {!n.read_at ? (
                          <span className="bg-brand-500 h-1.5 w-1.5 rounded-full" aria-hidden />
                        ) : null}
                      </div>
                      <p className="text-muted text-sm leading-relaxed">
                        {t(`notifications.type.${n.type}.body`, {
                          ...n.data,
                          defaultValue: n.body ?? '',
                        })}
                      </p>
                      <p className="text-faint mt-1 text-xs">
                        {new Date(n.created_at).toLocaleTimeString(language, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {!n.read_at ? (
                        <button
                          type="button"
                          aria-label={t('notifications.markRead')}
                          onClick={() => markRead.mutate(n.id)}
                          className="text-faint hover:bg-bg-3 hover:text-ink rounded-md p-1.5 transition-colors"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={t('notifications.dismiss')}
                        onClick={() => dismiss.mutate(n.id)}
                        className="text-faint hover:bg-bg-3 hover:text-ink rounded-md p-1.5 transition-colors"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      <PreferencesPanel open={showPrefs} onClose={() => setShowPrefs(false)} />
    </div>
  );
}
