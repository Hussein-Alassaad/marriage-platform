import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { ROUTES } from '@/app/routes';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas px-4">
      <Logo />
      <EmptyState
        icon={Compass}
        title={t('page.notFound.title')}
        description={t('page.notFound.subtitle')}
        action={
          <Link to={ROUTES.home}>
            <Button>{t('common.backHome')}</Button>
          </Link>
        }
        className="max-w-md"
      />
    </div>
  );
}
