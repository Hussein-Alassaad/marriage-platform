import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Download, Globe, Moon, Trash2 } from 'lucide-react';

import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, CardDescription, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { accountService } from '@/services/accountService';
import { authService } from '@/services/authService';

/**
 * Account settings, including the two things a platform holding identity documents and
 * private conversations must never make hard to find: take your data with you, and leave.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();

  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await accountService.exportData();
      // Straight to a file. A data export you have to email someone for is not one.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mithaq-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.exportError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        eyebrow={t('settings.eyebrow')}
      />

      <div className="space-y-5">
        <Card className="p-5">
          <CardTitle className="mb-4">{t('settings.appearance')}</CardTitle>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Globe className="text-muted h-4 w-4" aria-hidden />
              <span className="text-ink-soft text-sm">{t('settings.language')}</span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center gap-3">
              <Moon className="text-muted h-4 w-4" aria-hidden />
              <span className="text-ink-soft text-sm">{t('settings.theme')}</span>
              <ThemeToggle />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="text-brand-600 h-4 w-4" aria-hidden />
            <CardTitle>{t('settings.notifications')}</CardTitle>
          </div>
          <CardDescription>{t('settings.notificationsBody')}</CardDescription>
          <Button variant="outline" className="mt-4" onClick={() => navigate(ROUTES.notifications)}>
            {t('settings.openNotifications')}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Download className="text-brand-600 h-4 w-4" aria-hidden />
            <CardTitle>{t('settings.export')}</CardTitle>
          </div>
          <CardDescription>{t('settings.exportBody')}</CardDescription>
          <Button variant="outline" className="mt-4" disabled={exporting} onClick={exportData}>
            {exporting ? t('settings.exporting') : t('settings.exportAction')}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Trash2 className="text-danger h-4 w-4" aria-hidden />
            <CardTitle>{t('settings.delete')}</CardTitle>
          </div>
          <CardDescription>{t('settings.deleteBody')}</CardDescription>
          <Button variant="outline" className="mt-4" onClick={() => setConfirming(true)}>
            {t('settings.deleteAction')}
          </Button>
        </Card>

        {error ? <Alert>{error}</Alert> : null}

        <p className="text-faint text-center text-xs">
          <Link to={ROUTES.terms} className="underline-offset-4 hover:underline">
            {t('legal.terms.title')}
          </Link>
          {' · '}
          <Link to={ROUTES.privacy} className="underline-offset-4 hover:underline">
            {t('legal.privacy.title')}
          </Link>
          {' · '}
          <Link to={ROUTES.rules} className="underline-offset-4 hover:underline">
            {t('legal.rules.title')}
          </Link>
        </p>
      </div>

      <DeleteModal
        open={confirming}
        email={user?.email ?? ''}
        onClose={() => setConfirming(false)}
        onDeleted={async () => {
          await authService.signOut();
          navigate(ROUTES.login);
        }}
      />
    </div>
  );
}

/**
 * Deletion is irreversible, so it asks for the one thing a mis-click cannot produce: the
 * member types their own email address. No dark pattern in the other direction either —
 * the button is not buried, and it is not disguised as something else.
 */
function DeleteModal({
  open,
  email,
  onClose,
  onDeleted,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await accountService.deleteAccount();
      await onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.deleteError'));
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('settings.deleteTitle')}>
      <p className="text-muted mb-4 text-sm leading-relaxed">{t('settings.deleteWarning')}</p>

      <ul className="text-ink-soft mb-5 space-y-1.5 text-sm">
        <li>• {t('settings.deleteBullet.documents')}</li>
        <li>• {t('settings.deleteBullet.profile')}</li>
        <li>• {t('settings.deleteBullet.matches')}</li>
        <li>• {t('settings.deleteBullet.records')}</li>
      </ul>

      <label className="mb-4 block">
        <span className="text-ink-soft mb-1.5 block text-sm font-medium">
          {t('settings.deleteConfirm', { email })}
        </span>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
      </label>

      {error ? <Alert>{error}</Alert> : null}

      <Button
        fullWidth
        variant="outline"
        className="mt-2"
        disabled={typed.trim().toLowerCase() !== email.toLowerCase() || pending}
        onClick={submit}
      >
        {pending ? t('settings.deleting') : t('settings.deleteFinal')}
      </Button>
    </Modal>
  );
}
