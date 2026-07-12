import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Clock, CreditCard, Landmark, Receipt, Smartphone, Upload } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { useSettings } from '@/hooks/useSettings';
import { useSession } from '@/hooks/useSession';
import { useCreateClaim, useMyClaim, useMySubscription, usePlans, useUploadReceipt } from '@/hooks/useSubscription';
import type { BillingPeriod, ManualMethod, Plan, Tier } from '@/services/subscriptionService';

const METHOD_ICONS: Record<ManualMethod, typeof Smartphone> = {
  omt: Receipt,
  whish: Smartphone,
  bank_transfer: Landmark,
};
const METHODS: ManualMethod[] = ['omt', 'whish', 'bank_transfer'];

/** Feature keys are seeded on the plan rows; copy for each lives in i18n. */
function featureList(plan: Plan): string[] {
  return Object.entries(plan.features ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
}

export function PlansPage() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { text, bool } = useSettings();
  const { data: plans, isLoading } = usePlans();
  const { data: subscription } = useMySubscription();
  const { data: claim } = useMyClaim();

  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [chosen, setChosen] = useState<Plan | null>(null);

  const currentTier = (profile?.subscription_tier ?? 'free') as Tier;
  const pendingClaim = claim && claim.status === 'pending' ? claim : null;

  return (
    <div>
      <PageHeader
        title={t('plans.title')}
        subtitle={t('plans.subtitle')}
        eyebrow={t('plans.eyebrow')}
        actions={
          <div className="inline-flex rounded-full bg-bg-3 p-1">
            {(['monthly', 'yearly'] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  period === p ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {period === p ? (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-surface shadow-e1"
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                  />
                ) : null}
                <span className="relative">{t(`plans.period.${p}`)}</span>
              </button>
            ))}
          </div>
        }
      />

      {/* A claim under review is the most important thing on this page — lead with it. */}
      {pendingClaim ? (
        <PendingClaimCard
          claimId={pendingClaim.id}
          referenceCode={pendingClaim.reference_code}
          method={pendingClaim.method}
          amount={pendingClaim.amount}
          currency={pendingClaim.currency}
          hasReceipt={Boolean(pendingClaim.receipt_path)}
          instructions={text(`payment_instructions_${pendingClaim.method}`)}
        />
      ) : null}

      {subscription?.expires_at ? (
        <p className="mb-5 text-sm text-muted">
          {t('plans.activeUntil', {
            tier: t(`plans.tier.${subscription.tier}`),
            date: new Date(subscription.expires_at).toLocaleDateString(),
          })}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {(plans ?? []).map((plan, index) => {
            const price = period === 'yearly' ? plan.yearly_price : plan.monthly_price;
            const isCurrent = plan.tier === currentTier;
            const popular = plan.tier === 'serious';
            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: EASE_OUT, delay: index * 0.06 }}
              >
                <Card
                  className={cn(
                    'flex h-full flex-col p-6',
                    popular && 'ring-1 ring-inset ring-[color:var(--color-border-accent)]',
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-ink">
                      {t(`plans.tier.${plan.tier}`, { defaultValue: plan.name })}
                    </h2>
                    {isCurrent ? (
                      <Badge variant="brand">{t('plans.current')}</Badge>
                    ) : popular ? (
                      <Badge variant="gold">{t('plans.popular')}</Badge>
                    ) : null}
                  </div>

                  <p className="mb-5">
                    {price != null ? (
                      <>
                        <span className="font-display text-3xl font-semibold text-ink">
                          {price === 0 ? t('plans.free') : `${plan.currency} ${price}`}
                        </span>
                        {price > 0 ? (
                          <span className="ms-1.5 text-sm text-muted">{t(`plans.per.${period}`)}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-sm text-muted">{t('plans.noYearly')}</span>
                    )}
                  </p>

                  <ul className="mb-6 flex-1 space-y-2">
                    {featureList(plan).map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-ink-soft">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                        {t(`plans.feature.${key}`, { defaultValue: key })}
                      </li>
                    ))}
                  </ul>

                  {plan.tier === 'free' || isCurrent ? (
                    <Button variant="outline" fullWidth disabled>
                      {isCurrent ? t('plans.current') : t('plans.included')}
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant={popular ? 'primary' : 'outline'}
                      disabled={Boolean(pendingClaim) || price == null}
                      onClick={() => setChosen(plan)}
                    >
                      {t('plans.choose')}
                    </Button>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Card checkout is deliberately absent until a gateway is configured. */}
      {!bool('card_payments_enabled') ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          {t('plans.cardSoon')}
        </p>
      ) : null}

      <ChooseMethodModal plan={chosen} period={period} onClose={() => setChosen(null)} />
    </div>
  );
}

/** Pick a manual method, which creates the claim and hands back a reference code. */
function ChooseMethodModal({
  plan,
  period,
  onClose,
}: {
  plan: Plan | null;
  period: BillingPeriod;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateClaim();
  const [error, setError] = useState<string | null>(null);

  const start = async (method: ManualMethod) => {
    if (!plan) return;
    setError(null);
    try {
      await create.mutateAsync({ tier: plan.tier, method, period });
      onClose();
    } catch {
      setError(t('plans.claimError'));
    }
  };

  return (
    <Modal open={Boolean(plan)} onClose={onClose} title={t('plans.methodTitle')}>
      <p className="mb-5 text-sm leading-relaxed text-muted">{t('plans.methodBody')}</p>
      <div className="space-y-2">
        {METHODS.map((method) => {
          const Icon = METHOD_ICONS[method];
          return (
            <button
              key={method}
              type="button"
              disabled={create.isPending}
              onClick={() => start(method)}
              className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-start transition-colors hover:border-brand-400 hover:bg-brand-wash disabled:opacity-60"
            >
              <Icon className="h-5 w-5 text-brand-600" aria-hidden />
              <span className="text-sm font-medium text-ink">{t(`plans.method.${method}`)}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-xs text-danger">{error}</p> : null}
    </Modal>
  );
}

/** The open claim: reference code, instructions, and the receipt upload. */
function PendingClaimCard({
  claimId,
  referenceCode,
  method,
  amount,
  currency,
  hasReceipt,
  instructions,
}: {
  claimId: string;
  referenceCode: string;
  method: ManualMethod;
  amount: number | null;
  currency: string;
  hasReceipt: boolean;
  instructions: string;
}) {
  const { t } = useTranslation();
  const upload = useUploadReceipt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ claimId, file });
    } catch {
      setError(t('plans.uploadError'));
    }
  };

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gold-500" aria-hidden />
        <h2 className="font-display text-base font-semibold text-ink">{t('plans.pendingTitle')}</h2>
        <Badge variant="warning">{t(`plans.method.${method}`)}</Badge>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted">{instructions || t('plans.pendingFallback')}</p>

      <dl className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-bg-3 p-3">
          <dt className="text-xs text-muted">{t('plans.reference')}</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold uppercase tracking-wider text-ink">{referenceCode}</dd>
        </div>
        <div className="rounded-xl bg-bg-3 p-3">
          <dt className="text-xs text-muted">{t('plans.amount')}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">
            {amount != null ? `${currency} ${amount}` : '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          <Upload className="h-4 w-4" aria-hidden />
          {hasReceipt ? t('plans.replaceReceipt') : t('plans.uploadReceipt')}
        </Button>
        <p className="text-xs text-muted">{hasReceipt ? t('plans.receiptReceived') : t('plans.receiptNeeded')}</p>
      </div>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
    </Card>
  );
}
