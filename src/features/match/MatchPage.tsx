import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  GraduationCap,
  Heart,
  Lock,
  MapPin,
  Briefcase,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { cn } from '@/utils/cn';
import { SPRING_SNAPPY } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useOptionLabel } from '@/features/profile/ProfileFields';
import {
  useCandidateActions,
  useConnections,
  useDiscover,
  useRefreshRecommendations,
  useRespondInterest,
  useSendInterest,
} from '@/hooks/useMatch';
import type { Candidate, InterestEntry, MatchEntry } from '@/services/matchService';

export function MatchPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'discover' | 'connections'>('discover');
  const [target, setTarget] = useState<Candidate | null>(null);

  const tabs: { key: 'discover' | 'connections'; label: string }[] = [
    { key: 'discover', label: t('match.tabs.discover') },
    { key: 'connections', label: t('match.tabs.connections') },
  ];

  return (
    <>
      <PageHeader
        title={t('page.match.title')}
        subtitle={t('page.match.subtitle')}
        actions={
          <div className="border-line bg-bg-3 inline-flex rounded-full border p-0.5">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  'relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === tb.key ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {tab === tb.key ? (
                  <motion.span
                    layoutId="match-tab"
                    transition={SPRING_SNAPPY}
                    className="bg-surface absolute inset-0 -z-10 rounded-full shadow-xs"
                  />
                ) : null}
                {tb.label}
              </button>
            ))}
          </div>
        }
      />

      {tab === 'discover' ? <Discover onInterest={setTarget} /> : <Connections />}

      <InterestModal candidate={target} onClose={() => setTarget(null)} />
    </>
  );
}

function Discover({ onInterest }: { onInterest: (c: Candidate) => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useDiscover();
  const actions = useCandidateActions();
  const refresh = useRefreshRecommendations();

  const refreshBtn = (ghost?: boolean) => (
    <Button
      variant={ghost ? 'ghost' : 'primary'}
      onClick={() => refresh.mutate()}
      disabled={refresh.isPending}
    >
      <RefreshCw
        className={cn('h-4 w-4', refresh.isPending && 'animate-[spin_0.8s_linear_infinite]')}
        aria-hidden
      />
      {ghost ? t('match.refresh') : t('match.generate')}
    </Button>
  );

  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="rounded-card h-96 w-full" />
        ))}
      </div>
    );
  }
  if (isError) return <Alert>{t('match.error')}</Alert>;
  if (!data || data.candidates.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('match.empty.title')}
        description={t('match.empty.body')}
        action={refreshBtn()}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">{refreshBtn(true)}</div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data.candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onInterest={() => onInterest(c)}
            onSave={() => actions.save.mutate({ candidateId: c.id, saved: c.saved })}
            onPass={() => actions.decline.mutate(c.id)}
            busy={actions.decline.isPending || actions.save.isPending}
          />
        ))}
      </div>
    </>
  );
}

