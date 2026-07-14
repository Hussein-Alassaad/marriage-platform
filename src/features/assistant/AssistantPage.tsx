import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MessageSquarePlus, Send, Sparkles, Trash2 } from 'lucide-react';

import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { useLanguage } from '@/hooks/useLanguage';
import { useAskAssistant, useChatMessages, useChats, useDeleteChat } from '@/hooks/useAssistant';

/** Openers, not answers — they fill the box; the member edits and sends in their own words. */
const PROMPTS = ['prepare', 'questions', 'family', 'profile', 'wedding'];

/**
 * The Marriage Assistant.
 *
 * It knows the member's own profile and journey stage, and nothing whatsoever about the
 * other person — not their profile, not their messages, not their finances. That is not a
 * prompt instruction that can be argued with; the information is simply never sent.
 *
 * When there is no funded API key (or an admin has switched it off), the page says so
 * plainly instead of offering a chat box that answers every question with an error.
 */
export function AssistantPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: list, isLoading } = useChats();
  const [chatId, setChatId] = useState<string | null>(null);
  const { data: messages } = useChatMessages(chatId);
  const ask = useAskAssistant();
  const remove = useDeleteChat();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ask.isPending]);

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />
        <Skeleton className="rounded-card h-96" />
      </div>
    );
  }

  if (!list?.enabled) {
    return (
      <div>
        <PageHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />
        <EmptyState
          icon={Sparkles}
          title={t('assistant.disabled.title')}
          description={t('assistant.disabled.body')}
        />
      </div>
    );
  }

  const limitReached = list.limit > 0 && list.usedToday >= list.limit && !chatId;

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setError(null);
    setText('');
    try {
      const result = await ask.mutateAsync({
        text: value,
        locale: language,
        chatId: chatId ?? undefined,
      });
      setChatId(result.chatId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'assistant_failed';
      setError(t(`assistant.error.${message}`, { defaultValue: t('assistant.error.generic') }));
      setText(value); // never lose what they typed
    }
  };

  return (
    <div>
      <PageHeader
        title={t('assistant.title')}
        subtitle={t('assistant.subtitle')}
        eyebrow={t('assistant.eyebrow')}
        actions={
          <Button variant="outline" onClick={() => setChatId(null)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            {t('assistant.newChat')}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          {list.limit > 0 ? (
            <p className="text-faint px-1 text-xs">
              {t('assistant.remaining', { used: list.usedToday, limit: list.limit })}
            </p>
          ) : null}

          {list.chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex items-center gap-1 rounded-xl px-3 py-2 transition-colors',
                chatId === chat.id ? 'bg-brand-wash' : 'hover:bg-bg-3',
              )}
            >
              <button
                type="button"
                onClick={() => setChatId(chat.id)}
                className="text-ink-soft min-w-0 flex-1 truncate text-start text-sm"
              >
                {chat.title ?? t('assistant.untitled')}
              </button>
              <button
                type="button"
                aria-label={t('assistant.deleteChat')}
                onClick={() => {
                  remove.mutate(chat.id);
                  if (chatId === chat.id) setChatId(null);
                }}
                className="text-faint hover:text-danger rounded-md p-1 opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </aside>

        <Card className="flex h-[36rem] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!messages?.length ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="text-brand-500 mb-4 h-8 w-8" aria-hidden />
                <p className="text-ink mb-1 font-medium">{t('assistant.greeting')}</p>
                <p className="text-muted mb-6 max-w-sm text-sm">{t('assistant.privacyNote')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {PROMPTS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setText(t(`assistant.prompt.${key}`));
                        inputRef.current?.focus();
                      }}
                      className="border-line text-ink-soft hover:border-brand-400 hover:bg-brand-wash rounded-full border px-3.5 py-1.5 text-sm transition-colors"
                    >
                      {t(`assistant.prompt.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: EASE_OUT }}
                  className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'user' ? 'bg-brand-500 text-on-brand' : 'bg-bg-3 text-ink',
                    )}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))
            )}

            {ask.isPending ? (
              <div className="flex justify-start">
                <div className="bg-bg-3 text-muted rounded-2xl px-4 py-2.5 text-sm">
                  {t('assistant.thinking')}
                </div>
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="border-line border-t p-4">
            {error ? (
              <div className="mb-3">
                <Alert>{error}</Alert>
              </div>
            ) : null}

            {limitReached ? (
              <p className="text-muted text-center text-sm">
                {t('assistant.limitReached', { limit: list.limit })}
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={t('assistant.placeholder')}
                  className="border-line bg-surface text-ink placeholder:text-faint focus-visible:border-brand-400 max-h-32 min-h-[3rem] flex-1 resize-none rounded-xl border px-3.5 py-3 text-sm focus-visible:outline-none"
                />
                <Button onClick={send} disabled={!text.trim() || ask.isPending}>
                  <Send className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
