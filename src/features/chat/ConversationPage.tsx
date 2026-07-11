import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/utils/cn';
import { EASE_EXPO } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { useSettings } from '@/hooks/useSettings';
import { chatService } from '@/services/chatService';
import { useConversationId, useMessages, useSendText, useSentCount } from '@/hooks/useChat';

const MESSAGING_STAGES = new Set(['introduction', 'serious_communication', 'family', 'married']);

export function ConversationPage() {
  const { t } = useTranslation();
  const { matchId = '' } = useParams();
  const location = useLocation();
  const { user } = useSession();
  const uid = user?.id;
  const { number } = useSettings();

  const person = (location.state as { person?: { displayName?: string | null } } | null)?.person ?? null;

  const matchQuery = useQuery({ queryKey: ['match', matchId], queryFn: () => chatService.getMatch(matchId), enabled: Boolean(matchId) });
  const stage = matchQuery.data?.stage;
  const { data: conversationId } = useConversationId(matchId);
  const { data: messages, isLoading } = useMessages(conversationId);
  const { data: sentCount } = useSentCount(conversationId);
  const send = useSendText(matchId);

  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length]);

  const canMessage = stage ? MESSAGING_STAGES.has(stage) : true;
  const cap = number('intro_messages_per_person', 10);
  const remaining = stage === 'introduction' ? Math.max(0, cap - (sentCount ?? 0)) : null;

  const onSend = async () => {
    const value = text.trim();
    if (!value || send.isPending) return;
    setNotice(null);
    try {
      const r = await send.mutateAsync(value);
      if (r.blocked) {
        setNotice(r.category === 'quota' ? t('chat.quotaReached') : t('chat.contactBlocked'));
        return;
      }
      setText('');
    } catch {
      setNotice(t('chat.sendError'));
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={ROUTES.match}
          aria-label={t('common.back')}
          className="grid h-10 w-10 place-items-center rounded-md text-muted transition-colors hover:bg-bg-3 hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        </Link>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-lg font-semibold text-brand-800">
          {(person?.displayName?.[0] ?? '·').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold text-ink">
            {person?.displayName ?? t('chat.conversation')}
          </h1>
          {stage ? <p className="text-xs text-muted">{t(`match.stage.${stage}`, { defaultValue: stage })}</p> : null}
        </div>
        {remaining != null ? (
          <Badge variant="gold">{t('chat.messagesLeft', { count: remaining })}</Badge>
        ) : null}
      </div>

      {/* Messages */}
      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-2/3 rounded-2xl" />
              <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
            </>
          ) : (messages ?? []).length === 0 ? (
            <EmptyState icon={ShieldCheck} title={t('chat.emptyTitle')} description={t('chat.emptyBody')} />
          ) : (
            (messages ?? []).map((m) => {
              const mine = m.sender_id === uid;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: EASE_EXPO }}
                  className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                >
                  <span
                    className={cn(
                      'max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      mine
                        ? 'rounded-tr-md bg-brand-wash text-ink ring-1 ring-inset ring-[color:var(--color-border-accent)]'
                        : 'rounded-tl-md bg-bg-3 text-ink-soft',
                    )}
                  >
                    {m.body}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line p-3">
          {notice ? <p className="mb-2 px-1 text-xs text-danger">{notice}</p> : null}
          {canMessage ? (
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={t('chat.placeholder')}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)]"
              />
              <Button onClick={onSend} disabled={send.isPending || !text.trim()} aria-label={t('chat.send')} className="!px-4">
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              </Button>
            </div>
          ) : (
            <p className="px-1 py-2 text-center text-sm text-muted">{t('chat.notAvailable')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
