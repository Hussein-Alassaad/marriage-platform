import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardTitle } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useDirection } from '@/hooks/useDirection';
import { useLanguage } from '@/hooks/useLanguage';
import { convert, formatMoney, type RateMap } from '@/utils/money';
import { ChartPie } from 'lucide-react';
import type { Entry } from '@/services/financeService';

/**
 * The Serious-tier charts (Decision #17). Lazy-loaded from FinancePage so the free
 * tier never downloads Recharts.
 *
 * RTL: Recharts does not flip itself. The category axis is `reversed` and the legend
 * and tooltip are told they are RTL, which is what makes an Arabic dashboard read
 * right-to-left instead of looking mirrored-but-wrong.
 */

const PALETTE = [
  '#10b981',
  '#34d399',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
  '#0ea5e9',
  '#84cc16',
  '#94a3b8',
];

const MONTHS_BACK = 6;

function lastMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = count - 1; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}

export default function FinanceCharts({
  entries,
  currency,
  rates,
}: {
  entries: Entry[];
  currency: string;
  rates: RateMap;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRtl = useDirection() === 'rtl';

  const inDisplay = (e: Entry) => convert(e.amount, e.currency, currency, rates) ?? 0;

  // Pie: this month's expenses by category.
  const month = new Date().toISOString().slice(0, 7);
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== 'expense' || !e.occurred_on.startsWith(month)) continue;
    byCategory.set(e.label, (byCategory.get(e.label) ?? 0) + inDisplay(e));
  }
  const pieData = [...byCategory.entries()]
    .map(([label, value]) => ({
      name: t(`finance.category.${label}`, { defaultValue: label }),
      value: Math.round(value),
    }))
    .sort((a, b) => b.value - a.value);

  // Line + bar: income vs expenses across the last six months.
  const months = lastMonths(MONTHS_BACK);
  const monthly = months.map((m) => {
    let income = 0;
    let expenses = 0;
    for (const e of entries) {
      if (!e.occurred_on.startsWith(m)) continue;
      if (e.kind === 'income') income += inDisplay(e);
      else expenses += inDisplay(e);
    }
    return {
      month: new Date(`${m}-01`).toLocaleDateString(language, { month: 'short' }),
      income: Math.round(income),
      expenses: Math.round(expenses),
      net: Math.round(income - expenses),
    };
  });

  const hasHistory = monthly.some((m) => m.income > 0 || m.expenses > 0);
  if (!hasHistory) {
    return (
      <EmptyState
        icon={ChartPie}
        title={t('finance.charts.empty')}
        description={t('finance.charts.emptyBody')}
      />
    );
  }

  // Recharts hands the formatter a loose ValueType; coerce rather than assert.
  const money = (value: unknown) => formatMoney(Number(value), currency, language);
  const axis = { stroke: 'var(--color-faint)', fontSize: 12 };
  // Recharts 3 has no `rtl` prop — the legend and tooltip flip via CSS direction.
  const flow = { direction: isRtl ? ('rtl' as const) : ('ltr' as const) };
  const legend = { iconType: 'circle' as const, wrapperStyle: { fontSize: 12, ...flow } };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <CardTitle className="mb-4">{t('finance.charts.byCategory')}</CardTitle>
        {pieData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {pieData.map((slice, i) => (
                  <Cell key={slice.name} fill={PALETTE[i % PALETTE.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={money} isAnimationActive={false} wrapperStyle={flow} />
              <Legend {...legend} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted py-16 text-center text-sm">
            {t('finance.charts.noExpensesThisMonth')}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-4">{t('finance.charts.trend')}</CardTitle>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="month" reversed={isRtl} tickLine={false} axisLine={false} {...axis} />
            <YAxis
              orientation={isRtl ? 'right' : 'left'}
              tickLine={false}
              axisLine={false}
              width={56}
              {...axis}
            />
            <Tooltip formatter={money} isAnimationActive={false} wrapperStyle={flow} />
            <Legend {...legend} />
            <Line
              type="monotone"
              dataKey="net"
              name={t('finance.charts.net')}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 lg:col-span-2">
        <CardTitle className="mb-4">{t('finance.charts.monthly')}</CardTitle>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="month" reversed={isRtl} tickLine={false} axisLine={false} {...axis} />
            <YAxis
              orientation={isRtl ? 'right' : 'left'}
              tickLine={false}
              axisLine={false}
              width={56}
              {...axis}
            />
            <Tooltip
              formatter={money}
              isAnimationActive={false}
              cursor={{ opacity: 0.06 }}
              wrapperStyle={flow}
            />
            <Legend {...legend} />
            <Bar
              dataKey="income"
              name={t('finance.summary.income')}
              fill="#10b981"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              name={t('finance.summary.expenses')}
              fill="#f59e0b"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
