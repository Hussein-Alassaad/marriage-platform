import { useTranslation } from 'react-i18next';
import { LifeBuoy } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useTickets, useUpdateTicket } from '@/hooks/useAdmin';

const STATUSES = ['open', 'in_progress', 'closed'];

/** Support: including the "I can't pay" route, which is a member's last way in. */
export function TicketsPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: tickets, isLoading } = useTickets(true);
  const update = useUpdateTicket();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="rounded-card h-24" />
        ))}
      </div>
    );
  }

  if (!tickets?.length) {
    return <EmptyState icon={LifeBuoy} title={t('admin.tickets.empty')} />;
  }

  return (
    <Card className="divide-line divide-y">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="p-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-ink text-sm font-medium">{ticket.subject}</span>
            <Badge variant="neutral">
              {t(`admin.tickets.category.${ticket.category}`, { defaultValue: ticket.category })}
            </Badge>
            <span className="text-faint ms-auto text-xs">
              {new Date(ticket.created_at).toLocaleDateString(language)}
            </span>
          </div>

          {ticket.body ? (
            <p className="text-muted mb-3 text-sm leading-relaxed">{ticket.body}</p>
          ) : null}

          <Select
            value={ticket.status}
            onChange={(e) => update.mutate({ id: ticket.id, status: e.target.value })}
            className="h-9 w-44 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.tickets.status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </Card>
  );
}
