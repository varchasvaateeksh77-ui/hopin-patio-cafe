import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  CAFE_INFO,
  DISHES,
  SUBCATEGORY_ROOMS,
  type DishItem,
  type SubcategoryRoom,
} from '../data/cafeData';
import { HOPIN_GOOGLE_REVIEW_URL } from '../utils/googleReviews';
import { ensureGsapRegistered, prefersReducedMotion } from '../utils/scrollChoreography';
import { HeroIntro3DOverlay } from './HeroIntro3DOverlay';
import { HeavenlyGatesSection } from './HeavenlyGatesSection';
import { BungalowShowcaseSection } from './BungalowShowcaseSection';
import { PatioMapSection } from './PatioMapSection';

interface LandingPageProps {
  replayIntroSignal: number;
  onEnterHallway: () => void;
  onEnterRoomDirectly: (roomId: string) => void;
  onOpenFullMenu: () => void;
  onHeroIntroActiveChange: (active: boolean) => void;
  onQuickAddDish: (dish: DishItem) => void;
}

const PATIO_PILLARS = [
  {
    index: '01',
    title: 'Heritage Bungalow Courtyard',
    detail:
      'A restored 17/2 New Palasia residence with brick-terracotta walls, open-air turquoise tables, and a shaded indoor teal espresso bar.',
  },
  {
    index: '02',
    title: '100% Vegetarian & Jain Craft',
    detail:
      'Every plate across all twelve culinary wings is freshly composed to order—from baked risottos and crispy lotus stem to slow-brewed Vietnamese cold coffee.',
  },
  {
    index: '03',
    title: 'Afternoon Sun to Midnight Glow',
    detail:
      'Open daily from 1:00 PM to 11:30 PM for quiet laptop coffees, unhurried courtyard lunches, and warm festoon-lit Indore evenings.',
  },
];

function getInitialIntroConfig(): { show: boolean; freezeAtMs: number | null } {
  if (typeof window === 'undefined') return { show: false, freezeAtMs: null };
  const params = new URLSearchParams(window.location.search);

  const heroEntryParam = params.get('heroEntryAt');
  if (heroEntryParam !== null && heroEntryParam !== '' && Number.isFinite(Number(heroEntryParam))) {
    return { show: true, freezeAtMs: Number(heroEntryParam) };
  }

  if (params.get('skipIntro') === '1' || params.get('openGate')) {
    return { show: false, freezeAtMs: null };
  }

  return { show: true, freezeAtMs: null };
}

