import { useTranslation } from 'react-i18next';
import { Download, Printer } from 'lucide-react';

import { Button } from '@/components/Button';
import { useLanguage } from '@/hooks/useLanguage';
import { downloadCsv } from '@/utils/csv';
import { convert, formatMoney, type RateMap } from '@/utils/money';
import type { Entry } from '@/services/financeService';

/**
 * Exports.
 *
 * PDF is the browser's print dialogue ("Save as PDF"), not a PDF library. A client-side PDF
 * generator would add a large dependency, produce worse typography, and — the part that
 * actually matters — would not lay out Arabic correctly. The browser already does both.
 *
 * Every row carries BOTH the original amount (the currency the member typed) and the
 * converted one, because an export that silently converts is an export you cannot audit.
 */
export function ExportMenu({
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

  const exportCsv = () => {
    const rows: string[][] = [
      [
        t('finance.export.date'),
        t('finance.export.kind'),
        t('finance.export.label'),
        t('finance.export.amount'),
        t('finance.export.currency'),
        t('finance.export.converted', { currency }),
      ],
      ...entries.map((e) => {
        const converted = convert(e.amount, e.currency, currency, rates);
        return [
          e.occurred_on,
          t(`finance.kind.${e.kind}`),
          t(`finance.${e.kind === 'income' ? 'source' : 'category'}.${e.label}`, {
            defaultValue: e.label,
          }),
          String(e.amount),
          e.currency,
          // An unconvertible amount says so. It never silently becomes zero.
          converted == null ? t('finance.export.noRate') : converted.toFixed(2),
        ];
      }),
    ];
    downloadCsv(`mithaq-finance-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const printReport = () => {
    const month = new Date().toISOString().slice(0, 7);
    const thisMonth = entries.filter((e) => e.occurred_on.startsWith(month));
    const sum = (kind: 'income' | 'expense') =>
      thisMonth
        .filter((e) => e.kind === kind)
        .reduce((total, e) => total + (convert(e.amount, e.currency, currency, rates) ?? 0), 0);

    const income = sum('income');
    const expenses = sum('expense');
    const dir = language === 'ar' ? 'rtl' : 'ltr';

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!doctype html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <title>${t('finance.export.reportTitle')}</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 2.5rem; color: #111; }
    h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
    p.sub { color: #666; margin: 0 0 2rem; font-size: .9rem; }
    .totals { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .totals div { flex: 1; border: 1px solid #e5e5e5; border-radius: .5rem; padding: 1rem; }
    .totals span { display: block; color: #666; font-size: .8rem; margin-bottom: .35rem; }
    .totals strong { font-size: 1.15rem; }
    table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    th, td { text-align: ${dir === 'rtl' ? 'right' : 'left'}; padding: .5rem .35rem; border-bottom: 1px solid #eee; }
    th { color: #666; font-weight: 600; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <h1>${t('finance.export.reportTitle')}</h1>
  <p class="sub">${new Date().toLocaleDateString(language, { month: 'long', year: 'numeric' })}</p>
  <div class="totals">
    <div><span>${t('finance.summary.income')}</span><strong>${formatMoney(income, currency, language)}</strong></div>
    <div><span>${t('finance.summary.expenses')}</span><strong>${formatMoney(expenses, currency, language)}</strong></div>
    <div><span>${t('finance.summary.net')}</span><strong>${formatMoney(income - expenses, currency, language)}</strong></div>
  </div>
  <table>
    <thead><tr>
      <th>${t('finance.export.date')}</th>
      <th>${t('finance.export.label')}</th>
      <th>${t('finance.export.amount')}</th>
    </tr></thead>
    <tbody>
      ${thisMonth
        .map(
          (e) => `<tr>
        <td>${new Date(e.occurred_on).toLocaleDateString(language)}</td>
        <td>${t(`finance.${e.kind === 'income' ? 'source' : 'category'}.${e.label}`, { defaultValue: e.label })}</td>
        <td>${e.kind === 'income' ? '+' : '−'}${formatMoney(e.amount, e.currency, language)}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!entries.length}>
        <Download className="h-4 w-4" aria-hidden />
        {t('finance.export.csv')}
      </Button>
      <Button size="sm" variant="ghost" onClick={printReport} disabled={!entries.length}>
        <Printer className="h-4 w-4" aria-hidden />
        {t('finance.export.pdf')}
      </Button>
    </div>
  );
}
