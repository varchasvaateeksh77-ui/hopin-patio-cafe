import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, Plus, Check } from 'lucide-react';
import { CAFE_INFO, DISHES, SHEETS, type DishItem } from '../data/cafeData';
import { flyDishToBag } from '../utils/flyToBag';
import { formatINR, getResponsiveCropStyle } from '../utils/galleryMath';
import { ensureGsapRegistered, prefersReducedMotion } from '../utils/scrollChoreography';

interface BungalowShowcaseSectionProps {
  onEnterHallway: () => void;
  onOpenFullMenu: () => void;
  onQuickAddDish: (dish: DishItem) => void;
}

// Curated culinary wings paired to each real space inside 17/2 New Palasia (100% vegetarian, zero pizzas)
const SPACE_PAIRING_ROOMS: [string, string, string][] = [
  ['continental', 'pasta', 'desserts-bowls'], // Arrival: Mezze Platter, Baked Risotto, Dessert
  ['asian-starters', 'toasts-sandwiches', 'chillers-shakes'], // Courtyard: Asian Starter, Sourdough Toast, Chiller
  ['coffee-bar', 'hot-coffee-chai', 'smoothies-bowls'], // Espresso Bar: Cold Coffee, Hot Espresso/Chai, Smoothie Bowl
];

function getSpaceSignatureDishes(spaceIdx: number): DishItem[] {
  const roomIds = SPACE_PAIRING_ROOMS[spaceIdx] ?? SPACE_PAIRING_ROOMS[0];
  const matched: DishItem[] = [];
  for (const roomId of roomIds) {
    const dish = DISHES.find((d) => d.roomId === roomId && !matched.some((m) => m.id === d.id));
    if (dish) matched.push(dish);
  }
  return matched;
}

