import { HomeHero } from './HomeHero';
import { JourneyCard } from './JourneyCard';
import { HomeInsights } from './HomeInsights';
import { RevealOnScroll } from '@/components/motion/Reveal';

/**
 * Home is a premium landing-dashboard hybrid: an emotional hero with the page's
 * one signature move (the masked headline reveal), a single strong focal point
 * (the marriage-journey progress), then supporting insight cards that stagger in
 * on scroll. Calm everywhere except that one hero moment.
 */
export function HomePage() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <HomeHero />
      <RevealOnScroll>
        <JourneyCard />
      </RevealOnScroll>
      <HomeInsights />
    </div>
  );
}
