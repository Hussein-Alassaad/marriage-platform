import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Copy, ShieldCheck, UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { FormField } from '@/components/FormField';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { useSession } from '@/hooks/useSession';
import { useConnections } from '@/hooks/useMatch';
import { useInviteGuardian, useMyGuardians, useSetMatchAccess } from '@/hooks/useGuardian';
import type { Relationship } from '@/services/guardianService';

const RELATIONSHIPS: Relationship[] = ['father', 'mother', 'brother', 'uncle', 'wali', 'other'];

/**
 * The ward's (woman's) guardian screen. She invites one trusted guardian, and then
 * decides — per connection — what they may see. A guardian never browses: access is
 * by explicit share only, and she can revoke it at any moment.
 */
export function GuardiansPage() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { data, isLoading } = useMyGuardians();
  const { data: connections } = useConnections();

  const isWoman = profile?.gender === 'woman';
  const guardians = data?.guardians ?? [];
  const invitation = data?.invitation ?? null;

  return (
    <div>
      <PageHeader title={t('guardians.title')} subtitle={t('guardians.subtitle')} eyebrow={t('guardians.eyebrow')} />

      {!isWoman ? (
        <EmptyState icon={ShieldCheck} title={t('guardians.notEligibleTitle')} description={t('guardians.notEligibleBody')} />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-32 rounded-card" />
        </div>
      ) : (
        <div className="space-y-6">
          {guardians.length === 0 ? (
            invitation ? (
              <InvitationCard code={invitation.invite_code} name={invitation.guardian_name} />
            ) : (
              <InviteForm />
            )
          ) : (
            <>
              <GuardianList guardians={guardians} />
              <SharingList
                guardianUserId={guardians[0].userId}
                guardianName={guardians[0].displayName}
                matches={(connections?.matches ?? []).filter((m) => m.stage !== 'terminated')}
                shared={new Set((data?.sharedMatches ?? []).map((s) => s.matchId))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InviteForm() {
  const { t } = useTranslation();
  const invite = useInviteGuardian();
  const [relationship, setRelationship] = useState<Relationship>('father');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await invite.mutateAsync({
        relationship,
        name: name.trim() || undefined,
        email: contact.includes('@') ? contact.trim() : undefined,
        phone: contact.includes('@') ? undefined : contact.trim() || undefined,
      });
    } catch {
      setError(t('guardians.inviteError'));
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-brand-600" aria-hidden />
        <h2 className="font-display text-base font-semibold text-ink">{t('guardians.inviteTitle')}</h2>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-muted">{t('guardians.inviteBody')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('guardians.relationship')} htmlFor="relationship">
          <Select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as Relationship)}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {t(`guardians.rel.${r}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('guardians.name')} htmlFor="guardian_name">
          <Input
            id="guardian_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('guardians.namePlaceholder')}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label={t('guardians.contact')} htmlFor="guardian_contact">
            <Input
              id="guardian_contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('guardians.contactPlaceholder')}
            />
          </FormField>
        </div>
      </div>

      {error ? <p className="mt-4 text-xs text-danger">{error}</p> : null}

      <div className="mt-6">
        <Button onClick={submit} disabled={invite.isPending}>
          {t('guardians.invite')}
        </Button>
      </div>
    </Card>
  );
}

/** The code is hers to share — we never claim to have verified the relationship. */
function InvitationCard({ code, name }: { code: string; name: string | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-base font-semibold text-ink">{t('guardians.pendingTitle')}</h2>
        <Badge variant="warning">{t('guardians.pending')}</Badge>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-muted">{t('guardians.pendingBody', { name: name ?? t('guardians.yourGuardian') })}</p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-bg-3 p-4">
        <span className="font-mono text-lg font-semibold uppercase tracking-[0.2em] text-ink">{code}</span>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? t('guardians.copied') : t('guardians.copy')}
        </Button>
      </div>
    </Card>
  );
}

function GuardianList({ guardians }: { guardians: { userId: string; displayName: string | null; relationship: string; confirmed: boolean }[] }) {
  const { t } = useTranslation();
  return (
    <Card className="p-6">
      <h2 className="mb-4 font-display text-base font-semibold text-ink">{t('guardians.yourGuardians')}</h2>
      <ul className="space-y-3">
        {guardians.map((g) => (
          <li key={g.userId} className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-semibold text-brand-800">
              {(g.displayName?.[0] ?? '·').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{g.displayName ?? t('guardians.yourGuardian')}</p>
              <p className="text-xs text-muted">{t(`guardians.rel.${g.relationship}`, { defaultValue: g.relationship })}</p>
            </div>
            {g.confirmed ? <Badge variant="success">{t('guardians.confirmed')}</Badge> : null}
          </li>
        ))}
      </ul>
      {/* Decisions §9: the platform must never claim to have verified the relationship. */}
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-faint">{t('guardians.disclaimer')}</p>
    </Card>
  );
}

/** Per-connection sharing. This is the switch that unlocks the Family stage. */
function SharingList({
  guardianUserId,
  guardianName,
  matches,
  shared,
}: {
  guardianUserId: string;
  guardianName: string | null;
  matches: { id: string; stage: string; person: { displayName: string | null } | null }[];
  shared: Set<string>;
}) {
  const { t } = useTranslation();
  const setAccess = useSetMatchAccess();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (matchId: string, granted: boolean) => {
    setBusy(matchId);
    try {
      await setAccess.mutateAsync({ matchId, guardianUserId, granted });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-base font-semibold text-ink">{t('guardians.sharingTitle')}</h2>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        {t('guardians.sharingBody', { name: guardianName ?? t('guardians.yourGuardian') })}
      </p>

      {matches.length === 0 ? (
        <p className="text-sm text-muted">{t('guardians.noConnections')}</p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m, i) => {
            const on = shared.has(m.id);
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT, delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-line p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{m.person?.displayName ?? '—'}</p>
                  <p className="text-xs text-muted">{t(`match.stage.${m.stage}`, { defaultValue: m.stage })}</p>
                </div>
                <Button
                  variant={on ? 'ghost' : 'outline'}
                  disabled={busy === m.id}
                  onClick={() => toggle(m.id, !on)}
                  className={cn(on && 'text-brand-700')}
                >
                  {on ? t('guardians.revoke') : t('guardians.share')}
                </Button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