function CandidateCard({
  candidate: c,
  onInterest,
  onSave,
  onPass,
  busy,
}: {
  candidate: Candidate;
  onInterest: () => void;
  onSave: () => void;
  onPass: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const label = useOptionLabel();
  const meta = [
    c.age ? t('match.age', { age: c.age }) : null,
    [c.city, c.country].filter(Boolean).join(', ') || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card interactive className="flex flex-col overflow-hidden p-0">
      {/* Photo / privacy tile */}
      <div className="bg-bg-3 relative aspect-[5/4] w-full overflow-hidden">
        {c.photoUrl ? (
          <img src={c.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : c.photoLocked ? (
          <div className="from-brand-100 to-brand-200 text-brand-700 grid h-full w-full place-items-center bg-gradient-to-br">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Lock className="h-6 w-6" aria-hidden />
              <span className="text-xs font-medium">{t('match.privatePhoto')}</span>
            </div>
          </div>
        ) : (
          <div className="from-brand-100 to-brand-200 text-brand-800 grid h-full w-full place-items-center bg-gradient-to-br text-4xl font-semibold">
            {(c.displayName?.[0] ?? '·').toUpperCase()}
          </div>
        )}
        {c.overall != null ? (
          <div className="absolute end-3 top-3 rounded-full bg-[rgba(4,9,7,0.55)] p-1 backdrop-blur">
            <ProgressRing value={c.overall} size={46} stroke={4}>
              <span className="text-[11px] font-bold text-white">{c.overall}%</span>
            </ProgressRing>
          </div>
        ) : (
          <span className="bg-brand-wash text-brand-700 absolute end-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-[color:var(--color-border-accent)] backdrop-blur ring-inset">
            {t('match.new')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-ink truncate text-base font-semibold">{c.displayName ?? '—'}</h3>
          <BadgeCheck className="text-gold-400 h-4 w-4 shrink-0" aria-hidden />
        </div>
        {meta ? (
          <p className="text-muted mt-0.5 inline-flex items-center gap-1 text-sm">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {meta}
          </p>
        ) : null}

        <div className="text-ink-soft mt-3 flex flex-col gap-1.5 text-sm">
          {c.educationLevel ? (
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="text-faint h-4 w-4" aria-hidden />
              {label('education', c.educationLevel)}
            </span>
          ) : null}
          {c.occupation ? (
            <span className="inline-flex items-center gap-2">
              <Briefcase className="text-faint h-4 w-4" aria-hidden />
              {c.occupation}
            </span>
          ) : null}
        </div>

        {c.bio ? (
          <p className="text-muted mt-3 line-clamp-2 text-sm leading-relaxed">{c.bio}</p>
        ) : null}

        {c.languages.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.languages.slice(0, 4).map((l) => (
              <Badge key={l} variant="neutral">
                {label('language', l)}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-5">
          <button
            type="button"
            onClick={onPass}
            disabled={busy}
            aria-label={t('match.pass')}
            className="border-line-strong text-muted hover:border-danger/40 hover:text-danger grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            aria-label={c.saved ? t('match.saved') : t('match.save')}
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors',
              c.saved
                ? 'bg-brand-wash text-brand-600 border-[color:var(--color-border-accent)]'
                : 'border-line-strong text-muted hover:text-brand-600 hover:border-[color:var(--color-border-accent)]',
            )}
          >
            <Heart className={cn('h-5 w-5', c.saved && 'fill-current')} aria-hidden />
          </button>
          <Button onClick={onInterest} fullWidth>
            {t('match.sendInterest')}
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InterestModal({
  candidate,
  onClose,
}: {
  candidate: Candidate | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const send = useSendInterest();

  const submit = async () => {
    if (!candidate) return;
    try {
      await send.mutateAsync({ recipientId: candidate.id, note: note.trim() || undefined });
      setNote('');
      onClose();
    } catch {
      /* surfaced below */
    }
  };

  return (
    <Modal
      open={Boolean(candidate)}
      onClose={onClose}
      title={t('match.interest.title', { name: candidate?.displayName ?? '' })}
    >
      <p className="text-muted text-sm leading-relaxed">{t('match.interest.body')}</p>
      {send.isError ? (
        <div className="mt-3">
          <Alert>{t('match.interest.error')}</Alert>
        </div>
      ) : null}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        maxLength={300}
        placeholder={t('match.interest.notePlaceholder')}
        className="border-line bg-surface text-ink placeholder:text-faint focus-visible:border-brand-400 mt-4 w-full rounded-md border p-3.5 text-[15px] focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)] focus-visible:outline-none"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('match.interest.cancel')}
        </Button>
        <Button onClick={submit} magnetic disabled={send.isPending}>
          {send.isPending ? t('common.pleaseWait') : t('match.interest.send')}
          <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </Button>
      </div>
    </Modal>
  );
}

function Connections() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConnections();
  const respond = useRespondInterest();

  if (isLoading) return <Skeleton className="rounded-card h-72 w-full" />;
  if (isError) return <Alert>{t('match.error')}</Alert>;

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const matches = data?.matches ?? [];

  const personName = (p: Candidate | null) => p?.displayName ?? '—';

  return (
    <div className="flex flex-col gap-6">
      {/* Incoming interests */}
      <section>
        <h2 className="text-brand-700 mb-3 text-sm font-semibold tracking-wider uppercase">
          {t('match.connections.incoming')}
        </h2>
        {incoming.length === 0 ? (
          <EmptyState icon={Heart} title={t('match.connections.incomingEmpty')} />
        ) : (
          <div className="flex flex-col gap-3">
            {incoming.map((i: InterestEntry) => (
              <Card
                key={i.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-ink font-semibold">{personName(i.person)}</p>
                  {i.note ? (
                    <p className="text-muted mt-0.5 line-clamp-2 text-sm">“{i.note}”</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => respond.mutate({ interestId: i.id, decision: 'declined' })}
                    disabled={respond.isPending}
                  >
                    {t('match.connections.decline')}
                  </Button>
                  <Button
                    onClick={() => respond.mutate({ interestId: i.id, decision: 'accepted' })}
                    disabled={respond.isPending}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {t('match.connections.accept')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Matches */}
      <section>
        <h2 className="text-brand-700 mb-3 text-sm font-semibold tracking-wider uppercase">
          {t('match.connections.matches')}
        </h2>
        {matches.length === 0 ? (
          <EmptyState icon={Sparkles} title={t('match.connections.matchesEmpty')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m: MatchEntry) => {
              const canChat = m.stage !== 'interest_sent' && m.stage !== 'terminated';
              return (
                <Card key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate font-semibold">{personName(m.person)}</p>
                    <Badge variant="brand">
                      {t(`match.stage.${m.stage}`, { defaultValue: m.stage })}
                    </Badge>
                  </div>
                  {canChat ? (
                    <Link
                      to={`${ROUTES.messages}/${m.id}`}
                      state={{ person: m.person, stage: m.stage }}
                    >
                      <Button variant="secondary">{t('chat.open')}</Button>
                    </Link>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Sent interests */}
      {outgoing.length > 0 ? (
        <section>
          <h2 className="text-brand-700 mb-3 text-sm font-semibold tracking-wider uppercase">
            {t('match.connections.outgoing')}
          </h2>
          <div className="flex flex-col gap-3">
            {outgoing.map((i: InterestEntry) => (
              <Card key={i.id} className="flex items-center justify-between gap-3">
                <p className="text-ink font-semibold">{personName(i.person)}</p>
                <Badge
                  variant={
                    i.status === 'accepted'
                      ? 'success'
                      : i.status === 'declined'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {t(`match.interestStatus.${i.status}`, { defaultValue: i.status })}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
