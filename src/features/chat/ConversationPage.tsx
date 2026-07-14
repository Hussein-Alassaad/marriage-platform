import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { chatService, type ChatMessage } from '@/services/chatService';
import {
  useConversationId,
  useMessages,
  useSendImage,
  useSendText,
  useSendVoice,
  useSentCount,
} from '@/hooks/useChat';
import { JourneyPanel } from '@/features/chat/JourneyPanel';
import { VoiceRecorder } from '@/features/chat/VoiceRecorder';
import { VoiceBubble } from '@/features/chat/VoiceBubble';
import { MediaComposer } from '@/features/chat/MediaComposer';
import { MediaBubble } from '@/features/chat/MediaBubble';
import { SuggestionChips } from '@/features/chat/SuggestionChips';

const MESSAGING_STAGES = new Set(['introduction', 'serious_communication', 'family', 'married']);
/** Introduction is text only; voice arrives with the Serious stage (Part D). */
const VOICE_STAGES = new Set(['serious_communication', 'family', 'married']);
/** Images and videos wait for the Family stage, when the guardian is present. */
const MEDIA_STAGES = new Set(['family', 'married']);

export function ConversationPage() {
  const { t } = useTranslation();
  const { matchId = '' } = useParams();
  const location = useLocation();
  const { user } = useSession();
  const uid = user?.id;
  const { number, bool } = useSettings();
  const queryClient = useQueryClient();

  const person =
    (location.state as { person?: { displayName?: string | null } } | null)?.person ?? null;

  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => chatService.getMatch(matchId),
    enabled: Boolean(matchId),
  });
  const stage = matchQuery.data?.stage;
  const { data: conversationId } = useConversationId(matchId);
  const { data: messages, isLoading } = useMessages(conversationId);
  const { data: sentCount } = useSentCount(conversationId);
  const send = useSendText(matchId);
  const sendVoice = useSendVoice(matchId);
  const sendImage = useSendImage(matchId);

  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length]);

  const canMessage = stage ? MESSAGING_STAGES.has(stage) : true;
  const cap = number('intro_messages_per_person', 10);
  const remaining = stage === 'introduction' ? Math.max(0, cap - (sentCount ?? 0)) : null;

  const voiceAllowed = Boolean(stage && VOICE_STAGES.has(stage)) && bool('voice_enabled');
  const voiceMaxSeconds = number('voice_max_seconds', 120);
  const mediaAllowed = Boolean(stage && MEDIA_STAGES.has(stage)) && bool('media_enabled');

  const onSendVoice = async (audio: Blob, durationMs: number) => {
    setNotice(null);
    setNoticeDetail(null);
    const r = await sendVoice.mutateAsync({ audio, durationMs });
    if (r.blocked) setNotice(blockedNotice(r.category));
  };

  const onSendImage = async (file: File) => {
    setNotice(null);
    setNoticeDetail(null);
    const r = await sendImage.mutateAsync(file);
    if (r.blocked) setNotice(blockedNotice(r.category));
  };

  const blockedNotice = (category?: string) => {
    if (category === 'quota') return t('chat.quotaReached');
    if (category === 'contact_info') return t('chat.contactBlocked');
    if (category === 'too_soon') return t('chat.blockedTooSoon');
    if (category === 'haram_meeting') return t('chat.blockedMeeting');
    if (category === 'scam') return t('chat.blockedScam');
    if (category === 'unavailable') return t('chat.moderationUnavailable');
    return t('chat.blockedInappropriate');
  };

  const onSend = async () => {
    const value = text.trim();
    if (!value || send.isPending) return;
    setNotice(null);
    setNoticeDetail(null);

    // Optimistic: show the message immediately, reconcile with the server after.
    const cid = conversationId ?? null;
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: uid ?? '',
      type: 'text',
      body: value,
      transcript: null,
      media_path: null,
      created_at: new Date().toISOString(),
    };
    const rollback = () => {
      if (cid)
        queryClient.setQueryData<ChatMessage[]>(['messages', cid], (old) =>
          (old ?? []).filter((m) => m.id !== temp.id),
        );
    };
    if (cid)
      queryClient.setQueryData<ChatMessage[]>(['messages', cid], (old) => [...(old ?? []), temp]);
    setText('');

    try {
      const r = await send.mutateAsync(value);
      if (r.blocked) {
        rollback();
        setText(value);
        setNotice(blockedNotice(r.category));
        // Only set when the moderator itself failed — surfacing it is the difference
        // between a fixable problem and a mystery.
        setNoticeDetail(r.detail ?? null);
        if (r.detail) console.error('moderation unavailable:', r.detail);
      }
      // On success the mutation invalidates the messages query → temp is replaced.
    } catch {
      rollback();
      setText(value);
      setNotice(t('chat.sendError'));
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={ROUTES.match}
          aria-label={t('common.back')}
          className="text-muted hover:bg-bg-3 hover:text-ink grid h-10 w-10 place-items-center rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        </Link>
        <span className="from-brand-100 to-brand-200 text-brand-800 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-lg font-semibold">
          {(person?.displayName?.[0] ?? '·').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-ink truncate text-lg font-semibold">
            {person?.displayName ?? t('chat.conversation')}
          </h1>
          {stage ? (
            <p className="text-muted text-xs">
              {t(`match.stage.${stage}`, { defaultValue: stage })}
            </p>
          ) : null}
        </div>
        {remaining != null ? (
          <Badge variant="gold">{t('chat.messagesLeft', { count: remaining })}</Badge>
        ) : null}
      </div>

      {/* Journey: mutual consent to advance, or end the connection */}
      <JourneyPanel matchId={matchId} personName={person?.displayName} />

      {/* Messages */}
      <Card className="flex flex-col overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-[58vh] min-h-[440px] flex-1 space-y-3 overflow-y-auto p-5"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-2/3 rounded-2xl" />
              <Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" />
            </>
          ) : (messages ?? []).length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={t('chat.emptyTitle')}
              description={t('chat.emptyBody')}
            />
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
                      'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                      mine
                        ? 'bg-brand-wash text-ink rounded-tr-md ring-1 ring-[color:var(--color-border-accent)] ring-inset'
                        : 'bg-bg-3 text-ink-soft rounded-tl-md',
                    )}
                  >
                    {m.type === 'voice' ? (
                      <VoiceBubble messageId={m.id} transcript={m.transcript} />
                    ) : m.type === 'image' || m.type === 'video' ? (
                      <MediaBubble messageId={m.id} kind={m.type} />
                    ) : (
                      m.body
                    )}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="border-line border-t p-3">
          {notice ? (
            <div className="mb-2 px-1">
              <p className="text-danger text-xs">{notice}</p>
              {noticeDetail ? (
                <p className="text-faint mt-0.5 font-mono text-[11px] leading-snug break-all">
                  {noticeDetail}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Voice unlocks at the Serious stage (Part D) — and only once an STT
              provider is configured, which the admin flag reflects. */}
          {canMessage && voiceAllowed ? (
            <div className="border-line mb-3 border-b pb-3">
              <VoiceRecorder maxSeconds={voiceMaxSeconds} onSend={onSendVoice} />
            </div>
          ) : null}

          {canMessage && mediaAllowed ? (
            <div className="border-line mb-3 border-b pb-3">
              <MediaComposer onSendImage={onSendImage} disabled={sendImage.isPending} />
            </div>
          ) : null}

          {/* Ideas for what to say next. Picking one fills the box — it never sends. */}
          {canMessage ? (
            <SuggestionChips
              matchId={matchId}
              stage={stage}
              messageCount={messages?.length ?? 0}
              onPick={(s) => {
                setText(s);
                composerRef.current?.focus();
              }}
            />
          ) : null}

          {canMessage ? (
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
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
                className="border-line bg-surface text-ink placeholder:text-faint focus-visible:border-brand-400 max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-[15px] focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)] focus-visible:outline-none"
              />
              <Button
                onClick={onSend}
                disabled={send.isPending || !text.trim()}
                aria-label={t('chat.send')}
                className="!px-4"
              >
                <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              </Button>
            </div>
          ) : (
            <p className="text-muted px-1 py-2 text-center text-sm">{t('chat.notAvailable')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