export const LandingPage: React.FC<LandingPageProps> = ({
  replayIntroSignal,
  onEnterHallway,
  onEnterRoomDirectly,
  onOpenFullMenu,
  onHeroIntroActiveChange,
  onQuickAddDish,
}) => {
  const [introState, setIntroState] = useState<{
    show: boolean;
    freezeAtMs: number | null;
    runId: number;
  }>(() => {
    const init = getInitialIntroConfig();
    return { ...init, runId: 0 };
  });

  const pageRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const interludeRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  // Replay the 3D "H [◯] P I N" Colonnade Fly-Through whenever user clicks "Entry"
  useEffect(() => {
    if (replayIntroSignal > 0) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setIntroState((prev) => ({ show: true, freezeAtMs: null, runId: prev.runId + 1 }));
    }
  }, [replayIntroSignal]);

  // Ensure Navbar is visible when intro is not showing
  useEffect(() => {
    if (!introState.show) {
      onHeroIntroActiveChange(false);
    }
  }, [introState.show, onHeroIntroActiveChange]);

  // GSAP ScrollTrigger site-wide scroll progress hairline + Deep Emerald Interlude + Monumental Footer choreography
  useEffect(() => {
    ensureGsapRegistered();
    if (!pageRef.current || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // Smooth scrubbed architectural progress hairline pinned beneath the fixed navbar
      if (progressBarRef.current) {
        gsap.fromTo(
          progressBarRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: pageRef.current,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.25,
            },
          }
        );
      }

      // Deep Emerald Heritage Interlude reveals
      if (interludeRef.current) {
        gsap.from('.interlude-brass-rule', {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 1.0,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: interludeRef.current,
            start: 'top 82%',
            once: true,
          },
        });

        gsap.from('.interlude-reveal', {
          y: 38,
          opacity: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: interludeRef.current,
            start: 'top 80%',
            once: true,
          },
        });
      }

      // Monumental Sculptural Footer wordmark reveal
      if (footerRef.current) {
        gsap.from('.footer-monolith-word', {
          yPercent: 48,
          opacity: 0,
          duration: 1.0,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
            once: true,
          },
        });

        gsap.from('.footer-col-reveal', {
          y: 26,
          opacity: 0,
          duration: 0.8,
          stagger: 0.09,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 86%',
            once: true,
          },
        });
      }
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStepThroughGateway = (room: SubcategoryRoom) => {
    onEnterRoomDirectly(room.id);
  };

  const directionsUrl = CAFE_INFO.directionsUrl;

  return (
    <div ref={pageRef} className="min-h-screen bg-[#F9F2E9] text-[#3E3A3C] overflow-x-clip">
      {/* GSAP Scrubbed Architectural Scroll Progress Hairline */}
      <div
        aria-hidden="true"
        className="fixed top-[56px] inset-x-0 z-30 h-[2px] pointer-events-none bg-transparent"
      >
        <div
          ref={progressBarRef}
          data-testid="gsap-scroll-progress"
          className="h-full w-full origin-left bg-[#B84C2E] will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {/* FULL-SCREEN 3D ARCHITECTURAL "H [◯] P I N" ENTRY FLY-THROUGH */}
      {introState.show && (
        <HeroIntro3DOverlay
          key={introState.runId}
          freezeAtMs={introState.freezeAtMs}
          onNavHiddenChange={onHeroIntroActiveChange}
          onComplete={() => {
            setIntroState((prev) => ({ ...prev, show: false, freezeAtMs: null }));
            onHeroIntroActiveChange(false);
          }}
        />
      )}

      {/* ACT 1 — GATES OF HEAVEN (BUNTO°-FAITHFUL ROTATING 6-PIECE RING ACROSS ALL 12 WINGS) */}
      <HeavenlyGatesSection
        onStepThroughGate={handleStepThroughGateway}
        onEnterHallway={onEnterHallway}
        onOpenFullMenu={onOpenFullMenu}
        onQuickAddDish={onQuickAddDish}
      />

      {/* ACT 2 — INSIDE THE REAL BUNGALOW (GSAP PARALLAX & CURTAIN WIPE SPREAD) */}
      <BungalowShowcaseSection
        onEnterHallway={onEnterHallway}
        onOpenFullMenu={onOpenFullMenu}
        onQuickAddDish={onQuickAddDish}
      />

      {/* ACT 2.5 — DEEP EMERALD ARCHITECTURAL INTERLUDE (ECHOING THE 3D COLONNADE) */}
      <section
        ref={interludeRef}
        aria-labelledby="patio-rhythm-heading"
        data-testid="patio-rhythm-interlude"
        className="relative py-20 md:py-28 px-5 sm:px-8 md:px-12 bg-[#0D1F1E] text-[#F9F2E9]"
      >
        <div className="max-w-[1360px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10">
            <div className="max-w-2xl">
              <p className="interlude-reveal font-bunto text-[10px] font-medium uppercase tracking-[0.3em] text-[#D99B4E] mb-3">
                The Patio Rhythm · Indore
              </p>
              <h2
                id="patio-rhythm-heading"
                className="interlude-reveal font-bunto font-medium text-[30px] sm:text-[42px] md:text-[50px] leading-[1.04] tracking-[-0.03em] text-[#FAF6EE] text-balance"
              >
                Twelve rooms of flavour,{' '}
                <span className="font-serif-editorial italic font-normal text-[#E6B87A]">
                  one sunlit bungalow.
                </span>
              </h2>
            </div>

            <div className="interlude-reveal flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onEnterHallway}
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#D99B4E] text-[#0D1F1E] font-bunto text-[10.5px] font-semibold uppercase tracking-[0.22em] hover:bg-[#FAF6EE] transition-colors whitespace-nowrap"
              >
                Enter 3D Hallway
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={onOpenFullMenu}
                className="px-5 py-3.5 rounded-full border border-[#FAF6EE]/25 text-[#FAF6EE] font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em] hover:border-[#D99B4E] hover:text-[#E6B87A] transition-colors whitespace-nowrap"
              >
                All {DISHES.length} Dishes
              </button>
            </div>
          </div>

          <div
            className="interlude-brass-rule h-[1px] w-full bg-[#D99B4E]/35"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 pt-10 md:pt-12">
            {PATIO_PILLARS.map((pillar) => (
              <div key={pillar.index} className="interlude-reveal flex flex-col">
                <span className="font-bunto font-extralight text-[38px] sm:text-[46px] leading-none tracking-[-0.04em] text-[#D99B4E]/80 tabular-nums">
                  {pillar.index}
                </span>
                <h3 className="font-bunto font-medium text-[18px] sm:text-[19px] tracking-[-0.015em] text-[#FAF6EE] mt-4">
                  {pillar.title}
                </h3>
                <p className="font-bunto text-[14px] leading-[1.7] text-[#F9F2E9]/72 mt-2.5 max-w-[38ch]">
                  {pillar.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACT 3 — VISIT THE BUNGALOW (REAL LIVE GOOGLE MAPS PLATFORM INTEGRATION) */}
      <PatioMapSection />

      {/* ACT 4 — MONUMENTAL ARCHITECTURAL FOOTER */}
      <footer
        ref={footerRef}
        className="pt-16 md:pt-24 pb-12 px-5 sm:px-8 md:px-12 bg-[#1A1819] text-[#F9F2E9]/82 border-t border-[#E6D9D2]/12"
      >
        <div className="max-w-[1360px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-14 border-b border-[#F9F2E9]/14">
            <div className="footer-col-reveal md:col-span-5">
              <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.28em] text-[#D99B4E] mb-3">
                17/2 New Palasia · Indore
              </p>
              <p className="font-serif-editorial italic text-[24px] sm:text-[28px] leading-[1.25] text-[#FAF6EE] max-w-[26ch]">
                An everyday sanctuary for courtyard coffee &amp; vegetarian craft.
              </p>
              <p className="font-bunto text-[13px] text-[#F9F2E9]/60 mt-4 tabular-nums">
                {CAFE_INFO.address}
                <br />
                Open Daily · 1:00 PM – 11:30 PM
              </p>
            </div>

            <div className="footer-col-reveal md:col-span-4">
              <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.26em] text-[#F9F2E9]/48 mb-4">
                Navigate
              </p>
              <nav
                aria-label="Footer navigation"
                className="grid grid-cols-2 gap-y-3 gap-x-6 font-bunto text-[11.5px] font-medium uppercase tracking-[0.2em]"
              >
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                    setIntroState((prev) => ({
                      show: true,
                      freezeAtMs: null,
                      runId: prev.runId + 1,
                    }));
                  }}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  Replay 3D Entry
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('gateways-section')}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  12 Gates
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('vibe-section')}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  The Bungalow
                </button>
                <button
                  type="button"
                  onClick={onEnterHallway}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  3D Hallway
                </button>
                <button
                  type="button"
                  onClick={onOpenFullMenu}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  Full Menu
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('visit-section')}
                  className="text-left text-[#F9F2E9]/78 hover:text-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  Live Map
                </button>
              </nav>
            </div>

            <div className="footer-col-reveal md:col-span-3 flex flex-col items-start md:items-end justify-between gap-4">
              <div className="flex flex-col items-start md:items-end gap-3">
                <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.26em] text-[#F9F2E9]/48">
                  Direct Links
                </p>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bunto text-[11px] font-medium uppercase tracking-[0.2em] text-[#FAF6EE] border-b border-[#FAF6EE]/40 pb-1 hover:text-[#D99B4E] hover:border-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  Google Directions
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
                <a
                  href={HOPIN_GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bunto text-[11px] font-medium uppercase tracking-[0.2em] text-[#F9F2E9]/75 border-b border-[#FAF6EE]/25 pb-1 hover:text-[#D99B4E] hover:border-[#D99B4E] transition-colors whitespace-nowrap"
                >
                  Leave a Google Review
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Monumental Architectural Signature */}
          <div className="pt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="overflow-hidden pt-4">
              <p className="footer-monolith-word font-bunto font-bold text-[clamp(54px,11vw,138px)] leading-[0.94] tracking-[-0.05em] text-[#FAF6EE] select-none">
                HOPIN
                <sup className="text-[0.38em] font-medium align-[0.76em] ml-[0.04em] text-[#B84C2E]">
                  °
                </sup>
              </p>
            </div>
            <p className="font-bunto text-[11.5px] text-[#F9F2E9]/50 tabular-nums pb-1">
              {SUBCATEGORY_ROOMS.length} Culinary Wings · {DISHES.length} Vegetarian Dishes · Indore
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
