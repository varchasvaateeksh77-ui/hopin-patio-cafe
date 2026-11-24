import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DISHES,
  getDishesByRoom,
  SHEETS,
  SUBCATEGORY_ROOMS,
  type DishItem,
  type SubcategoryRoom,
} from '../data/cafeData';
import {
  BUNTO_DETAIL_DURATION_MS,
  BUNTO_SECONDS_PER_SLOT,
  BUNTO_SLOT_STEP,
  buntoEaseInOutCubic,
  clamp,
  computeBuntoClosePos,
  computeBuntoDetailPose,
  computeBuntoEntranceOffset,
  computeBuntoRingPose,
  computeBuntoShadowPose,
  computeShortestRingTargetAngle,
  findBuntoFrontIndex,
} from '../utils/buntoRingMath';
import { flyDishToBag } from '../utils/flyToBag';
import { formatINR, getResponsiveCropStyle } from '../utils/galleryMath';

interface HeavenlyGatesSectionProps {
  onStepThroughGate: (room: SubcategoryRoom) => void;
  onEnterHallway: () => void;
  onOpenFullMenu: () => void;
  onQuickAddDish: (dish: DishItem) => void;
  onReplayEntry?: () => void;
}

interface GateEntry {
  globalIndex: number; // 0..11 across all 12 vegetarian culinary wings
  room: SubcategoryRoom;
  dishes: DishItem[];
  swatches: DishItem[];
}

const ALL_GATE_ENTRIES: GateEntry[] = SUBCATEGORY_ROOMS.map((room, globalIndex) => {
  const dishes = getDishesByRoom(room.id);
  const swatches = dishes.slice(0, 4);
  return { globalIndex, room, dishes, swatches };
});

const TOTAL_GATES = ALL_GATE_ENTRIES.length;
const RING_STEP = BUNTO_SLOT_STEP;
const AUTO_OMEGA = RING_STEP / BUNTO_SECONDS_PER_SLOT;

// Resolution-independent percentage crop helper — NEVER zooms in or distorts on any viewport!
function getGatePercentCropStyle(
  sheetId: DishItem['sheetId'],
  cellIndex: number,
  targetAspect: number = 0.74
) {
  const sheet = SHEETS[sheetId];
  const crop = getResponsiveCropStyle(sheet, cellIndex, targetAspect);
  return {
    backgroundImage: `url("${sheet.url}")`,
    backgroundSize: crop.backgroundSize,
    backgroundPosition: crop.backgroundPosition,
    backgroundRepeat: 'no-repeat' as const,
  };
}

