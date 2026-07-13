import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Gem, Plus, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardDescription, CardTitle } from '@/components/Card';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { useSettings } from '@/hooks/useSettings';
import {
  useEntries,
  usePrimaryCurrency,
  useRates,
  useSetPrimaryCurrency,
} from '@/hooks/useFinance';
import { tierAtLeast } from '@/services/subscriptionService';
import { BudgetsCard } from './BudgetsCard';
import { EntryList } from './EntryList';
import { EntryModal } from './EntryModal';
import { GoalsCard } from './GoalsCard';

// Recharts is heavy and only the paid tiers see it — keep it out of the free bundle.
const FinanceCharts = lazy(() => import('./FinanceCharts'));

/**
 * The Finance pillar. Decision #17 sets the tiers:
 *   Free    — add income/expenses, view a simple history.
 *   Serious — the above, plus charts, statistics, budgets, savings goals, reports.
 *   Plus    — the above, plus Couple Finance (Married Stage, dual consent).
 * The gate reads its minimum tier from settings, so an admin can move a feature
 * between tiers without a deploy.
 */
export function FinancePage() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { text, list, bool } = useSettings();
  const { currency } = usePrimaryCurrency();
  const setCurrency = useSetPrimaryCurrency();
  const { rates } = useRates();
  const { data: entries, isLoading } = useEntries();
  const [adding, setAdding] = useState(false);

  const tier = profile?.subscription_tier ?? 'free';
  const dashboardUnlocked = tierAtLeast(tier, text('finance_charts_min_tier', 'serious'));
  const currencies = list('finance_currencies', ['USD']);
  const rows = entries ?? [];

  return (
    <div>
      <PageHeader
        title={t('finance.title')}
        subtitle={t('finance.subtitle')}
        eyebrow={t('finance.eyebrow')}
        actions={
          <>
            <Select
              aria-label={t('finance.displayCurrency')}
              value={currency}
              onChange={(e) => setCurrency.mutate(e.target.value)}
              className="h-10 w-28"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('finance.add')}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="rounded-card h-24" />
          <Skeleton className="rounded-card h-64" />
        </div>
      ) : dashboardUnlocked ? (
        <div className="space-y-6">
          <Suspense fallback={<Skeleton className="rounded-card h-[560px]" />}>
            <FinanceCharts entries={rows} currency={currency} rates={rates} />
          </Suspense>

          <div className="grid gap-5 lg:grid-cols-2">
            <BudgetsCard entries={rows} currency={currency} rates={rates} />
            <GoalsCard currency={currency} />
          </div>

          {/* AI insights need a funded key; the setting stays off until there is one,
              and we say so rather than showing a button that always fails. */}
          {bool('finance_ai_insights_enabled') ? null : (
            <p className="text-faint flex items-center justify-center gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t('finance.insightsSoon')}
            </p>
          )}

          <section>
            <h2 className="font-display text-ink mb-3 text-base font-semibold">
              {t('finance.history')}
            </h2>
            <EntryList entries={rows} />
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <EntryList entries={rows} />
          <UpgradeCard />
        </div>
      )}

      <EntryModal open={adding} onClose={() => setAdding(false)} defaultCurrency={currency} />
    </div>
  );
}

/** What the free tier is missing, stated plainly — no dark patterns, no fake previews. */
function UpgradeCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const features = ['charts', 'statistics', 'budgets', 'goals', 'reports'];

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <Gem className="text-gold-500 h-4 w-4" aria-hidden />
        <CardTitle>{t('finance.upgrade.title')}</CardTitle>
      </div>
      <CardDescription>{t('finance.upgrade.body')}</CardDescription>

      <ul className="my-5 grid gap-2 sm:grid-cols-2">
        {features.map((key) => (
          <li key={key} className="text-ink-soft flex items-center gap-2 text-sm">
            <span className="bg-brand-500 h-1.5 w-1.5 rounded-full" aria-hidden />
            {t(`finance.upgrade.feature.${key}`)}
          </li>
        ))}
      </ul>

      <Button variant="outline" onClick={() => navigate(ROUTES.plans)}>
        {t('finance.upgrade.cta')}
      </Button>
    </Card>
  );
}
