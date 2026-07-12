import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Circle, Heart, Lock, ShieldAlert } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useEndConnection, useStageConsent, useStageStatus } from '@/hooks/useChat';

interface JourneyPanelProps {
  matchId: string;
  personName?: string | null;
}

/**
 * The journey gate above the conversation. A match only advances when BOTH people
 * consent to the same next stage and that stage's requirements are met — this panel
 * shows exactly where that stands and is the only way to move (or end) it.
 * The Edge Function is the authority; this is a view of its verdict.
 */
export function JourneyPanel({ matchId, personName }: JourneyPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: status, isLoading } = useStageStatus(matchId);
  const consent = useStageConsent(matchId);
  const end = useEndConnection(matchId);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (isLoading || !status) return null;

  const { stage, next, youConsented, theyConsented, requirements } = status;
  const unmet = requirements.filter((r) => !r.met);
  const blocked = unmet.length > 0;
  const who = personName ?? t('chat.thePerson');

  const onEnd = async () => {
    await end.mutateAsync();
    setConfirmEnd(false);
    navigate(ROUTES.match);
  };

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              {stage === 'married' ? (
                <Heart className="h-4 w-4 text-gold-500" aria-hidden />
              ) : (
                <Circle className="h-3 w-3 fill-brand-500 text-brand-500" aria-hidden />
              )}
              {t(`match.stage.${stage}`, { defaultValue: stage })}
            </p>
            {next ? (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t('journey.explain', { next: t(`match.stage.${next}`, { defaultValue: next }) })}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">{t('journey.finalStage')}</p>
            )}
          </div>

          {next ? (
            <div className="flex items-center gap-2">
              {/* Both consents, made visible — nobody advances alone. */}
              <div className="me-1 hidden items-center gap-3 sm:flex">
                <ConsentDot on={youConsented} label={t('journey.you')} />
                <ConsentDot on={theyConsented} label={who} />
              </div>
              {youConsented ? (
                <Button variant="ghost" onClick={() => consent.mutate(false)} disabled={consent.isPending}>
                  {t('journey.withdraw')}
                </Button>
              ) : (
                <Button onClick={() => consent.mutate(true)} disabled={consent.isPending || blocked}>
                  {t('journey.continueTo', { next: t(`match.stage.${next}`, { defaultValue: next }) })}
                </Button>
              )}
            </div>
          ) : null}

          <Button variant="ghost" onClick={() => setConfirmEnd(true)} className="text-danger">
            {t('journey.end')}
          </Button>
        </div>

        {/* Why the button is locked — never a silent disabled state. */}
        {next && blocked ? (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="mt-3 space-y-1.5 border-t border-line pt-3"
          >
            {unmet.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-xs text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span>
                  {t(`journey.req.${r.key}`, { name: who })}
                  {r.key === 'you_paid' ? (
                    <Link to={ROUTES.plans} className="ms-1.5 font-medium text-brand-700 underline-offset-4 hover:underline">
                      {t('journey.viewPlans')}
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </motion.ul>
        ) : null}

        {next && !blocked && youConsented && !theyConsented ? (
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{t('journey.waiting', { name: who })}</p>
        ) : null}

        {stage === 'serious_communication' ? (
          <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
            {t('journey.seriousNotice')}
          </p>
        ) : null}
      </Card>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t('journey.endTitle')}>
        <p className="text-sm leading-relaxed text-muted">{t('journey.endBody', { name: who })}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={onEnd} disabled={end.isPending}>
            {t('journey.end')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ConsentDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full ring-1 ring-inset transition-colors',
          on ? 'bg-brand-500 text-on-brand ring-brand-500' : 'bg-bg-3 text-faint ring-line',
        )}
      >
        {on ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
      </span>
      <span className="max-w-24 truncate">{label}</span>
    </span>
  );
}
