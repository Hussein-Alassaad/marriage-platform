import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { useAdminSettings, useUpdateSetting } from '@/hooks/useAdmin';
import type { Setting } from '@/services/adminService';

/**
 * The whole reason the settings engine exists. Until now every limit, price and feature
 * flag lived in the database but could only be changed by hand-written SQL — which meant
 * "no hardcoded values" was true of the code and false of the operation.
 *
 * Every change is recorded twice: `settings_history` (the append-only trail, from the
 * Phase 2 trigger) and `audit_logs` (the cross-domain "what did this admin do today").
 */
export function SettingsEditor() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useAdminSettings(true);
  const [filter, setFilter] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="rounded-card h-16" />
        ))}
      </div>
    );
  }

  const rows = (settings ?? []).filter(
    (s) =>
      !filter ||
      s.key.toLowerCase().includes(filter.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <div className="relative mb-4">
        <Search
          className="text-faint pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('admin.settings.search')}
          className="ps-10"
        />
      </div>

      <Card className="divide-line divide-y">
        {rows.map((s) => (
          <SettingRow key={s.key} setting={s} />
        ))}
        {!rows.length ? (
          <p className="text-muted p-6 text-center text-sm">{t('admin.settings.none')}</p>
        ) : null}
      </Card>
    </div>
  );
}

function SettingRow({ setting }: { setting: Setting }) {
  const { t } = useTranslation();
  const update = useUpdateSetting();
  const [draft, setDraft] = useState(() => stringify(setting.value));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = draft !== stringify(setting.value);

  const save = async () => {
    setError(null);
    let value: unknown;
    try {
      value = parse(draft, setting.type);
    } catch {
      setError(t('admin.settings.invalid', { type: setting.type }));
      return;
    }
    try {
      await update.mutateAsync({ key: setting.key, value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.settings.saveError'));
    }
  };

  return (
    <div className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <code className="text-ink text-sm font-medium">{setting.key}</code>
        <Badge variant="neutral">{setting.type}</Badge>
        {setting.is_public ? <Badge variant="brand">{t('admin.settings.public')}</Badge> : null}
        {saved ? (
          <span className="text-success flex items-center gap-1 text-xs">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {t('admin.settings.saved')}
          </span>
        ) : null}
      </div>

      {setting.description ? (
        <p className="text-muted mb-3 text-sm">{setting.description}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {setting.type === 'boolean' ? (
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft === 'true'}
              onChange={(e) => setDraft(e.target.checked ? 'true' : 'false')}
              className="border-line text-brand-600 h-4 w-4 rounded"
            />
            <span className="text-ink-soft text-sm">
              {t(`admin.settings.${draft === 'true' ? 'on' : 'off'}`)}
            </span>
          </label>
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-10 max-w-md font-mono text-sm"
            inputMode={setting.type === 'number' ? 'decimal' : 'text'}
          />
        )}

        <Button size="sm" disabled={!dirty || update.isPending} onClick={save}>
          {t('admin.settings.save')}
        </Button>
      </div>

      {error ? <p className="text-danger mt-2 text-xs">{error}</p> : null}
    </div>
  );
}

/** JSON values are edited as text; numbers and strings are shown bare, not quoted. */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** Throws on anything that would poison a setting's readers — the server checks again. */
function parse(draft: string, type: Setting['type']): unknown {
  if (type === 'number') {
    const n = Number(draft);
    if (!Number.isFinite(n)) throw new Error('not a number');
    return n;
  }
  if (type === 'boolean') return draft === 'true';
  if (type === 'string') return draft;
  const parsed: unknown = JSON.parse(draft);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('not json');
  return parsed;
}
