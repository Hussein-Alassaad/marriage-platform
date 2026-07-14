import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';
import { useQueryClient } from '@tanstack/react-query';
import { useSuggestions } from '@/hooks/useChat';

interface SuggestionChipsProps {
  matchId: string;
  stage: string | undefined;
  messageCount: number;
  onPick: (text: string) => void;
}

/**
 * "What do I even say?" is the hardest moment of a supervised introduction, so the AI
 * offers a few things to say next — grounded in both profiles and in what has already
 * been said, and appropriate to the stage.
 *
 * Picking one FILLS the composer, it does not send. The member always edits and sends
 * in their own words, and the message still passes the full moderation gate — a
 * suggestion is a starting point, never a bypass.
 */
export function SuggestionChips({ matchId, stage, messageCount, onPick }: SuggestionChipsProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  const enabled = Boolean(stage && stage !== 'terminated' && stage !== 'interest_sent');
  const { data, isFetching } = useSuggestions(matchId, i18n.language, messageCount, enabled);

  // The AI is a convenience here, not a gate: if it's unavailable we still help, with a
  // curated set written for this stage rather than an error message.
  const fallback = t(`chat.suggest.fallback.${stage ?? 'introduction'}`, {
    returnObjects: true,
    defaultValue: [],
  }) as string[];
  const suggestions = data?.length ? data : Array.isArray(fallback) ? fallback : [];

  if (!enabled || suggestions.length === 0) return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['suggestions', matchId] });
  };

  return (
    <div className="border-line mb-3 border-b pb-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="text-brand-500 h-3.5 w-3.5" aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted hover:text-ink flex items-center gap-1 text-xs font-medium transition-colors"
          aria-expanded={open}
        >
          {t('chat.suggest.title')}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {data?.length ? (
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            aria-label={t('chat.suggest.refresh')}
            className="text-muted hover:text-ink ms-auto transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden />
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
            className="flex flex-wrap gap-2 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <motion.button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT, delay: i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                className="border-line bg-surface text-ink-soft hover:border-brand-400 hover:bg-brand-wash hover:text-ink max-w-full rounded-full border px-3.5 py-2 text-start text-[13px] leading-snug transition-colors"
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
