import React, { useEffect, useRef } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { ASSETS } from '../data/cafeData';
import { computeElsewhereScrollState } from '../utils/elsewhereHeroMath';

interface HeroSectionProps {
  onScrollToGateways: () => void;
  onEnterHallway: () => void;
  onIntroActiveChange?: (active: boolean) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onScrollToGateways,
  onEnterHallway,
  onIntroActiveChange,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const skyWrapRef = useRef<HTMLDivElement | null>(null);
  const grottoWrapRef = useRef<HTMLDivElement | null>(null);
  const copyWrapRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);

  const onIntroActiveChangeRef = useRef(onIntroActiveChange);
  onIntroActiveChangeRef.current = onIntroActiveChange;

  const pointerRef = useRef<{ tx: number; ty: number; cx: number; cy: number }>({
    tx: 0,
    ty: 0,
    cx: 0,
    cy: 0,
  });
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimerRef = useRef<number>(0);

  // Ensure Navbar stays cleanly visible on the Elsewhere scroll-driven hero
  useEffect(() => {
    onIntroActiveChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forcedProgressParam = params?.get('scrollProgress');
    const forcedProgress =
      forcedProgressParam !== null && forcedProgressParam !== '' && Number.isFinite(Number(forcedProgressParam))
        ? Math.max(0, Math.min(1, Number(forcedProgressParam)))
        : null;

    // Gentle 650ms copy entrance on initial load (scene & copy stay visible even if animations fail)
    if (!prefersReduced && forcedProgress === null && copyWrapRef.current) {
      copyWrapRef.current.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0px, 0)' },
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'backwards',
        }
      );
    }

    let rafId = 0;

    const computeCurrentProgress = (): number => {
      if (forcedProgress !== null) return forcedProgress;
      const el = sectionRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const maxScroll = Math.max(1, el.offsetHeight - window.innerHeight);
      return Math.max(0, Math.min(1, -rect.top / maxScroll));
    };

    const applyVisuals = () => {
      const isMobile = window.innerWidth < 768;
      const progress = computeCurrentProgress();
      const state = computeElsewhereScrollState(progress, isMobile, prefersReduced);

      const p = pointerRef.current;
      // Pause pointer drift while actively scrolling or on mobile
      const driftWeight = isMobile || prefersReduced || isScrollingRef.current || state.cleared ? 0 : 1;
      const driftX = p.cx * driftWeight;
      const driftY = p.cy * driftWeight;

      if (skyWrapRef.current) {
        skyWrapRef.current.style.transform = `translate3d(${(driftX * 0.55).toFixed(2)}px, ${(driftY * 0.55).toFixed(2)}px, 0) scale(${state.skyScale.toFixed(4)})`;
      }

      if (grottoWrapRef.current) {
        grottoWrapRef.current.style.transform = `translate3d(${(-driftX).toFixed(2)}px, ${(-driftY).toFixed(2)}px, 0) scale(${state.grottoScale.toFixed(4)})`;
        grottoWrapRef.current.style.opacity = state.grottoOpacity.toFixed(4);
        grottoWrapRef.current.style.visibility = state.grottoOpacity <= 0.005 ? 'hidden' : 'visible';
      }

      if (copyWrapRef.current) {
        copyWrapRef.current.style.opacity = state.copyOpacity.toFixed(4);
        copyWrapRef.current.style.transform = `translate3d(0, ${state.copyTranslateY.toFixed(2)}px, 0)`;
      }

      if (scrimRef.current) {
        scrimRef.current.style.opacity = state.scrimOpacity.toFixed(3);
      }

      if (cueRef.current) {
        const cueOpacity = Math.max(0, 1 - progress * 4.5);
        cueRef.current.style.opacity = cueOpacity.toFixed(3);
      }
    };

    const scheduleFrame = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const p = pointerRef.current;
        p.cx += (p.tx - p.cx) * 0.12;
        p.cy += (p.ty - p.cy) * 0.12;
        applyVisuals();
        if (Math.abs(p.tx - p.cx) > 0.06 || Math.abs(p.ty - p.cy) > 0.06) {
          scheduleFrame();
        }
      });
    };

    const onScroll = () => {
      isScrollingRef.current = true;
      window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
        scheduleFrame();
      }, 140);
      scheduleFrame();
    };

    const onResize = () => {
      applyVisuals();
    };

    applyVisuals();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(scrollTimerRef.current);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (window.innerWidth < 768 || isScrollingRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
    const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5;
    // Subtle desktop pointer drift strictly capped within ±6px
    pointerRef.current.tx = Math.max(-6, Math.min(6, nx * 11));
    pointerRef.current.ty = Math.max(-6, Math.min(6, ny * 9));
    // Trigger gentle settle via scroll event dispatch not needed — update inline smoothly
    if (grottoWrapRef.current && skyWrapRef.current) {
      window.requestAnimationFrame(() => {
        if (!sectionRef.current) return;
        const rect = sectionRef.current.getBoundingClientRect();
        const maxScroll = Math.max(1, sectionRef.current.offsetHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, -rect.top / maxScroll));
        const state = computeElsewhereScrollState(progress, false, false);
        const p = pointerRef.current;
        p.cx += (p.tx - p.cx) * 0.14;
        p.cy += (p.ty - p.cy) * 0.14;
        if (skyWrapRef.current) {
          skyWrapRef.current.style.transform = `translate3d(${(p.cx * 0.55).toFixed(2)}px, ${(p.cy * 0.55).toFixed(2)}px, 0) scale(${state.skyScale.toFixed(4)})`;
        }
        if (grottoWrapRef.current) {
          grottoWrapRef.current.style.transform = `translate3d(${(-p.cx).toFixed(2)}px, ${(-p.cy).toFixed(2)}px, 0) scale(${state.grottoScale.toFixed(4)})`;
        }
      });
    }
  };

  const handlePointerLeave = () => {
    pointerRef.current.tx = 0;
    pointerRef.current.ty = 0;
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Hopin Patio Cafe Courtyard Entry"
      data-testid="hopin-hero-section"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-[100svh] md:h-[170svh] bg-[#100D19] text-[#FFF5E9]"
    >
      {/* Full-bleed sticky 100svh stage scrubbed cleanly by native scroll on desktop */}
      <div className="relative md:sticky md:top-0 w-full h-[100svh] overflow-hidden bg-[#100D19]">
        {/* LAYER 1: Upscaled High-Resolution Hopin Patio Cafe Twilight Entrance Plate */}
        <div
          ref={skyWrapRef}
          data-testid="hero-upscaled-plate"
          className="absolute inset-0 z-[1] origin-center will-change-transform"
        >
          <img
            src={ASSETS.realGate}
            alt="Upscaled twilight entrance of Hopin Patio Cafe in New Palasia Indore showing the illuminated HOPIN pergola marquee, warm wooden Patio Cafe sign, terracotta brick pillars, and glowing open courtyard"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-[42%_46%]"
          />
          {/* Subtle atmospheric twilight depth & top nav legibility veil */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-[#100D19]/65 via-[#100D19]/20 to-transparent"
          />
        </div>

        {/* LAYER 2: Organic Mossy Terracotta Moon-Gate Grotto Foreground with Genuine Alpha Opening */}
        <div
          ref={grottoWrapRef}
          data-testid="hero-grotto-foreground"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] will-change-transform"
          style={{ transformOrigin: '49.7% 50.8%' }}
        >
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full block"
          >
            <defs>
              <filter id="hopin-grotto-feather" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
              <mask id="hopin-grotto-aperture">
                {/* White = solid carved stone & botanical foreground; Black = genuinely transparent opening */}
                <rect x="0" y="0" width="1600" height="900" fill="white" />
                <circle
                  cx="795"
                  cy="457"
                  r="252"
                  fill="black"
                  filter="url(#hopin-grotto-feather)"
                />
              </mask>
            </defs>
            <image
              href={ASSETS.archGrotto}
              x="0"
              y="0"
              width="1600"
              height="900"
              preserveAspectRatio="xMidYMid slice"
              mask="url(#hopin-grotto-aperture)"
            />
          </svg>
        </div>

        {/* Localized quiet lower-left scrim ensuring effortless headline contrast through every frame */}
        <div
          ref={scrimRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            background:
              'radial-gradient(72% 58% at 16% 92%, rgba(12, 10, 18, 0.9) 0%, rgba(12, 10, 18, 0.56) 56%, transparent 100%)',
          }}
        />

        {/* LAYER 3: Compact Lower-Left Instrument Serif Editorial Hero Block */}
        <div className="relative z-[4] w-full h-full flex flex-col justify-end px-5 sm:px-10 md:px-14 pb-10 sm:pb-12 md:pb-14">
          <div className="w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div ref={copyWrapRef} className="max-w-[540px]">
              <p className="font-sans-editorial text-[11px] uppercase tracking-[0.22em] text-[#E6CFA6]/95 mb-3">
                17/2 New Palasia · Indore · 1 PM – 11:30 PM
              </p>
              <h1 className="font-instrument-serif font-normal text-[48px] sm:text-[64px] md:text-[84px] lg:text-[98px] leading-[0.95] tracking-[-0.02em] text-[#FFF5E9]">
                Courtyards worth
                <br />
                lingering in.
              </h1>
              <p className="mt-4 font-sans-editorial font-normal text-[16px] sm:text-[17px] leading-[1.55] text-[#EDE3D6]/85 max-w-[40ch]">
                Hopin — Patio Cafe. A terracotta bungalow, breezy turquoise lounge, and twelve
                100% vegetarian culinary rooms.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
                <button
                  type="button"
                  data-testid="hero-explore-gates"
                  onClick={onScrollToGateways}
                  className="group inline-flex items-center gap-2 font-sans-editorial text-[15px] text-[#FFF5E9] border-b border-[#FFF5E9]/45 pb-1 hover:border-[#E6CFA6] hover:text-[#E6CFA6] transition-colors"
                >
                  Explore the 12 gates
                  <ArrowDown
                    className="w-4 h-4 stroke-[1.6] transition-transform duration-300 group-hover:translate-y-0.5"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={onEnterHallway}
                  className="group inline-flex items-center gap-2 font-sans-editorial text-[15px] text-[#FFF5E9]/76 hover:text-[#FFF5E9] transition-colors"
                >
                  Walk 3D Hallway
                  <ArrowRight
                    className="w-3.5 h-3.5 stroke-[1.6] transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Quiet scroll prompt on desktop bottom-right */}
            <div
              ref={cueRef}
              aria-hidden="true"
              className="hidden md:flex items-center gap-3 font-sans-editorial text-[11px] uppercase tracking-[0.26em] text-[#FFF5E9]/72 pb-1"
            >
              <span>Scroll to step inside</span>
              <ArrowDown className="w-3.5 h-3.5 stroke-[1.4]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