export const HeavenlyGatesSection: React.FC<HeavenlyGatesSectionProps> = ({
  onStepThroughGate,
  onEnterHallway,
  onOpenFullMenu,
  onQuickAddDish,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const dotsWrapRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const indexNumRef = useRef<HTMLSpanElement | null>(null);

  const [frontSlot, setFrontSlot] = useState(0);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [selectedDishByGate, setSelectedDishByGate] = useState<Record<number, number>>({});
  const [swapPreview, setSwapPreview] = useState<{
    slotIdx: number;
    sheetId: DishItem['sheetId'];
    cellIndex: number;
    visible: boolean;
  } | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Smooth rAF ring, entrance rise, shortest-path dot glide, & 560ms detail blend refs
  const baseAngleRef = useRef<number>(0);
  const targetAngleRef = useRef<number | null>(null);
  const flingVelRef = useRef<number>(0);
  const autoWeightRef = useRef<number>(1);
  const enteredRef = useRef<number>(0);
  const entranceStartRef = useRef<number>(performance.now());
  const detailBlendRef = useRef<number>(0);
  const detailAnimRef = useRef<{
    active: boolean;
    from: number;
    to: number;
    startTs: number;
    duration: number;
  }>({
    active: false,
    from: 0,
    to: 0,
    startTs: 0,
    duration: BUNTO_DETAIL_DURATION_MS,
  });

  const openSlotRef = useRef<number | null>(null);
  const frontSlotRef = useRef<number>(0);
  const hoveredSlotRef = useRef<number | null>(null);

  const bounceRef = useRef<{ slotIdx: number; startTs: number } | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    lastX: number;
    lastTs: number;
    vel: number;
    pointerId: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    lastX: 0,
    lastTs: 0,
    vel: 0,
    pointerId: -1,
  });

  const currentRollDigitRef = useRef<string>('01');
  const rollTimerRef = useRef<number>(0);
  const swapTimerRef = useRef<number>(0);
  const addedTimerRef = useRef<number>(0);

  // Vertical rolling index matching BUNTO° (01..12)
  const triggerIndexRoll = useCallback((globalIdx: number) => {
    const label = String(globalIdx + 1).padStart(2, '0');
    if (label === currentRollDigitRef.current) return;
    currentRollDigitRef.current = label;

    const el = indexNumRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.clearTimeout(rollTimerRef.current);

    if (prefersReduced) {
      el.textContent = label;
      el.style.transition = 'none';
      el.style.transform = 'translateY(0%)';
      return;
    }

    el.style.transition = 'transform 700ms cubic-bezier(.65, 0, .35, 1)';
    el.style.transform = 'translateY(-110%)';

    rollTimerRef.current = window.setTimeout(() => {
      if (!indexNumRef.current) return;
      indexNumRef.current.style.transition = 'none';
      indexNumRef.current.textContent = label;
      indexNumRef.current.style.transform = 'translateY(110%)';
      void indexNumRef.current.offsetHeight;
      indexNumRef.current.style.transition = 'transform 700ms cubic-bezier(.65, 0, .35, 1)';
      indexNumRef.current.style.transform = 'translateY(0%)';
    }, 300);
  }, []);

  // Smoothly spin the continuous 12-submenu ring to any target gate (0..11) along the shortest path
  const jumpToGate = useCallback(
    (targetIdx: number) => {
      const normalized = ((targetIdx % TOTAL_GATES) + TOTAL_GATES) % TOTAL_GATES;
      const nextTargetAngle = computeShortestRingTargetAngle(
        baseAngleRef.current,
        normalized,
        TOTAL_GATES
      );
      targetAngleRef.current = nextTargetAngle;
      flingVelRef.current = 0;
      autoWeightRef.current = 0;
      frontSlotRef.current = normalized;
      setFrontSlot(normalized);
      triggerIndexRoll(normalized);
    },
    [triggerIndexRoll]
  );

  // Click any floating piece to open BUNTO° 560ms product detail view
  const openGateDetail = useCallback(
    (slotIdx: number) => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      openSlotRef.current = slotIdx;
      setOpenSlot(slotIdx);
      setIsDetailOpen(true);
      setAddedFeedback(false);
      flingVelRef.current = 0;
      targetAngleRef.current = null;

      detailAnimRef.current = {
        active: true,
        from: detailBlendRef.current,
        to: 1,
        startTs: performance.now(),
        duration: prefersReduced ? 1 : BUNTO_DETAIL_DURATION_MS,
      };

      triggerIndexRoll(slotIdx);

      window.setTimeout(() => {
        closeBtnRef.current?.focus({ preventScroll: true });
      }, prefersReduced ? 20 : 280);
    },
    [triggerIndexRoll]
  );

  // Close Detail View and resume ring smoothly from the exact paused angle
  const closeGateDetail = useCallback(() => {
    const closingIdx = openSlotRef.current;
    if (closingIdx === null) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setIsDetailOpen(false);
    setAddedFeedback(false);
    setSwapPreview(null);

    detailAnimRef.current = {
      active: true,
      from: detailBlendRef.current,
      to: 0,
      startTs: performance.now(),
      duration: prefersReduced ? 1 : BUNTO_DETAIL_DURATION_MS,
    };

    triggerIndexRoll(frontSlotRef.current);

    window.setTimeout(() => {
      itemRefs.current[closingIdx]?.focus({ preventScroll: true });
    }, prefersReduced ? 20 : 420);
  }, [triggerIndexRoll]);

  // Support ?openGate=<roomId> deterministic inspection hook across all 12 submenus
  useEffect(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const openParam = params?.get('openGate');
    if (openParam) {
      const globalIdx = ALL_GATE_ENTRIES.findIndex((g) => g.room.id === openParam);
      if (globalIdx >= 0) {
        baseAngleRef.current = -globalIdx * RING_STEP;
        openSlotRef.current = globalIdx;
        detailBlendRef.current = 1;
        enteredRef.current = 1;
        setOpenSlot(globalIdx);
        setIsDetailOpen(true);
        setFrontSlot(globalIdx);
        frontSlotRef.current = globalIdx;
        currentRollDigitRef.current = String(globalIdx + 1).padStart(2, '0');
        if (indexNumRef.current) {
          indexNumRef.current.textContent = currentRollDigitRef.current;
        }
      }
    }
  }, []);

  // Track BUNTO° phone portrait breakpoint (max-width 820px & min-height 521px)
  useEffect(() => {
    const checkLayout = () => {
      setIsPhoneLayout(window.innerWidth <= 820 && window.innerHeight >= 521);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // Escape closes detail view
  useEffect(() => {
    if (!isDetailOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeGateDetail();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDetailOpen, closeGateDetail]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(rollTimerRef.current);
      window.clearTimeout(swapTimerRef.current);
      window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  // Master 60fps requestAnimationFrame loop driving BUNTO° ring turn, fling, rise entrance & 560ms detail blend
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let isVisible = true;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);

      const dtMs = Math.min(50, Math.max(1, now - lastTs));
      const dt = dtMs / 1000;
      lastTs = now;

      if (!isVisible || document.hidden) return;

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const phone = window.innerWidth <= 820 && window.innerHeight >= 521;

      // 0. Smooth BUNTO° ring staggered entrance rise (1.6s)
      if (prefersReduced) {
        enteredRef.current = 1;
      } else if (enteredRef.current < 1) {
        enteredRef.current = clamp((now - entranceStartRef.current) / 1600, 0, 1);
      }

      // 1. Update 560ms ease-in-out cubic detail blend
      const anim = detailAnimRef.current;
      if (anim.active) {
        const rawT = clamp((now - anim.startTs) / Math.max(1, anim.duration), 0, 1);
        const eased = buntoEaseInOutCubic(rawT);
        detailBlendRef.current = anim.from + (anim.to - anim.from) * eased;
        if (rawT >= 1) {
          anim.active = false;
          detailBlendRef.current = anim.to;
          if (anim.to === 0) {
            openSlotRef.current = null;
            setOpenSlot(null);
          }
        }
      }

      const d = detailBlendRef.current;
      const isOpenOrAnimating = openSlotRef.current !== null && d > 0.001;

      // 2. Advance ring across all 12 submenus (smooth dot-glide, fling momentum, or steady auto-turn)
      if (!dragRef.current.active && !isOpenOrAnimating) {
        if (targetAngleRef.current !== null) {
          const diff = targetAngleRef.current - baseAngleRef.current;
          if (Math.abs(diff) < 0.0025) {
            baseAngleRef.current = targetAngleRef.current;
            targetAngleRef.current = null;
          } else {
            const glideAlpha = 1 - Math.exp(-dt * 8.5);
            baseAngleRef.current += diff * glideAlpha;
          }
        } else {
          if (Math.abs(flingVelRef.current) >= 0.0005) {
            baseAngleRef.current += flingVelRef.current;
            flingVelRef.current *= Math.pow(0.92, dt * 60);
            if (Math.abs(flingVelRef.current) < 0.0005) {
              flingVelRef.current = 0;
            }
          }
          if (!prefersReduced) {
            autoWeightRef.current = Math.min(1, autoWeightRef.current + 0.8 * dt);
            baseAngleRef.current += AUTO_OMEGA * dt * autoWeightRef.current;
          }
        }
      }

      // 3. Track frontmost piece across all 12 submenus for active dot & rolling index
      const nextFront = findBuntoFrontIndex(baseAngleRef.current, TOTAL_GATES);
      if (nextFront !== frontSlotRef.current) {
        frontSlotRef.current = nextFront;
        setFrontSlot(nextFront);
        if (openSlotRef.current === null && hoveredSlotRef.current === null) {
          triggerIndexRoll(nextFront);
        }
      }

      // 4. Chosen piece ring X for outward dispersal
      const chosenSlot = openSlotRef.current;
      const chosenRingPose =
        chosenSlot !== null
          ? computeBuntoRingPose(chosenSlot, baseAngleRef.current, TOTAL_GATES, phone)
          : null;
      const chosenRingX = chosenRingPose ? chosenRingPose.x : 718;

      // 5. Optional 420ms sinusoidal bounce when swapping a dish swatch
      let bounceFactor = 1;
      let bounceSlot = -1;
      if (bounceRef.current && !prefersReduced) {
        const bt = (now - bounceRef.current.startTs) / 420;
        if (bt >= 1) {
          bounceRef.current = null;
        } else {
          bounceSlot = bounceRef.current.slotIdx;
          bounceFactor = 1 + 0.035 * Math.sin(Math.PI * bt);
        }
      }

      // 6. Apply transforms to all 12 floating culinary pieces (6 visible at BUNTO° spacing)
      for (let i = 0; i < TOTAL_GATES; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;

        const ringPose = computeBuntoRingPose(i, baseAngleRef.current, TOTAL_GATES, phone);
        const pose = computeBuntoDetailPose(
          ringPose,
          i === chosenSlot,
          chosenRingX,
          d,
          phone
        );
        const entrance =
          enteredRef.current < 1 && d < 0.01
            ? computeBuntoEntranceOffset(enteredRef.current, ringPose.cos)
            : { offsetY: 0, scaleMul: 1, opacity: 1 };

        const finalScale =
          (i === bounceSlot ? pose.scale * bounceFactor : pose.scale) * entrance.scaleMul;
        const finalY = pose.y + entrance.offsetY;
        const finalOpacity = pose.opacity * entrance.opacity;

        el.style.transform = `translate3d(calc(${pose.x.toFixed(2)} * var(--bu)), calc(${finalY.toFixed(2)} * var(--bu)), 0) scale(${finalScale.toFixed(4)}) rotate(${pose.rotateDeg.toFixed(2)}deg)`;
        el.style.zIndex = String(pose.zIndex);
        el.style.opacity = finalOpacity.toFixed(3);
        el.style.pointerEvents = pose.pointerEvents && finalOpacity > 0.2 ? 'auto' : 'none';
        el.style.visibility = finalOpacity < 0.005 ? 'hidden' : 'visible';
      }

      // 7. Floor shadow & pagination dots
      if (shadowRef.current) {
        const sh = computeBuntoShadowPose(d, phone);
        shadowRef.current.style.transform = `translate3d(calc(${sh.tx.toFixed(2)} * var(--bu)), calc(${sh.ty.toFixed(2)} * var(--bu)), 0) scaleX(${sh.scaleX.toFixed(4)})`;
      }

      if (dotsWrapRef.current) {
        dotsWrapRef.current.style.opacity = (1 - d).toFixed(3);
        dotsWrapRef.current.style.pointerEvents = d > 0.2 ? 'none' : 'auto';
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [triggerIndexRoll]);

  // Pointer drag & momentum fling on the stage
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isDetailOpen) return;
    if ((e.target as HTMLElement).closest('[data-no-ring-drag="true"]')) return;

    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      lastX: e.clientX,
      lastTs: performance.now(),
      vel: 0,
      pointerId: e.pointerId,
    };
    flingVelRef.current = 0;
    targetAngleRef.current = null;
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || e.pointerId !== drag.pointerId) return;

      const stageW = stageRef.current?.getBoundingClientRect().width || window.innerWidth;
      const scaleToDesign = 1440 / Math.max(1, stageW);
      const dxDesign = (e.clientX - drag.lastX) * scaleToDesign;
      const totalMoveDesign = Math.abs(e.clientX - drag.startX) * scaleToDesign;

      if (!drag.moved && totalMoveDesign > 6) {
        drag.moved = true;
        setIsDragging(true);
      }

      const now = performance.now();
      const dtFrame = Math.max(1, (now - drag.lastTs) / 16.667);
      const dTheta = dxDesign / 411;

      baseAngleRef.current += dTheta;
      drag.vel = 0.6 * drag.vel + 0.4 * (dTheta / dtFrame);
      drag.lastX = e.clientX;
      drag.lastTs = now;
    };

    const onPointerEnd = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || e.pointerId !== drag.pointerId) return;
      drag.active = false;
      setIsDragging(false);

      if (drag.moved) {
        flingVelRef.current = clamp(drag.vel, -0.12, 0.12);
        autoWeightRef.current = 0;
        window.setTimeout(() => {
          dragRef.current.moved = false;
        }, 60);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  // Swap featured dish swatch in place (BUNTO° 350ms .art2 cross-fade + 420ms bounce)
  const handleSelectSwatch = (slotIdx: number, globalIdx: number, swatchIdx: number) => {
    const entry = ALL_GATE_ENTRIES[slotIdx];
    const nextDish = entry?.swatches[swatchIdx];
    if (!nextDish) return;

    const currentSwatchIdx = selectedDishByGate[globalIdx] ?? 0;
    if (currentSwatchIdx === swatchIdx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setSelectedDishByGate((prev) => ({ ...prev, [globalIdx]: swatchIdx }));
      return;
    }

    window.clearTimeout(swapTimerRef.current);
    setSwapPreview({
      slotIdx,
      sheetId: nextDish.sheetId,
      cellIndex: nextDish.cellIndex,
      visible: false,
    });

    window.requestAnimationFrame(() => {
      setSwapPreview({
        slotIdx,
        sheetId: nextDish.sheetId,
        cellIndex: nextDish.cellIndex,
        visible: true,
      });
    });

    bounceRef.current = { slotIdx, startTs: performance.now() };

    swapTimerRef.current = window.setTimeout(() => {
      setSelectedDishByGate((prev) => ({ ...prev, [globalIdx]: swatchIdx }));
      setSwapPreview(null);
    }, 360);
  };

  // Active Gate & Dish for the Detail Panel
  const openedEntry = openSlot !== null ? ALL_GATE_ENTRIES[openSlot] : null;
  const activeSwatchIdx = openedEntry ? (selectedDishByGate[openedEntry.globalIndex] ?? 0) : 0;
  const activePreviewDish: DishItem | null = openedEntry
    ? (openedEntry.swatches[activeSwatchIdx] ?? openedEntry.dishes[0] ?? null)
    : null;

  // Trigger upgraded 3D Parabolic Flying Dish-to-Bag Animation!
  const handleQuickAddToBag = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (openSlot === null || !activePreviewDish) return;
    const sourceEl = itemRefs.current[openSlot];
    const triggerEl = e?.currentTarget ?? null;

    setAddedFeedback(true);
    window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      setAddedFeedback(false);
    }, 1800);

    flyDishToBag(
      activePreviewDish,
      sourceEl,
      () => {
        onQuickAddDish(activePreviewDish);
      },
      1,
      triggerEl
    );
  };

  // Bottom-left active index entry across all 12 submenus
  const displayGateEntry = useMemo(() => {
    if (openSlot !== null && ALL_GATE_ENTRIES[openSlot]) return ALL_GATE_ENTRIES[openSlot];
    if (hoveredSlot !== null && ALL_GATE_ENTRIES[hoveredSlot]) return ALL_GATE_ENTRIES[hoveredSlot];
    return ALL_GATE_ENTRIES[frontSlot] ?? ALL_GATE_ENTRIES[0];
  }, [openSlot, hoveredSlot, frontSlot]);

  const closePos = computeBuntoClosePos(isPhoneLayout);

  return (
    <section
      ref={sectionRef}
      id="gateways-section"
      aria-labelledby="gateways-heading"
      data-testid="heavenly-gates-section"
      className={`bunto-ring-section relative w-full mt-[56px] h-[calc(100svh-56px)] min-h-[540px] max-h-[980px] overflow-hidden select-none border-b border-[#E6D9D2] ${
        isDetailOpen ? 'bunto-detail-open' : ''
      }`}
    >
      <h2 id="gateways-heading" className="sr-only">
        Hopin — The Twelve Gates of Heaven Rotating Culinary Ring
      </h2>

      {/* ================================================================
          BUNTO° EDGE CHROME (pinned cleanly inside the below-navbar stage)
         ================================================================ */}
      {/* Mobile-balanced editorial top header (eliminates empty top void on narrow phones) */}
      <div
        data-testid="bunto-mobile-header"
        className="md:hidden absolute inset-x-5 top-[18px] z-20 flex flex-col items-center text-center transition-opacity duration-300"
        style={{
          opacity: isDetailOpen ? 0 : 1,
          pointerEvents: isDetailOpen ? 'none' : 'auto',
        }}
      >
        <p className="font-bunto text-[9.5px] font-medium uppercase tracking-[0.28em] text-[#3E3A3C]">
          PATIO KITCHEN · NEW PALASIA
        </p>
        <p className="font-bunto text-[8.5px] font-medium uppercase tracking-[0.24em] text-[#716D71] mt-0.5">
          12 GATES · {DISHES.length} VEGETARIAN DISHES
        </p>
        <div className="mt-3 flex items-center gap-5">
          <button
            type="button"
            data-no-ring-drag="true"
            onClick={onEnterHallway}
            className="font-bunto text-[9px] font-medium uppercase tracking-[0.26em] text-[#3E3A3C] border-b border-[#3E3A3C]/35 pb-0.5 hover:text-[#B84C2E] transition-colors"
          >
            3D HALLWAY
          </button>
          <span aria-hidden="true" className="w-[3px] h-[3px] rounded-full bg-[#CFC6C2]" />
          <button
            type="button"
            data-no-ring-drag="true"
            onClick={onOpenFullMenu}
            className="font-bunto text-[9px] font-medium uppercase tracking-[0.26em] text-[#3E3A3C] border-b border-[#3E3A3C]/35 pb-0.5 hover:text-[#B84C2E] transition-colors"
          >
            FULL MENU
          </button>
        </div>
      </div>

      {/* Top-center two-line BUNTO° tagline (desktop) */}
      <div className="pointer-events-none hidden md:block absolute left-1/2 -translate-x-1/2 top-[calc(22*var(--bn))] z-20 text-center">
        <p className="bunto-caps text-[#3E3A3C] whitespace-nowrap pl-[0.32em]">
          PATIO KITCHEN · NEW PALASIA
          <br />
          <span className="text-[#716D71]">100% VEGETARIAN · JAIN OPTIONS</span>
        </p>
      </div>

      {/* Left edge label (desktop) */}
      <div className="pointer-events-none hidden md:block absolute left-[calc(46*var(--bn))] top-[calc(38*var(--bn))] z-20">
        <p className="bunto-caps text-[#3E3A3C]">THE TWELVE GATES — {DISHES.length} DISHES</p>
      </div>

      {/* Right edge clean BUNTO° hairline quick links (desktop) */}
      <div className="hidden md:flex absolute right-[calc(42*var(--bn))] top-[calc(38*var(--bn))] z-20 items-center gap-4 text-right">
        <button
          type="button"
          data-no-ring-drag="true"
          onClick={onEnterHallway}
          className="bunto-caps text-[#716D71] hover:text-[#3E3A3C] border-b border-[#3E3A3C]/25 pb-0.5 transition-colors"
          style={{ fontSize: 'max(8.5px, calc(9 * var(--bn)))' }}
        >
          3D HALLWAY
        </button>
        <button
          type="button"
          data-no-ring-drag="true"
          onClick={onOpenFullMenu}
          className="bunto-caps text-[#716D71] hover:text-[#3E3A3C] border-b border-[#3E3A3C]/25 pb-0.5 transition-colors"
          style={{ fontSize: 'max(8.5px, calc(9 * var(--bn)))' }}
        >
          FULL MENU
        </button>
      </div>

      {/* Vertical far-left edge label (BUNTO° exact -90deg placement) */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden md:flex items-center justify-center absolute left-[calc(26*var(--bn))] top-1/2 -translate-y-1/2 w-0 z-20"
      >
        <span
          className="bunto-caps whitespace-nowrap text-[#716D71]"
          style={{
            fontSize: 'max(8px, calc(9 * var(--bn)))',
            transform: 'rotate(-90deg)',
          }}
        >
          EVERYDAY PATIO ESSENTIALS FOR INDORE
        </span>
      </div>

      {/* Bottom-left BUNTO° rolling 200-weight index + collection/choose label
          (Fades cleanly on mobile Detail View so it NEVER overlaps ADD TO BAG!) */}
      <div
        data-testid="bunto-bottom-index"
        className="pointer-events-none absolute left-[20px] md:left-[calc(46*var(--bn))] bottom-[20px] md:bottom-[calc(38*var(--bn))] z-20 flex items-center transition-opacity duration-300"
        style={{ opacity: isPhoneLayout && isDetailOpen ? 0 : 1 }}
      >
        <div
          className="overflow-hidden leading-none"
          style={{
            fontSize: 'max(32px, calc(50 * var(--bn)))',
            fontWeight: 200,
            letterSpacing: '-0.04em',
            height: '1em',
          }}
        >
          <span ref={indexNumRef} className="block leading-none">
            01
          </span>
        </div>

        <span
          aria-hidden="true"
          className="block w-[1px] bg-[#3E3A3C]/45 mx-[12px] md:mx-[calc(20*var(--bn))]"
          style={{ height: 'max(22px, calc(28 * var(--bn)))' }}
        />

        <div
          className="relative min-w-[15em]"
          style={{
            fontSize: 'max(8px, calc(9.5 * var(--bn)))',
            fontWeight: 500,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            lineHeight: 1.62,
          }}
        >
          <div
            className="transition-all duration-[450ms] ease-out"
            style={{
              opacity: isDetailOpen ? 0 : 1,
              transform: isDetailOpen ? 'translateY(-8px)' : 'translateY(0px)',
            }}
          >
            {displayGateEntry.room.shortTitle}
            <br />
            <span className="text-[#716D71]">
              GATE {displayGateEntry.room.roman} · OF {TOTAL_GATES}
            </span>
          </div>

          <div
            className="absolute inset-0 transition-all duration-[450ms] ease-out"
            style={{
              opacity: isDetailOpen ? 1 : 0,
              transform: isDetailOpen ? 'translateY(0px)' : 'translateY(8px)',
            }}
          >
            CHOOSE
            <br />
            <span className="text-[#716D71]">A DISH OR ROOM</span>
          </div>
        </div>
      </div>

      {/* Bottom-center BUNTO° scroll hint with down arrow */}
      <button
        type="button"
        data-no-ring-drag="true"
        onClick={() => {
          const next = document.getElementById('vibe-section');
          if (next) next.scrollIntoView({ behavior: 'smooth' });
        }}
        className="absolute left-1/2 -translate-x-1/2 bottom-[22px] md:bottom-[calc(42*var(--bn))] z-20 hidden sm:flex items-center gap-[calc(12*var(--bn))] transition-opacity duration-300 hover:opacity-100"
        style={{ opacity: isDetailOpen ? 0 : 0.78, pointerEvents: isDetailOpen ? 'none' : 'auto' }}
      >
        <svg
          width="11"
          height="16"
          viewBox="0 0 11 16"
          fill="none"
          stroke="#3E3A3C"
          strokeWidth="1.2"
          aria-hidden="true"
          style={{ width: 'max(8px, calc(11 * var(--bn)))', height: 'auto' }}
        >
          <path d="M5.5 1v13M1.5 10l4 4 4-4" />
        </svg>
        <span
          className="bunto-caps text-[#3E3A3C] whitespace-nowrap"
          style={{ fontSize: 'max(8px, calc(9.5 * var(--bn)))' }}
        >
          SCROLL TO EXPLORE
        </span>
      </button>

      {/* ================================================================
          CENTERED 1440u × 900u BUNTO° STAGE
         ================================================================ */}
      <div
        ref={stageRef}
        data-testid="curved-gates-shelf"
        onPointerDown={handleStagePointerDown}
        className={`absolute left-1/2 top-[48%] md:top-1/2 -translate-x-1/2 -translate-y-1/2 ${
          isDetailOpen ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          width: 'calc(1440 * var(--bu))',
          height: 'calc(900 * var(--bu))',
          touchAction: 'pan-y',
        }}
      >
        {/* Giant Pale Ghost Word "HOPIN" — fully visible behind the floating 6-piece ring */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 text-center font-bold leading-none select-none"
          style={{
            top: isPhoneLayout ? 'calc(168 * var(--bu))' : 'calc(104 * var(--bu))',
            fontSize: isPhoneLayout ? 'calc(198 * var(--bu))' : 'calc(295 * var(--bu))',
            letterSpacing: '-0.02em',
            color: 'var(--bunto-ghost)',
          }}
        >
          HOPIN
        </div>

        {/* Soft Elliptical Floor Shadow (exact BUNTO° 700×48 blurred ellipse) */}
        <div
          ref={shadowRef}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            left: isPhoneLayout ? 'calc(470 * var(--bu))' : 'calc(370 * var(--bu))',
            top: isPhoneLayout ? 'calc(640 * var(--bu))' : 'calc(686 * var(--bu))',
            width: isPhoneLayout ? 'calc(500 * var(--bu))' : 'calc(700 * var(--bu))',
            height: 'calc(44 * var(--bu))',
            background:
              'radial-gradient(closest-side, rgba(120,96,86,0.16) 0%, rgba(120,96,86,0.07) 55%, rgba(120,96,86,0) 100%)',
            filter: 'blur(calc(3 * var(--bu)))',
          }}
        />

        {/* All 12 Submenu Pagination Dots + Quiet Prev/Next Step Arrows */}
        <div
          ref={dotsWrapRef}
          data-no-ring-drag="true"
          data-testid="bunto-12-dots"
          className="absolute left-1/2 -translate-x-1/2 flex items-center z-20"
          style={{
            top: isPhoneLayout ? 'calc(706 * var(--bu))' : 'calc(748 * var(--bu))',
            gap: isPhoneLayout ? '6px' : 'max(8px, calc(12 * var(--bu)))',
          }}
        >
          <button
            type="button"
            data-testid="ring-prev-gate"
            aria-label="Previous submenu gate"
            onClick={() => jumpToGate(frontSlotRef.current - 1)}
            className="w-7 h-7 rounded-full border border-[#E6D9D2] bg-[#FAF6EE]/80 hover:border-[#3E3A3C] text-[#3E3A3C] flex items-center justify-center transition-colors shrink-0 mr-1"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M7.5 2L3.5 6l4 4" />
            </svg>
          </button>

          {ALL_GATE_ENTRIES.map((g, slotIdx) => (
            <button
              key={g.room.id}
              type="button"
              data-testid={`ring-dot-${g.room.id}`}
              title={`${String(slotIdx + 1).padStart(2, '0')} · ${g.room.title}`}
              aria-label={`Jump to Gate ${g.room.roman}: ${g.room.title}`}
              aria-current={slotIdx === frontSlot ? 'true' : undefined}
              onClick={() => jumpToGate(slotIdx)}
              className="rounded-full transition-all duration-300"
              style={{
                width: slotIdx === frontSlot ? 'max(18px, calc(22 * var(--bu)))' : 'max(7px, calc(8.5 * var(--bu)))',
                height: 'max(7px, calc(8.5 * var(--bu)))',
                backgroundColor: slotIdx === frontSlot ? 'var(--bunto-ink)' : 'var(--bunto-dot)',
              }}
            />
          ))}

          <button
            type="button"
            data-testid="ring-next-gate"
            aria-label="Next submenu gate"
            onClick={() => jumpToGate(frontSlotRef.current + 1)}
            className="w-7 h-7 rounded-full border border-[#E6D9D2] bg-[#FAF6EE]/80 hover:border-[#3E3A3C] text-[#3E3A3C] flex items-center justify-center transition-colors shrink-0 ml-1"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M4.5 2l4 4-4 4" />
            </svg>
          </button>
        </div>

        {/* ================================================================
            ALL 12 CULINARY SUBMENUS FLOWING ON BUNTO°'S 6-VISIBLE-SLOT RING
            (Pure 3:4 responsive percentage crop — ZERO zoomed-in distortion!)
           ================================================================ */}
        {ALL_GATE_ENTRIES.map((entry, slotIdx) => {
          const swatchIdx = selectedDishByGate[entry.globalIndex] ?? 0;
          const activeDish = entry.swatches[swatchIdx] ?? entry.dishes[0];
          const artSheet = activeDish ? activeDish.sheetId : entry.room.sheetId;
          const artCell = activeDish ? activeDish.cellIndex : entry.room.cellIndex;
          const isSwappingThis = swapPreview?.slotIdx === slotIdx;

          return (
            <button
              key={entry.room.id}
              ref={(el) => {
                itemRefs.current[slotIdx] = el;
              }}
              type="button"
              data-testid={`heaven-gate-${entry.room.id}`}
              aria-label={`Gate ${entry.room.roman}: ${entry.room.title}`}
              onMouseEnter={() => {
                if (!isDetailOpen) {
                  hoveredSlotRef.current = slotIdx;
                  setHoveredSlot(slotIdx);
                  triggerIndexRoll(entry.globalIndex);
                }
              }}
              onMouseLeave={() => {
                if (!isDetailOpen) {
                  hoveredSlotRef.current = null;
                  setHoveredSlot(null);
                  triggerIndexRoll(frontSlotRef.current);
                }
              }}
              onClick={() => {
                if (dragRef.current.moved) return;
                if (openSlotRef.current === slotIdx) return;
                openGateDetail(slotIdx);
              }}
              className="group absolute left-0 top-0 text-left focus:outline-none"
              style={{
                width: 'calc(274 * var(--bu))',
                height: 'calc(396 * var(--bu))',
                marginLeft: 'calc(-137 * var(--bu))',
                marginTop: 'calc(-198 * var(--bu))',
                willChange: 'transform, opacity',
              }}
            >
              {/* Clean floating 3:4 dish art (zero zoomed crop, zero heavy dark box!) */}
              <div
                className="relative w-full overflow-hidden rounded-[22px] transition-shadow duration-500"
                style={{
                  height: 'calc(360 * var(--bu))',
                  backgroundColor: '#F3E9DB',
                  border: '1px solid rgba(190, 166, 134, 0.36)',
                  boxShadow:
                    '0 24px 44px -18px rgba(90, 70, 58, 0.22), 0 4px 14px rgba(90, 70, 58, 0.08)',
                }}
              >
                {/* Primary .art dish layer — exact 274/360 = 0.761 aspect matching 3:4 sprite cells */}
                <div
                  className="absolute inset-0"
                  style={getGatePercentCropStyle(artSheet, artCell, 274 / 360)}
                />

                {/* Secondary .art2 cross-fade layer (BUNTO° 350ms swatch swap) */}
                {isSwappingThis && swapPreview && (
                  <div
                    className="absolute inset-0 transition-opacity duration-[350ms] ease-out"
                    style={{
                      ...getGatePercentCropStyle(
                        swapPreview.sheetId,
                        swapPreview.cellIndex,
                        274 / 360
                      ),
                      opacity: swapPreview.visible ? 1 : 0,
                    }}
                  />
                )}
              </div>

              {/* Minimal BUNTO°-quiet gate caption shown cleanly on the opened piece (zero colliding text on spinning ring) */}
              <div
                className="pointer-events-none mt-[calc(12*var(--bu))] text-center transition-opacity duration-300"
                style={{ opacity: openSlot === slotIdx ? 1 : 0 }}
              >
                <p
                  className="uppercase tracking-[0.26em] text-[#3E3A3C] truncate"
                  style={{ fontSize: 'max(9px, calc(10 * var(--bu)))', fontWeight: 500 }}
                >
                  {entry.room.roman} · {entry.room.shortTitle}
                </p>
              </div>
            </button>
          );
        })}

        {/* ================================================================
            BUNTO° ROUND CLOSE BUTTON (top-right corner of opened piece)
           ================================================================ */}
        <button
          ref={closeBtnRef}
          type="button"
          data-no-ring-drag="true"
          data-testid="bunto-detail-close"
          aria-label="Close gate preview"
          onClick={closeGateDetail}
          className="absolute z-[320] rounded-full border border-[#E6D9D2] hover:border-[#3E3A3C] flex items-center justify-center transition-all"
          style={{
            left: `calc(${closePos.x.toFixed(1)} * var(--bu))`,
            top: `calc(${closePos.y.toFixed(1)} * var(--bu))`,
            width: 'max(34px, calc(44 * var(--bu)))',
            height: 'max(34px, calc(44 * var(--bu)))',
            backgroundColor: 'rgba(249, 242, 233, 0.85)',
            opacity: isDetailOpen ? 1 : 0,
            pointerEvents: isDetailOpen ? 'auto' : 'none',
            transform: isDetailOpen
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(0.6)',
            transitionDuration: isDetailOpen ? '450ms' : '240ms',
            transitionDelay: isDetailOpen ? '250ms' : '0ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#3E3A3C"
            strokeWidth="1.3"
            aria-hidden="true"
            style={{ width: '36%', height: '36%' }}
          >
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" />
          </svg>
        </button>

        {/* ================================================================
            BUNTO° RIGHT-SIDE STAGGERED GATE & FEATURED DISH PANEL
           ================================================================ */}
        {openedEntry && activePreviewDish && openSlot !== null && (
          <div
            data-no-ring-drag="true"
            data-testid="bunto-detail-panel"
            className="absolute z-[310]"
            style={{
              left: isPhoneLayout
                ? 'calc(50% - 260 * var(--bu))'
                : 'calc(865 * var(--bu))',
              top: isPhoneLayout ? 'calc(446 * var(--bu))' : 'calc(255 * var(--bu))',
              width: isPhoneLayout ? 'calc(520 * var(--bu))' : 'calc(430 * var(--bu))',
              pointerEvents: isDetailOpen ? 'auto' : 'none',
            }}
          >
            {/* Child 1: Category line */}
            <p
              className="bunto-panel-child uppercase font-medium tracking-[0.28em] text-[#716D71]"
              style={{
                fontSize: isPhoneLayout ? '9px' : 'max(9px, calc(10 * var(--bu)))',
                transitionDelay: '0ms',
              }}
            >
              Gate {openedEntry.room.roman} · {openedEntry.room.title} · {openedEntry.dishes.length}{' '}
              Dishes
            </p>

            {/* Child 2: Dish Title & Price */}
            <h3
              data-testid="bunto-active-dish-title"
              className="bunto-panel-child font-medium text-[#3E3A3C] leading-[1.1] tracking-[-0.025em]"
              style={{
                fontSize: isPhoneLayout ? '21px' : 'max(22px, calc(34 * var(--bu)))',
                marginTop: isPhoneLayout ? '8px' : 'calc(12 * var(--bu))',
                marginBottom: isPhoneLayout ? '8px' : 'calc(12 * var(--bu))',
                transitionDelay: '60ms',
              }}
            >
              {activePreviewDish.title}
              <span
                className="ml-2.5 font-normal text-[#716D71]"
                style={{ fontSize: '0.62em' }}
              >
                {formatINR(activePreviewDish.price)}
              </span>
            </h3>

            {/* Child 3: Description */}
            <p
              className={`bunto-panel-child text-[#716D71] leading-[1.55] ${
                isPhoneLayout ? 'line-clamp-3' : ''
              }`}
              style={{
                fontSize: isPhoneLayout ? '12.5px' : 'max(12.5px, calc(14 * var(--bu)))',
                maxWidth: '32ch',
                transitionDelay: '120ms',
              }}
            >
              {activePreviewDish.description}
            </p>

            {/* Child 4: Four Signature Dish Swatches (responsive 1:1 % crop!) */}
            <div
              className="bunto-panel-child"
              style={{
                marginTop: isPhoneLayout ? '12px' : 'calc(24 * var(--bu))',
                marginBottom: isPhoneLayout ? '14px' : 'calc(28 * var(--bu))',
                transitionDelay: '180ms',
              }}
            >
              <p
                className="uppercase tracking-[0.24em] text-[#716D71] mb-2.5"
                style={{ fontSize: '9px' }}
              >
                Signature dishes in this room
              </p>
              <div
                role="radiogroup"
                aria-label={`Featured dishes in ${openedEntry.room.title}`}
                className="flex items-center"
                style={{ gap: isPhoneLayout ? '12px' : 'calc(14 * var(--bu))' }}
              >
                {openedEntry.swatches.map((swatchDish, sIdx) => {
                  const isChecked = sIdx === activeSwatchIdx;
                  return (
                    <button
                      key={swatchDish.id}
                      type="button"
                      role="radio"
                      aria-checked={isChecked}
                      aria-label={swatchDish.title}
                      data-testid={`gate-dish-swatch-${sIdx}`}
                      onClick={() => handleSelectSwatch(openSlot, openedEntry.globalIndex, sIdx)}
                      className="bunto-swatch rounded-full overflow-hidden border border-[#D8C9BA] shrink-0"
                      style={{
                        width: 'max(34px, calc(42 * var(--bu)))',
                        height: 'max(34px, calc(42 * var(--bu)))',
                        ...getGatePercentCropStyle(swatchDish.sheetId, swatchDish.cellIndex, 1),
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Child 5: ADD TO BAG (3D Parabolic Flying Dish!) + ENTER 3D ROOM */}
            <div
              className="bunto-panel-child flex flex-wrap items-center gap-x-7 gap-y-3"
              style={{ transitionDelay: '240ms' }}
            >
              <button
                type="button"
                data-testid="bunto-add-to-bag"
                onClick={(e) => handleQuickAddToBag(e)}
                className="uppercase font-medium tracking-[0.28em] text-[#3E3A3C] border-b border-[#3E3A3C] pb-1 hover:text-[#B84C2E] hover:border-[#B84C2E] transition-colors whitespace-nowrap"
                style={{ fontSize: isPhoneLayout ? '10px' : 'max(9.5px, calc(10 * var(--bu)))' }}
              >
                {addedFeedback ? 'ADDED TO BAG ✓' : 'ADD TO BAG →'}
              </button>

              <button
                type="button"
                data-testid={`gateway-enter-${openedEntry.room.id}`}
                onClick={() => onStepThroughGate(openedEntry.room)}
                className="uppercase font-medium tracking-[0.24em] text-[#FAF6EE] bg-[#1B2726] hover:bg-[#B84C2E] px-4 py-2.5 transition-colors whitespace-nowrap"
                style={{ fontSize: isPhoneLayout ? '9.5px' : 'max(9px, calc(9.5 * var(--bu)))' }}
              >
                ENTER 3D ROOM →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
