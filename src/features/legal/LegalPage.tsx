import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';

/**
 * Terms, Privacy and Community Rules.
 *
 * The copy lives in i18n (so Arabic is a first-class version, not a translation bolted on)
 * and each document is a list of plain sentences rather than a wall of legalese. A member
 * who cannot understand what they agreed to has not agreed to anything.
 *
 * These are honest drafts, not legal advice: they describe what the platform ACTUALLY does
 * — moderation reads messages, identity documents are deleted after verification, an admin
 * cannot open a private conversation. Have a lawyer review them before launch.
 */
export function LegalPage({ doc }: { doc: 'terms' | 'privacy' | 'rules' }) {
  const { t } = useTranslation();

  const sections = t(`legal.${doc}.sections`, { returnObjects: true }) as {
    heading: string;
    body: string;
  }[];

  return (
    <div className="bg-bg-1 mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title={t(`legal.${doc}.title`)}
        subtitle={t(`legal.${doc}.subtitle`)}
        eyebrow={t('legal.eyebrow')}
      />

      <Card className="space-y-6 p-6 sm:p-8">
        {(Array.isArray(sections) ? sections : []).map((section) => (
          <section key={section.heading}>
            <h2 className="text-ink font-display mb-2 text-base font-semibold">
              {section.heading}
            </h2>
            <p className="text-muted text-sm leading-relaxed whitespace-pre-line">{section.body}</p>
          </section>
        ))}

        <p className="text-faint border-line border-t pt-5 text-xs">{t('legal.updated')}</p>
      </Card>
    </div>
  );
}
