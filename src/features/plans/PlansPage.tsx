import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Check,
  Clock,
  CreditCard,
  HandHelping,
  Landmark,
  Receipt,
  Smartphone,
  Upload,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { useSettings } from '@/hooks/useSettings';
import { useSession } from '@/hooks/useSession';
import { useCreateTicket } from '@/hooks/useSupport';
import {
  useCreateClaim,
  useMyClaim,
  useMySubscription,
  usePlans,
  useUploadReceipt,
} from '@/hooks/useSubscription';
import { subscriptionService, tierAtLeast } from '@/services/subscriptionService';
import type {
  BillingPeriod,
  CouponPreview,
  ManualMethod,
  Plan,
  Tier,
} from '@/services/subscriptionService';

const CANT_PAY_REASONS = ['payment_problem', 'country_restriction', 'need_alternative', 'general_billing'] as const;
const TIERS: Tier[] = ['free', 'serious', 'marriage_plus'];

const METHOD_ICONS: Record<ManualMethod, typeof Smartphone> = {
  omt: Receipt,
  whish: Smartphone,
  bank_transfer: Landmark,
};
const METHODS: ManualMethod[] = ['omt', 'whish', 'bank_transfer'];

export function PlansPage() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { text, bool } = useSettings();
  const { data: plans, isLoading } = usePlans();
  const { data: subscription } = useMySubscription();
  const { data: claim } = useMyClaim();

  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [cantPayOpen, setCantPayOpen] = useState(false);

  const currentTier = (profile?.subscription_tier ?? 'free') as Tier;
  const pendingClaim = claim && claim.status === 'pending' ? claim : null;

  return (
    <div>
      <PageHeader
        title={t('plans.title')}
        subtitle={t('plans.subtitle')}
        eyebrow={t('plans.eyebrow')}
        actions={
          <div className="bg-bg-3 inline-flex rounded-full p-1">
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
                    className="bg-surface shadow-e1 absolute inset-0 rounded-full"
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
        <p className="text-muted mb-5 text-sm">
          {t('plans.activeUntil', {
            tier: t(`plans.tier.${subscription.tier}`),
            date: new Date(subscription.expires_at).toLocaleDateString(),
          })}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="rounded-card h-72" />
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
                    popular && 'ring-1 ring-[color:var(--color-border-accent)] ring-inset',
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-ink text-lg font-semibold">
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
                        <span className="font-display text-ink text-3xl font-semibold">
                          {price === 0 ? t('plans.free') : `${plan.currency} ${price}`}
                        </span>
                        {price > 0 ? (
                          <span className="text-muted ms-1.5 text-sm">
                            {t(`plans.per.${period}`)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted text-sm">{t('plans.noYearly')}</span>
                    )}
                  </p>

                  {/* Full feature breakdown lives in the comparison table below —
                      the old per-card bullet list only ever showed that plan's own
                      (non-cumulative) `features` row, so Marriage Plus never
                      displayed the Serious-tier benefits it also includes. */}
                  <div className="mb-6 flex-1" />

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

      <PlanCompareTable currentTier={currentTier} />

      {/* Card checkout is deliberately absent until a gateway is configured. */}
      {!bool('card_payments_enabled') ? (
        <p className="text-faint mt-6 flex items-center justify-center gap-2 text-xs">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          {t('plans.cardSoon')}
        </p>
      ) : null}

      {/* Some members cannot pay online at all (Lebanon banking restrictions, no
          matching method). This is their last way in — always visible, never gated
          behind a pending claim or a chosen plan. */}
      <p className="mt-4 flex items-center justify-center">
        <Button variant="ghost" size="sm" onClick={() => setCantPayOpen(true)}>
          <HandHelping className="h-4 w-4" aria-hidden />
          {t('plans.cantPay.trigger')}
        </Button>
      </p>

      <ChooseMethodModal plan={chosen} period={period} onClose={() => setChosen(null)} />
      <CantPayModal open={cantPayOpen} onClose={() => setCantPayOpen(false)} />
    </div>
  );
}

type CompareValue = { kind: 'yes' } | { kind: 'no' } | { kind: 'text'; value: string };

interface CompareRow {
  key: string;
  cells: Record<Tier, CompareValue>;
}

interface CompareGroup {
  key: string;
  rows: CompareRow[];
}

/**
 * Every real tier gate, in one place, read live from settings — never hardcoded
 * copy that could drift from what the platform actually enforces. Two gates
 * (member photos, advanced search filters) are a fixed `paid` boolean in the
 * matchmaking Edge Function rather than a settings key, so those two rows use the
 * same 'serious' minimum directly; everything else reads its real settings key.
 */
function PlanCompareTable({ currentTier }: { currentTier: Tier }) {
  const { t } = useTranslation();
  const { number, bool, text } = useSettings();

  const yes: CompareValue = { kind: 'yes' };
  const no: CompareValue = { kind: 'no' };
  const perDay = (count: number): CompareValue => ({
    kind: 'text',
    value: t('plans.compare.perDay', { count }),
  });
  const byMinTier = (minTier: string): Record<Tier, CompareValue> => ({
    free: tierAtLeast('free', minTier) ? yes : no,
    serious: tierAtLeast('serious', minTier) ? yes : no,
    marriage_plus: tierAtLeast('marriage_plus', minTier) ? yes : no,
  });

  const dailyRecs: Record<Tier, number> = {
    free: number('daily_recs_free', 10),
    serious: number('daily_recs_serious', 25),
    marriage_plus: number('daily_recs_marriage_plus', 50),
  };
  const assistantConvos: Record<Tier, number> = {
    free: number('ai_daily_conversations_free', 5),
    serious: number('ai_daily_conversations_serious', 50),
    marriage_plus: number('assistant_daily_marriage_plus', 0), // 0 = unlimited
  };
  const plusRefresh = number('plus_refresh_per_day', 3);
  const financeMinTier = text('finance_charts_min_tier', 'serious');
  const sharedTotalsMinTier = text('basic_shared_finance_tier', 'serious');
  const sharedAdvancedMinTier = text('finance_shared_min_tier', 'marriage_plus');
  const stageRequiresPaid = bool('serious_stage_requires_paid');

  const groups: CompareGroup[] = [
    {
      key: 'matching',
      rows: [
        {
          key: 'dailyRecs',
          cells: {
            free: perDay(dailyRecs.free),
            serious: perDay(dailyRecs.serious),
            marriage_plus: perDay(dailyRecs.marriage_plus),
          },
        },
        {
          key: 'plusRefresh',
          cells: { free: no, serious: no, marriage_plus: perDay(plusRefresh) },
        },
        // Only real if the platform actually requires it — an admin can turn this
        // requirement off, and the row should disappear rather than lie.
        ...(stageRequiresPaid
          ? [{ key: 'advanceStage', cells: { free: no, serious: yes, marriage_plus: yes } }]
          : []),
      ],
    },
    {
      key: 'photosSearch',
      rows: [
        { key: 'photos', cells: byMinTier('serious') },
        { key: 'filters', cells: byMinTier('serious') },
      ],
    },
    {
      key: 'finance',
      rows: [
        { key: 'financeBase', cells: { free: yes, serious: yes, marriage_plus: yes } },
        { key: 'financeCharts', cells: byMinTier(financeMinTier) },
        { key: 'financeBudgets', cells: byMinTier(financeMinTier) },
        { key: 'financeReports', cells: byMinTier(financeMinTier) },
        { key: 'sharedTotals', cells: byMinTier(sharedTotalsMinTier) },
        { key: 'sharedAdvanced', cells: byMinTier(sharedAdvancedMinTier) },
      ],
    },
    {
      key: 'assistant',
      rows: [
        {
          key: 'assistantConversations',
          cells: {
            free: perDay(assistantConvos.free),
            serious: perDay(assistantConvos.serious),
            marriage_plus:
              assistantConvos.marriage_plus === 0
                ? { kind: 'text', value: t('plans.compare.unlimited') }
                : perDay(assistantConvos.marriage_plus),
          },
        },
      ],
    },
  ];

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="font-display text-ink text-xl font-semibold">{t('plans.compare.title')}</h2>
        <p className="text-muted mt-1 text-sm">{t('plans.compare.subtitle')}</p>
      </div>

      <Card className="overflow-hidden p-0">
        {/* ≥sm: a real table. A wide, three-tier matrix asking for BOTH horizontal
            scroll AND vertical page scroll on a narrow phone — cramped into a strip
            the floating bottom nav also sits over — is a bad interaction, so mobile
            gets its own stacked layout below instead of relying on this scrolling. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-line border-b">
                <th className="text-muted p-4 text-start font-medium">
                  {t('plans.compare.feature')}
                </th>
                {TIERS.map((tier) => (
                  <th
                    key={tier}
                    className={cn(
                      'p-4 text-center font-semibold whitespace-nowrap',
                      tier === currentTier ? 'text-brand-600' : 'text-ink',
                    )}
                  >
                    {t(`plans.tier.${tier}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-bg-3">
                    <td
                      colSpan={TIERS.length + 1}
                      className="text-muted px-4 py-2 text-xs font-semibold tracking-wide uppercase"
                    >
                      {t(`plans.compare.group.${group.key}`)}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.key} className="border-line border-b last:border-0">
                      <td className="text-ink-soft p-4">{t(`plans.compare.row.${row.key}`)}</td>
                      {TIERS.map((tier) => (
                        <td key={tier} className="p-4 text-center">
                          <CompareCell value={row.cells[tier]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* <sm: every row's three values stacked in a full-width mini-grid — same
            data, no horizontal scroll. */}
        <div className="sm:hidden">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="bg-bg-3 text-muted px-4 py-2 text-xs font-semibold tracking-wide uppercase">
                {t(`plans.compare.group.${group.key}`)}
              </p>
              <div className="divide-line divide-y">
                {group.rows.map((row) => (
                  <div key={row.key} className="p-4">
                    <p className="text-ink-soft mb-3 text-sm">{t(`plans.compare.row.${row.key}`)}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TIERS.map((tier) => (
                        <div key={tier} className="flex flex-col items-center gap-1 text-center">
                          <span
                            className={cn(
                              'text-[11px] leading-tight font-medium',
                              tier === currentTier ? 'text-brand-600' : 'text-faint',
                            )}
                          >
                            {t(`plans.tier.${tier}`)}
                          </span>
                          <CompareCell value={row.cells[tier]} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function CompareCell({ value }: { value: CompareValue }) {
  const { t } = useTranslation();
  if (value.kind === 'yes') {
    return (
      <>
        <Check className="text-brand-500 mx-auto h-4 w-4" aria-hidden />
        <span className="sr-only">{t('plans.included')}</span>
      </>
    );
  }
  if (value.kind === 'no') {
    return (
      <>
        <X className="text-faint mx-auto h-4 w-4" aria-hidden />
        <span className="sr-only">{t('plans.notIncluded')}</span>
      </>
    );
  }
  return <span className="text-ink-soft font-medium whitespace-nowrap">{value.value}</span>;
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
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    if (!plan || !code.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      // A preview only. The code is spent when the claim is created, not now — otherwise a
      // curious member could exhaust a campaign just by typing in the box.
      setApplied(await subscriptionService.checkCoupon(code.trim(), plan.tier, period));
    } catch (e) {
      const key = e instanceof Error ? e.message : 'coupon_invalid';
      setCouponError(t(`plans.coupon.${key}`, { defaultValue: t('plans.coupon.coupon_invalid') }));
      setApplied(null);
    } finally {
      setChecking(false);
    }
  };

  const start = async (method: ManualMethod) => {
    if (!plan) return;
    setError(null);
    try {
      // The client sends the CODE, never a price. A client-supplied price is a free
      // membership — the server prices the claim itself.
      await create.mutateAsync({ tier: plan.tier, method, period, coupon: applied?.code });
      onClose();
    } catch {
      setError(t('plans.claimError'));
    }
  };

  return (
    <Modal open={Boolean(plan)} onClose={onClose} title={t('plans.methodTitle')}>
      <p className="text-muted mb-5 text-sm leading-relaxed">{t('plans.methodBody')}</p>

      <div className="mb-5">
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('plans.coupon.label')}
            </span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('plans.coupon.placeholder')}
              className="h-10 font-mono"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            disabled={!code.trim() || checking}
            onClick={apply}
          >
            {t('plans.coupon.apply')}
          </Button>
        </div>

        {applied ? (
          <p className="text-success mt-2 text-xs">
            {t('plans.coupon.applied', {
              code: applied.code,
              discount: `${applied.currency} ${applied.discount}`,
              total: `${applied.currency} ${applied.total}`,
            })}
          </p>
        ) : null}
        {couponError ? <p className="text-danger mt-2 text-xs">{couponError}</p> : null}
      </div>

      <div className="space-y-2">
        {METHODS.map((method) => {
          const Icon = METHOD_ICONS[method];
          return (
            <button
              key={method}
              type="button"
              disabled={create.isPending}
              onClick={() => start(method)}
              className="border-line bg-surface hover:border-brand-400 hover:bg-brand-wash flex w-full items-center gap-3 rounded-xl border p-4 text-start transition-colors disabled:opacity-60"
            >
              <Icon className="text-brand-600 h-5 w-5" aria-hidden />
              <span className="text-ink text-sm font-medium">{t(`plans.method.${method}`)}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-danger mt-4 text-xs">{error}</p> : null}
    </Modal>
  );
}

/** "Can't pay? Contact us" (PRD) — a dedicated support form for a member who cannot
 *  use any of the payment methods on this page at all. Always available, not gated
 *  behind choosing a plan first. */
function CantPayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateTicket();
  const [reason, setReason] = useState<(typeof CANT_PAY_REASONS)[number]>(CANT_PAY_REASONS[0]);
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    // Reset only after the exit animation would have finished, so the form doesn't
    // visibly reset while the modal is still closing.
    setTimeout(() => {
      setSent(false);
      setBody('');
      setReason(CANT_PAY_REASONS[0]);
      setError(null);
    }, 250);
  };

  const submit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        category: 'payment',
        subject: t(`plans.cantPay.reason.${reason}`),
        body: body.trim(),
      });
      setSent(true);
    } catch {
      setError(t('plans.cantPay.error'));
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('plans.cantPay.title')}>
      {sent ? (
        <div className="py-2">
          <p className="text-ink text-sm leading-relaxed">{t('plans.cantPay.sent')}</p>
          <Button className="mt-4" onClick={close}>
            {t('common.close')}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-muted mb-5 text-sm leading-relaxed">{t('plans.cantPay.body')}</p>

          <label className="mb-4 block">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('plans.cantPay.reasonLabel')}
            </span>
            <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {CANT_PAY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`plans.cantPay.reason.${r}`)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('plans.cantPay.detailsLabel')}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t('plans.cantPay.detailsPlaceholder')}
              className="border-line bg-surface text-ink placeholder:text-faint focus-visible:border-brand-400 w-full rounded-md border p-3.5 text-[15px] focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)] focus-visible:outline-none"
            />
          </label>

          {error ? <p className="text-danger mt-3 text-xs">{error}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? t('common.pleaseWait') : t('plans.cantPay.submit')}
            </Button>
          </div>
        </>
      )}
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
        <Clock className="text-gold-500 h-4 w-4" aria-hidden />
        <h2 className="font-display text-ink text-base font-semibold">{t('plans.pendingTitle')}</h2>
        <Badge variant="warning">{t(`plans.method.${method}`)}</Badge>
      </div>

      <p className="text-muted mb-4 text-sm leading-relaxed">
        {instructions || t('plans.pendingFallback')}
      </p>

      <dl className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="bg-bg-3 rounded-xl p-3">
          <dt className="text-muted text-xs">{t('plans.reference')}</dt>
          <dd className="text-ink mt-0.5 font-mono text-sm font-semibold tracking-wider uppercase">
            {referenceCode}
          </dd>
        </div>
        <div className="bg-bg-3 rounded-xl p-3">
          <dt className="text-muted text-xs">{t('plans.amount')}</dt>
          <dd className="text-ink mt-0.5 text-sm font-semibold">
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
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {hasReceipt ? t('plans.replaceReceipt') : t('plans.uploadReceipt')}
        </Button>
        <p className="text-muted text-xs">
          {hasReceipt ? t('plans.receiptReceived') : t('plans.receiptNeeded')}
        </p>
      </div>
      {error ? <p className="text-danger mt-3 text-xs">{error}</p> : null}
    </Card>
  );
}
