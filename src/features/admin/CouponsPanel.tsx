import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useCoupons, useCreateCoupon, useToggleCoupon } from '@/hooks/useAdmin';

/**
 * Coupons are never deleted, only deactivated: a spent coupon is part of the payment record
 * that explains why someone paid less than the list price.
 *
 * The discount itself is computed server-side, from this table. The client sends a code and
 * never a price — a client-supplied price is a free membership.
 */
export function CouponsPanel() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: coupons, isLoading } = useCoupons(true);
  const create = useCreateCoupon();
  const toggle = useToggleCoupon();

  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('20');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const n = Number(value);
    if (!code.trim() || !Number.isFinite(n) || n <= 0) return;
    try {
      await create.mutateAsync({
        code: code.trim(),
        discountType,
        value: n,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        expiresAt: expiresAt || undefined,
      });
      setCode('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.coupons.error'));
    }
  };

  if (isLoading) return <Skeleton className="rounded-card h-64" />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('admin.coupons.add')}
        </Button>
      </div>

      {adding ? (
        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('admin.coupons.code')}</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-10 font-mono"
                placeholder="RAMADAN25"
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('admin.coupons.type')}</span>
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                className="h-10"
              >
                <option value="percent">{t('admin.coupons.percent')}</option>
                <option value="fixed">{t('admin.coupons.fixed')}</option>
              </Select>
            </label>
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('admin.coupons.value')}</span>
              <Input
                type="number"
                min="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-10"
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('admin.coupons.limit')}</span>
              <Input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="h-10"
                placeholder="∞"
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('admin.coupons.expires')}</span>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-10"
              />
            </label>
          </div>

          {error ? <p className="text-danger mt-3 text-xs">{error}</p> : null}

          <Button size="sm" className="mt-3" onClick={submit} disabled={create.isPending}>
            {t('admin.coupons.create')}
          </Button>
        </Card>
      ) : null}

      <Card className="divide-line divide-y">
        {(coupons ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
            <code className="text-ink text-sm font-semibold">{c.code}</code>
            <Badge variant="brand">
              {c.discount_type === 'percent' ? `${c.discount_value}%` : `−${c.discount_value}`}
            </Badge>
            {!c.active ? <Badge variant="neutral">{t('admin.coupons.inactive')}</Badge> : null}

            <span className="text-faint text-xs">
              {t('admin.coupons.used', {
                used: c.used_count,
                limit: c.usage_limit ?? '∞',
              })}
              {c.expires_at
                ? ` · ${t('admin.coupons.until', {
                    date: new Date(c.expires_at).toLocaleDateString(language),
                  })}`
                : ''}
            </span>

            <Button
              size="sm"
              variant="ghost"
              className="ms-auto"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
            >
              {t(c.active ? 'admin.coupons.deactivate' : 'admin.coupons.activate')}
            </Button>
          </div>
        ))}
        {!coupons?.length ? (
          <p className="text-muted p-6 text-center text-sm">{t('admin.coupons.empty')}</p>
        ) : null}
      </Card>
    </div>
  );
}
