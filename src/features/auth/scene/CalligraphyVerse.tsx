import { cn } from '@/utils/cn';

const AMIRI = { fontFamily: "'Amiri', serif" } as const;
const SIZE = 'clamp(1.9rem, 4vw, 4.25rem)';

/**
 * The Qur'anic verse on marital affection (Ar-Rum 30:21) flanking the card as Amiri
 * calligraphy. Reading RTL, the verse begins on the RIGHT (وَجَعَلَ بَيْنَكُم) and
 * continues on the LEFT (مَوَدَّةً وَرَحْمَةً), so the eye follows it in reading order.
 *
 * Static by design. It used to float each word and pulse the whole verse's opacity
 * forever — a frame budget the login screen could not spare. It also sat near invisible in
 * light mode (faint gold on a light ground), so light and dark now carry their own
 * opacity, stronger in light, via a `dark:` override. Decorative (aria-hidden); exact
 * text and diacritics preserved.
 */
export function CalligraphyVerse({ className }: { className?: string }) {
  const word = (text: string, pos: string) => (
    <span
      dir="rtl"
      className={cn('text-gold-500 dark:text-gold-400 absolute whitespace-nowrap select-none', pos)}
      style={{ ...AMIRI, fontSize: SIZE }}
    >
      {text}
    </span>
  );

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Desktop / laptop — clearer in light mode, softer in dark. */}
      <div className="absolute inset-0 hidden opacity-30 lg:block dark:opacity-[0.15]">
        {/* Verse begins on the right… */}
        {word('وَجَعَلَ', 'right-[5%] top-[26%]')}
        {word('بَيْنَكُم', 'right-[5%] top-[62%]')}
        {/* …and continues on the left. */}
        {word('مَوَدَّةً', 'left-[5%] top-[26%]')}
        {word('وَرَحْمَةً', 'left-[5%] top-[62%]')}
      </div>

      {/* Mobile: two centered lines near the top. */}
      <p
        dir="rtl"
        className="text-gold-500 dark:text-gold-400 absolute inset-x-0 top-[3.5%] text-center leading-[1.7] opacity-20 select-none lg:hidden dark:opacity-[0.1]"
        style={{ ...AMIRI, fontSize: 'clamp(1.5rem, 6.5vw, 2rem)' }}
      >
        وَجَعَلَ بَيْنَكُم
        <br />
        مَوَدَّةً وَرَحْمَةً
      </p>
    </div>
  );
}
