import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon } from 'lucide-react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useNotificationPrefs, useSavePrefs } from '@/hooks/useNotifications';
import {
  CATEGORIES,
  DEFAULT_PREFS,
  type DigestMode,
  type NotificationPrefs,
} from '@/services/notificationService';

const DIGESTS: DigestMode[] = ['immediate', 'daily', 'weekly', 'none'];

/**
 * Preferences are enforced server-side, in the delivery trigger — this panel only edits
 * the row. Turning a category off means the notification is never created, not that it is
 * created and hidden.
 *
 * Quiet hours hold a notification until the window ends. They do not drop it: a member who
 * sleeps at 22:00 should still learn, in the morning, that their payment was approved.
 */
export function PreferencesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data } = useNotificationPrefs();
  const save = useSavePrefs();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const quiet = { ...DEFAULT_PREFS.quiet_hours, ...prefs.quiet_hours };
  const setQuiet = (patch: Record<string, unknown>) =>
    setPrefs((p) => ({ ...p, quiet_hours: { ...quiet, ...patch } }));

  const submit = async () => {
    // The browser knows the member's timezone; asking them for it would be a worse form.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await save.mutateAsync({ ...prefs, quiet_hours: { ...quiet, tz } });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('notifications.prefs.title')}>
      <section className="mb-6">
        <h3 className="text-ink mb-3 text-sm font-semibold">
          {t('notifications.prefs.categories')}
        </h3>
        <div className="space-y-2">
          {CATEGORIES.map((c) => {
            const on = prefs.categories[c] !== false; // absent = on (opt-out, not opt-in)
            return (
              <label key={c} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      categories: { ...p.categories, [c]: e.target.checked },
                    }))
                  }
                  className="border-line text-brand-600 h-4 w-4 rounded"
                />
                <span className="text-ink-soft text-sm">{t(`notifications.category.${c}`)}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="text-ink mb-3 text-sm font-semibold">{t('notifications.prefs.digest')}</h3>
        <Select
          value={prefs.digest_mode}
          onChange={(e) => setPrefs((p) => ({ ...p, digest_mode: e.target.value as DigestMode }))}
        >
          {DIGESTS.map((d) => (
            <option key={d} value={d}>
              {t(`notifications.prefs.digestMode.${d}`)}
            </option>
          ))}
        </Select>
        <p className="text-faint mt-1.5 text-xs">
          {t(`notifications.prefs.digestHint.${prefs.digest_mode}`)}
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-ink mb-3 flex items-center gap-2 text-sm font-semibold">
          <Moon className="h-4 w-4" aria-hidden />
          {t('notifications.prefs.quietHours')}
        </h3>
        <label className="mb-3 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={Boolean(quiet.enabled)}
            onChange={(e) => setQuiet({ enabled: e.target.checked })}
            className="border-line text-brand-600 h-4 w-4 rounded"
          />
          <span className="text-ink-soft text-sm">{t('notifications.prefs.quietEnabled')}</span>
        </label>

        {quiet.enabled ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">
                {t('notifications.prefs.from')}
              </span>
              <Input
                type="time"
                value={quiet.start}
                onChange={(e) => setQuiet({ start: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs">{t('notifications.prefs.to')}</span>
              <Input
                type="time"
                value={quiet.end}
                onChange={(e) => setQuiet({ end: e.target.value })}
              />
            </label>
          </div>
        ) : null}

        <p className="text-faint mt-2 text-xs">{t('notifications.prefs.quietHint')}</p>
      </section>

      <Button fullWidth onClick={submit} disabled={save.isPending}>
        {t('notifications.prefs.save')}
      </Button>
    </Modal>
  );
}
