import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_INOUT } from '@/lib/motion';

const AMIRI = { fontFamily: "'Amiri', serif" } as const;
const SIZE = 'clamp(1.9rem, 4vw, 4.25rem)';

/**
 * The Qur'anic verse on marital affection (Ar-Rum 30:21) flanking the card as
 * Amiri calligraphy — two words stacked on the left, two on the right, never
 * above/below/behind the card or clipped. Mobile recomposes it into two centered
 * lines near the top. Each word floats very slowly (transform + opacity only).
 * Decorative (aria-hidden). Exact text/diacritics preserved.
 */
export function CalligraphyVerse({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  const word = (text: string, pos: string, dur: number, delay: number) => (
    <motion.span
      dir="rtl"
      className={cn('text-gold-400 absolute whitespace-nowrap select-none', pos)}
      style={{ ...AMIRI, fontSize: SIZE }}
      animate={reduced ? undefined : { y: [0, -9, 0] }}
      transition={
        reduced ? undefined : { duration: dur, delay, ease: EASE_INOUT, repeat: Infinity }
      }
    >
      {text}
    </motion.span>
  );

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Desktop / laptop: two words left, two words right. */}
      <motion.div
        className="absolute inset-0 hidden lg:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: reduced ? 0.14 : [0.11, 0.16, 0.11] }}
        transition={
          reduced ? { duration: 1 } : { duration: 12, ease: EASE_INOUT, repeat: Infinity }
        }
      >
        {word('وَجَعَلَ', 'left-[5%] top-[26%]', 11, 0)}
        {word('بَيْنَكُم', 'left-[5%] top-[62%]', 13, 1.2)}
        {word('مَوَدَّةً', 'right-[5%] top-[26%]', 12, 0.6)}
        {word('وَرَحْمَةً', 'right-[5%] top-[62%]', 10.5, 1.8)}
      </motion.div>

      {/* Mobile: two centered lines near the top, smaller and fainter. */}
      <motion.p
        dir="rtl"
        className="text-gold-400 absolute inset-x-0 top-[3.5%] text-center leading-[1.7] select-none lg:hidden"
        style={{ ...AMIRI, fontSize: 'clamp(1.5rem, 6.5vw, 2rem)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduced ? 0.09 : [0.07, 0.11, 0.07] }}
        transition={
          reduced ? { duration: 1 } : { duration: 12, ease: EASE_INOUT, repeat: Infinity }
        }
      >
        وَجَعَلَ بَيْنَكُم
        <br />
        مَوَدَّةً وَرَحْمَةً
      </motion.p>
    </div>
  );
}