export const BungalowShowcaseSection: React.FC<BungalowShowcaseSectionProps> = ({
  onEnterHallway,
  onOpenFullMenu,
  onQuickAddDish,
}) => {
  const spaces = CAFE_INFO.spaces;
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [addedDishId, setAddedDishId] = useState<string | null>(null);
  const directionRef = useRef<number>(1);

  const sectionRef = useRef<HTMLElement | null>(null);
  const ribbonTrackRef = useRef<HTMLDivElement | null>(null);
  const photoParallaxRef = useRef<HTMLDivElement | null>(null);
  const incomingImgWrapRef = useRef<HTMLDivElement | null>(null);
  const incomingImgRef = useRef<HTMLImageElement | null>(null);
  const narrativeBlockRef = useRef<HTMLDivElement | null>(null);
  const dishRailRef = useRef<HTMLDivElement | null>(null);
  const dishThumbRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dishBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const clearPrevTimerRef = useRef<number | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  const activeSpace = spaces[activeIndex] ?? spaces[0];
  const prevSpace = prevIndex !== null ? spaces[prevIndex] : null;
  const pairedDishes = useMemo(() => getSpaceSignatureDishes(activeIndex), [activeIndex]);

  useEffect(() => {
    return () => {
      if (clearPrevTimerRef.current) window.clearTimeout(clearPrevTimerRef.current);
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  // GSAP ScrollTrigger choreography: kinetic marquee scrub, masked header reveals,
  // scrubbed architectural photo parallax, and staggered 3-column dish showcase
  useEffect(() => {
    ensureGsapRegistered();
    if (!sectionRef.current || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // Scrubbed editorial marquee ribbon bridging Act 1 (12 Gates) -> Act 2 (Bungalow)
      if (ribbonTrackRef.current) {
        gsap.fromTo(
          ribbonTrackRef.current,
          { xPercent: 0 },
          {
            xPercent: -18,
            ease: 'none',
            scrollTrigger: {
              trigger: ribbonTrackRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.7,
            },
          }
        );
      }

      // Hairline draw across the 1360px header
      gsap.from('.bungalow-rule', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.bungalow-header',
          start: 'top 84%',
          once: true,
        },
      });

      // Masked header headline + numeral reveal
      gsap.from('.bungalow-head-reveal', {
        yPercent: 105,
        opacity: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.bungalow-header',
          start: 'top 84%',
          once: true,
        },
      });

      // Architectural stage reveal
      gsap.from('.bungalow-stage-shell', {
        y: 48,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.bungalow-stage-shell',
          start: 'top 84%',
          once: true,
        },
      });

      // Scrubbed vertical parallax inside the monumental bungalow photo stage
      if (photoParallaxRef.current) {
        gsap.fromTo(
          photoParallaxRef.current,
          { yPercent: -6, scale: 1.1 },
          {
            yPercent: 6,
            scale: 1.03,
            ease: 'none',
            scrollTrigger: {
              trigger: '.bungalow-stage-shell',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.65,
            },
          }
        );
      }

      // Staggered chapter index rows
      gsap.from('.bungalow-chapter-row', {
        y: 26,
        opacity: 0,
        duration: 0.75,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.bungalow-chapter-list',
          start: 'top 86%',
          once: true,
        },
      });

      // Full-width 3-column signature dish cards reveal
      gsap.from('.bungalow-dish-card', {
        y: 44,
        opacity: 0,
        duration: 0.85,
        stagger: 0.11,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.bungalow-dish-rail',
          start: 'top 86%',
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // GSAP curtain wipe + narrative swap + dish card micro-stagger whenever user switches bungalow spaces
  useEffect(() => {
    if (prevIndex === null || prefersReducedMotion()) return;

    const dir = directionRef.current;
    const tl = gsap.timeline();

    if (incomingImgWrapRef.current) {
      tl.fromTo(
        incomingImgWrapRef.current,
        { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.72, ease: 'power3.inOut' },
        0
      );
    }

    if (incomingImgRef.current) {
      tl.fromTo(
        incomingImgRef.current,
        { scale: 1.09 },
        { scale: 1.0, duration: 0.88, ease: 'power3.out' },
        0
      );
    }

    if (narrativeBlockRef.current) {
      const items = narrativeBlockRef.current.querySelectorAll('.narrative-swap-line');
      tl.fromTo(
        items,
        { y: dir * 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.56, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' },
        0.08
      );
    }

    if (dishRailRef.current) {
      const cards = dishRailRef.current.querySelectorAll('.bungalow-dish-card');
      tl.fromTo(
        cards,
        { y: 20, opacity: 0.35 },
        { y: 0, opacity: 1, duration: 0.52, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' },
        0.12
      );
    }

    return () => {
      tl.kill();
    };
  }, [activeIndex, prevIndex]);

  const selectSpace = useCallback(
    (nextIdx: number) => {
      const wrapped = ((nextIdx % spaces.length) + spaces.length) % spaces.length;
      if (wrapped === activeIndex) return;

      const dir =
        nextIdx > activeIndex || (activeIndex === spaces.length - 1 && wrapped === 0) ? 1 : -1;
      directionRef.current = dir;

      setPrevIndex(activeIndex);
      setActiveIndex(wrapped);

      if (clearPrevTimerRef.current) window.clearTimeout(clearPrevTimerRef.current);
      clearPrevTimerRef.current = window.setTimeout(() => {
        setPrevIndex(null);
      }, 760);
    },
    [activeIndex, spaces.length]
  );

  const handleFlySignatureDish = (dish: DishItem) => {
    const sourceEl = dishThumbRefs.current[dish.id] ?? null;
    const triggerEl = dishBtnRefs.current[dish.id] ?? null;
    setAddedDishId(dish.id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedDishId(null), 1600);

    flyDishToBag(
      dish,
      sourceEl,
      () => {
        onQuickAddDish(dish);
      },
      1,
      triggerEl
    );
  };

  return (
    <section
      ref={sectionRef}
      id="vibe-section"
      aria-labelledby="spaces-heading"
      data-testid="bungalow-showcase-section"
      className="relative scroll-mt-[56px] bg-[#F9F2E9] text-[#3E3A3C] border-b border-[#E6D9D2]"
    >
      {/* GSAP Scroll-Scrubbed Architectural Kinetic Ribbon */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-y border-[#E2D4C6] bg-[#F3E9DC]/75 py-4 sm:py-5 select-none"
      >
        <div
          ref={ribbonTrackRef}
          className="flex items-center gap-8 sm:gap-12 whitespace-nowrap will-change-transform px-6"
        >
          {[0, 1, 2].map((repeatIdx) => (
            <div key={repeatIdx} className="flex items-center gap-8 sm:gap-12 shrink-0">
              <span className="font-serif-editorial italic text-[20px] sm:text-[26px] text-[#262324]">
                17/2 New Palasia
              </span>
              <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.3em] text-[#B84C2E]">
                Heritage Bungalow
              </span>
              <span className="font-serif-editorial italic text-[20px] sm:text-[26px] text-[#262324]">
                12 Culinary Wings
              </span>
              <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.3em] text-[#716D71]">
                83 Vegetarian Dishes · Jain Friendly
              </span>
              <span className="font-serif-editorial italic text-[20px] sm:text-[26px] text-[#262324]">
                Open-Air Courtyard
              </span>
              <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.3em] text-[#B84C2E]">
                1:00 PM – 11:30 PM
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto py-16 md:py-24 px-5 sm:px-8 md:px-12">
        {/* Sculptural Architectural Section Header */}
        <div className="bungalow-header flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 md:pb-10">
          <div className="flex items-end gap-5 sm:gap-8">
            <div className="overflow-hidden">
              <span
                aria-hidden="true"
                className="bungalow-head-reveal block font-bunto font-extralight text-[54px] sm:text-[74px] leading-[0.84] tracking-[-0.05em] text-[#262324] tabular-nums select-none"
              >
                {activeSpace.index}
              </span>
            </div>
            <div className="pb-1">
              <div className="overflow-hidden mb-1.5">
                <p className="bungalow-head-reveal font-bunto text-[10px] font-medium uppercase tracking-[0.28em] text-[#B84C2E]">
                  02 · Inside the Heritage Bungalow
                </p>
              </div>
              <div className="overflow-hidden">
                <h2
                  id="spaces-heading"
                  className="bungalow-head-reveal font-bunto font-medium text-[30px] sm:text-[40px] md:text-[48px] leading-[1.03] tracking-[-0.03em] text-[#262324] text-balance"
                >
                  The Bungalow &amp;{' '}
                  <span className="font-serif-editorial italic font-normal text-[#B84C2E]">
                    Courtyard
                  </span>
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em]">
            <button
              type="button"
              onClick={onEnterHallway}
              className="text-[#262324] border-b border-[#262324] pb-1 hover:text-[#B84C2E] hover:border-[#B84C2E] transition-colors whitespace-nowrap"
            >
              Walk 3D Hallway →
            </button>
            <button
              type="button"
              onClick={onOpenFullMenu}
              className="text-[#716D71] border-b border-[#DFD0C0] pb-1 hover:text-[#262324] hover:border-[#262324] transition-colors whitespace-nowrap"
            >
              Full Menu ({DISHES.length})
            </button>
          </div>
        </div>

        <div className="bungalow-rule h-[1px] w-full bg-[#DFD0C0]" aria-hidden="true" />

        {/* Main 2-Column Interactive Architectural Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-stretch pt-9 md:pt-12">
          {/* Left: Monumental Photo Stage with GSAP Scrubbed Parallax + Curtain Wipe */}
          <div className="bungalow-stage-shell lg:col-span-7 flex flex-col">
            <div className="relative flex-1 min-h-[340px] sm:min-h-[450px] lg:min-h-[540px] rounded-[20px] overflow-hidden border border-[#DFD0C0] bg-[#E8DCCB] shadow-[0_28px_70px_-36px_rgba(32,29,30,0.28)]">
              <div ref={photoParallaxRef} className="absolute inset-0 w-full h-full will-change-transform">
                {prevSpace && (
                  <img
                    src={prevSpace.photo}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                )}

                <div
                  key={activeSpace.id}
                  ref={incomingImgWrapRef}
                  className="absolute inset-0 w-full h-full overflow-hidden"
                >
                  <img
                    ref={incomingImgRef}
                    src={activeSpace.photo}
                    alt={activeSpace.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>

              {/* Measured bottom contrast scrim for crisp editorial caption legibility */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-[#161312]/82 via-[#161312]/30 to-transparent"
              />

              {/* Unboxed editorial caption + sculptural step arrows */}
              <div className="absolute inset-x-5 sm:inset-x-7 bottom-5 sm:bottom-6 z-10 flex items-end justify-between gap-4">
                <div className="max-w-[74%]">
                  <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.26em] text-[#E6B87A]">
                    {activeSpace.index} · {activeSpace.label}
                  </p>
                  <p className="font-serif-editorial italic text-[20px] sm:text-[24px] leading-snug text-[#FAF6EE] mt-0.5 truncate">
                    {activeSpace.vibe}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="bungalow-prev-btn"
                    onClick={() => selectSpace(activeIndex - 1)}
                    aria-label="Previous bungalow space"
                    className="w-11 h-11 rounded-full border border-[#FAF6EE]/35 bg-[#161312]/55 backdrop-blur-sm hover:bg-[#FAF6EE] hover:text-[#161312] text-[#FAF6EE] transition-colors flex items-center justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M8.5 2.5L4 7l4.5 4.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    data-testid="bungalow-next-btn"
                    onClick={() => selectSpace(activeIndex + 1)}
                    aria-label="Next bungalow space"
                    className="w-11 h-11 rounded-full border border-[#FAF6EE]/35 bg-[#161312]/55 backdrop-blur-sm hover:bg-[#FAF6EE] hover:text-[#161312] text-[#FAF6EE] transition-colors flex items-center justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M5.5 2.5L10 7l-4.5 4.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Spacious Editorial Narrative + 3-Space Architectural Selector */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-8">
            <div>
              <div ref={narrativeBlockRef}>
                <p className="narrative-swap-line font-bunto text-[10.5px] font-medium uppercase tracking-[0.26em] text-[#B84C2E] mb-3">
                  {activeSpace.index} · {activeSpace.label} — {activeSpace.vibe}
                </p>
                <h3 className="narrative-swap-line font-bunto font-medium text-[clamp(25px,2.8vw,36px)] leading-[1.12] tracking-[-0.025em] text-[#262324] text-balance">
                  {activeSpace.title}
                </h3>
                <div className="w-10 h-[1px] bg-[#B84C2E]/70 my-5" aria-hidden="true" />
                <p className="narrative-swap-line font-bunto font-normal text-[14.5px] sm:text-[15.5px] leading-[1.72] text-[#666164] max-w-[44ch]">
                  {activeSpace.detail}
                </p>
              </div>

              {/* Interactive 3-Space Architectural Chapter List */}
              <div
                role="tablist"
                aria-label="Real spaces inside Hopin Patio Cafe"
                className="bungalow-chapter-list mt-9 border-t border-[#DFD0C0]"
              >
                {spaces.map((space, idx) => {
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={space.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      data-testid={`bungalow-tab-${space.id}`}
                      onClick={() => selectSpace(idx)}
                      className={`bungalow-chapter-row w-full flex items-center gap-4 py-4 border-b border-[#DFD0C0] text-left transition-colors ${
                        isSelected ? 'text-[#262324]' : 'text-[#716D71] hover:text-[#262324]'
                      }`}
                    >
                      <div className="w-16 h-11 rounded-[10px] overflow-hidden shrink-0 border border-[#DFD0C0] bg-[#EDE2D3]">
                        <img
                          src={space.photo}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-transform duration-500 ${
                            isSelected ? 'scale-105' : 'scale-100 opacity-75'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.22em] tabular-nums text-[#B84C2E]">
                            {space.index}
                          </span>
                          <span className="font-bunto text-[14.5px] font-medium truncate">
                            {space.label}
                          </span>
                        </div>
                        <p className="font-bunto text-[12.5px] text-[#716D71] truncate mt-0.5">
                          {space.vibe}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`h-[1.5px] transition-all duration-300 shrink-0 ${
                          isSelected ? 'w-7 bg-[#B84C2E]' : 'w-2 bg-[#DFD0C0]'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2">
              <button
                type="button"
                onClick={onEnterHallway}
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#201D1E] text-[#F9F2E9] font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em] hover:bg-[#B84C2E] transition-colors whitespace-nowrap"
              >
                Step Into 3D Hallway
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={onOpenFullMenu}
                className="font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#262324] border-b border-[#262324] pb-1 hover:text-[#B84C2E] hover:border-[#B84C2E] transition-colors whitespace-nowrap"
              >
                Browse All {DISHES.length} Dishes
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Full-Width 3-Column "House Favourites Served Here" Tasting Rail */}
        <div ref={dishRailRef} className="bungalow-dish-rail mt-14 md:mt-18 pt-10 border-t border-[#DFD0C0]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-7">
            <div>
              <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.26em] text-[#B84C2E]">
                Paired With {activeSpace.label}
              </p>
              <h3 className="font-bunto font-medium text-[22px] sm:text-[26px] tracking-[-0.02em] text-[#262324] mt-1">
                House Favourites Served Here
              </h3>
            </div>
            <p className="font-bunto text-[12px] text-[#716D71]">
              100% Vegetarian · Freshly prepared to order
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {pairedDishes.map((dish) => {
              const sheet = SHEETS[dish.sheetId];
              const crop = getResponsiveCropStyle(sheet, dish.cellIndex, 1);
              const isAdded = addedDishId === dish.id;
              return (
                <article
                  key={dish.id}
                  className="bungalow-dish-card group flex flex-col justify-between rounded-[18px] bg-[#FAF5EC] border border-[#E2D4C6] p-4 sm:p-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4">
                    <div
                      ref={(el) => {
                        dishThumbRefs.current[dish.id] = el;
                      }}
                      className="w-[82px] h-[104px] rounded-[12px] shrink-0 border border-[#E2D4C6] bg-[#F3E9DC] overflow-hidden"
                      style={{
                        backgroundImage: `url("${sheet.url}")`,
                        backgroundSize: crop.backgroundSize,
                        backgroundPosition: crop.backgroundPosition,
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.2em] text-[#716D71]">
                        {dish.dietary}
                      </p>
                      <h4 className="font-bunto font-medium text-[15.5px] leading-[1.3] text-[#262324] mt-1">
                        {dish.title}
                      </h4>
                      <p className="font-bunto text-[12.5px] leading-[1.55] text-[#6E696C] mt-1.5 line-clamp-2">
                        {dish.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-[#E8DCD0] flex items-center justify-between gap-3">
                    <span className="font-bunto text-[14.5px] font-medium text-[#262324] tabular-nums">
                      {formatINR(dish.price)}
                    </span>
                    <button
                      ref={(el) => {
                        dishBtnRefs.current[dish.id] = el;
                      }}
                      type="button"
                      data-testid={`bungalow-add-${dish.id}`}
                      onClick={() => handleFlySignatureDish(dish)}
                      aria-label={`Add ${dish.title} to bag`}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bunto font-medium uppercase tracking-[0.18em] transition-colors whitespace-nowrap ${
                        isAdded
                          ? 'bg-[#B84C2E] text-[#FAF6EE]'
                          : 'bg-[#201D1E] text-[#FAF6EE] hover:bg-[#B84C2E]'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Add to Bag
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
