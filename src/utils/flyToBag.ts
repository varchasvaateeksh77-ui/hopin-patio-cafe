import { SHEETS, type DishItem } from '../data/cafeData';
import { BUNTO_FLY_DURATION_MS, computeFlyToBagKeyframes } from './buntoRingMath';
import { getResponsiveCropStyle } from './galleryMath';

/**
 * Resolves a viewport-safe circular launch origin for the flying dish medallion.
 * If `sourceEl` scrolled off-screen (e.g. DishModal on a phone after scrolling down
 * to the Add to Bag button), falls back cleanly to `fallbackTriggerEl` or viewport center
 * and scales the medallion proportionally so it never swamps the mobile header.
 */
function resolveLaunchOrigin(
  sourceEl: HTMLElement | null,
  fallbackTriggerEl: HTMLElement | null,
  isMobile: boolean
): { left: number; top: number; diameter: number } | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const srcRect = sourceEl?.getBoundingClientRect();
  const srcVisible =
    !!srcRect &&
    srcRect.width > 8 &&
    srcRect.height > 8 &&
    srcRect.bottom > 84 &&
    srcRect.top < vh - 24 &&
    srcRect.right > 10 &&
    srcRect.left < vw - 10;

  const trigRect = fallbackTriggerEl?.getBoundingClientRect();
  const trigVisible =
    !!trigRect &&
    trigRect.width > 8 &&
    trigRect.height > 8 &&
    trigRect.bottom > 56 &&
    trigRect.top < vh;

  const activeRect = srcVisible ? srcRect! : trigVisible ? trigRect! : srcRect;
  if (!activeRect || activeRect.width <= 0 || activeRect.height <= 0) return null;

  // Compact jewel-sized medallion on mobile (64–76px) vs sculptural token on desktop (84–148px)
  const maxDiam = isMobile ? 72 : 148;
  const minDiam = isMobile ? 56 : 64;
  const rawDiam = Math.min(activeRect.width, activeRect.height);
  const diameter = Math.max(minDiam, Math.min(rawDiam, maxDiam));

  // Clamp center strictly inside the visible viewport below the sticky 56px navbar
  const rawCx = activeRect.left + activeRect.width * 0.5;
  const rawCy = activeRect.top + activeRect.height * 0.5;
  const cx = Math.max(diameter * 0.5 + 12, Math.min(vw - diameter * 0.5 - 12, rawCx));
  const cy = Math.max(76 + diameter * 0.5, Math.min(vh - diameter * 0.5 - 16, rawCy));

  return {
    left: cx - diameter * 0.5,
    top: cy - diameter * 0.5,
    diameter,
  };
}

/**
 * Triggers Hopin's tactile 3D Parabolic Flying Dish-to-Bag animation:
 * 1. Soft expanding launch ripple at the dish's lift-off center.
 * 2. Circular un-zoomed dish medallion lifting & banking in 3D perspective
 *    along a 25-keyframe quadratic Bézier arc straight into the Order bag.
 * 3. Two subtle staggered ghost motion-echo trails dissolving along the arc.
 * 4. Elastic squash-and-stretch Bag Catch wiggle + count badge overshoot pop + rising "+1" indicator.
 */
export function flyDishToBag(
  dish: DishItem,
  sourceEl: HTMLElement | null,
  onLand: () => void,
  quantityLabel: number = 1,
  fallbackTriggerEl: HTMLElement | null = null
): void {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bagBtn = document.querySelector<HTMLElement>('[data-testid="navbar-bag-btn"]');

  if (prefersReduced || (!sourceEl && !fallbackTriggerEl) || !bagBtn) {
    onLand();
    return;
  }

  const isMobile = window.innerWidth <= 820;
  const origin = resolveLaunchOrigin(sourceEl, fallbackTriggerEl, isMobile);
  const bagRect = bagBtn.getBoundingClientRect();

  if (!origin || bagRect.width <= 0) {
    onLand();
    return;
  }

  const { left: startLeft, top: startTop, diameter } = origin;
  const sheet = SHEETS[dish.sheetId];
  const crop = getResponsiveCropStyle(sheet, dish.cellIndex, 1);
  const durationMs = isMobile ? 760 : BUNTO_FLY_DURATION_MS;

  // 1. Subtle expanding launch ring ripple at the lift-off center
  const ripple = document.createElement('div');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.position = 'fixed';
  ripple.style.left = `${startLeft}px`;
  ripple.style.top = `${startTop}px`;
  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.borderRadius = '9999px';
  ripple.style.border = '1.5px solid rgba(184, 76, 46, 0.55)';
  ripple.style.pointerEvents = 'none';
  ripple.style.zIndex = '998';
  document.body.appendChild(ripple);
  const rippleAnim = ripple.animate(
    [
      { transform: 'scale(0.84)', opacity: 0.72 },
      { transform: 'scale(1.34)', opacity: 0 },
    ],
    { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
  );
  rippleAnim.onfinish = () => ripple.remove();
  rippleAnim.oncancel = () => ripple.remove();

  // Compute exact 25-keyframe 3D parabolic flight trajectory
  const poses = computeFlyToBagKeyframes(
    {
      left: startLeft,
      top: startTop,
      width: diameter,
      height: diameter,
    },
    {
      left: bagRect.left,
      top: bagRect.top,
      width: bagRect.width,
      height: bagRect.height,
    },
    25
  );

  const buildFlyerNode = (isTrail: boolean, baseOpacity: number): HTMLDivElement => {
    const node = document.createElement('div');
    if (!isTrail) node.setAttribute('data-testid', 'flying-dish-clone');
    else node.setAttribute('aria-hidden', 'true');
    node.style.position = 'fixed';
    node.style.left = `${startLeft}px`;
    node.style.top = `${startTop}px`;
    node.style.width = `${diameter}px`;
    node.style.height = `${diameter}px`;
    node.style.zIndex = isTrail ? '999' : '1000';
    node.style.pointerEvents = 'none';
    node.style.borderRadius = '9999px';
    node.style.overflow = 'hidden';
    node.style.border = isTrail
      ? '1.5px solid rgba(249, 242, 233, 0.5)'
      : isMobile
      ? '2px solid #FAF6EE'
      : '3px solid #FAF6EE';
    node.style.backgroundImage = `url("${sheet.url}")`;
    node.style.backgroundSize = crop.backgroundSize;
    node.style.backgroundPosition = crop.backgroundPosition;
    node.style.backgroundRepeat = 'no-repeat';
    node.style.filter = isTrail
      ? 'blur(1px)'
      : 'drop-shadow(0 14px 20px rgba(72, 52, 42, 0.28))';
    node.style.transformOrigin = 'center center';
    node.style.willChange = 'transform, opacity';
    node.style.opacity = String(baseOpacity);
    return node;
  };

  // 2. Two staggered soft motion-echo trails following behind the main dish
  const trailSpecs = [
    { delay: 45, opacityScale: 0.34, scaleMul: 0.9 },
    { delay: 90, opacityScale: 0.16, scaleMul: 0.8 },
  ];

  for (const spec of trailSpecs) {
    const trail = buildFlyerNode(true, 0);
    document.body.appendChild(trail);
    const trailKeyframes: Keyframe[] = poses.map((p) => ({
      transform: `perspective(900px) translate3d(${p.translateX.toFixed(1)}px, ${p.translateY.toFixed(1)}px, 0) rotateX(${p.rotateXDeg.toFixed(1)}deg) rotateY(${p.rotateYDeg.toFixed(1)}deg) rotateZ(${p.rotateDeg.toFixed(2)}deg) scale(${(p.scale * spec.scaleMul).toFixed(4)})`,
      opacity: p.opacity * spec.opacityScale * (1 - p.t * 0.45),
    }));
    const trailAnim = trail.animate(trailKeyframes, {
      duration: durationMs - spec.delay * 0.35,
      delay: spec.delay,
      easing: 'cubic-bezier(.42, 0, .22, 1)',
      fill: 'forwards',
    });
    trailAnim.onfinish = () => trail.remove();
    trailAnim.oncancel = () => trail.remove();
  }

  // 3. Main circular dish medallion flying in 3D perspective
  const clone = buildFlyerNode(false, 1);
  document.body.appendChild(clone);

  const mainKeyframes: Keyframe[] = poses.map((p) => ({
    transform: `perspective(900px) translate3d(${p.translateX.toFixed(1)}px, ${p.translateY.toFixed(1)}px, 0) rotateX(${p.rotateXDeg.toFixed(1)}deg) rotateY(${p.rotateYDeg.toFixed(1)}deg) rotateZ(${p.rotateDeg.toFixed(2)}deg) scale(${p.scale.toFixed(4)})`,
    opacity: p.opacity,
  }));

  const anim = clone.animate(mainKeyframes, {
    duration: durationMs,
    easing: 'cubic-bezier(.42, 0, .22, 1)',
    fill: 'forwards',
  });

  const finish = () => {
    clone.remove();
    onLand();

    // 4. Tactile squash-and-stretch Bag Catch wiggle
    bagBtn.animate(
      [
        { transform: 'scale(1, 1) rotate(0deg)' },
        { transform: 'scale(1.22, 0.88) rotate(-8deg)', offset: 0.28 },
        { transform: 'scale(0.93, 1.1) rotate(4deg)', offset: 0.62 },
        { transform: 'scale(1.04, 0.98) rotate(-1.5deg)', offset: 0.82 },
        { transform: 'scale(1, 1) rotate(0deg)' },
      ],
      {
        duration: 520,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
      }
    );

    // Floating "+N" confirmation badge rising cleanly near the Bag button
    const liveBagRect = bagBtn.getBoundingClientRect();
    const popPlus = document.createElement('div');
    popPlus.setAttribute('aria-hidden', 'true');
    popPlus.textContent = `+${Math.max(1, quantityLabel)}`;
    popPlus.style.position = 'fixed';
    popPlus.style.left = `${liveBagRect.left + liveBagRect.width * 0.5}px`;
    popPlus.style.top = `${liveBagRect.bottom + 2}px`;
    popPlus.style.transform = 'translate(-50%, 0)';
    popPlus.style.padding = '2px 7px';
    popPlus.style.borderRadius = '9999px';
    popPlus.style.background = '#B84C2E';
    popPlus.style.color = '#FAF6EE';
    popPlus.style.fontFamily = '"Inter", system-ui, sans-serif';
    popPlus.style.fontSize = '10px';
    popPlus.style.fontWeight = '600';
    popPlus.style.letterSpacing = '0.06em';
    popPlus.style.zIndex = '1001';
    popPlus.style.pointerEvents = 'none';
    document.body.appendChild(popPlus);

    const plusAnim = popPlus.animate(
      [
        { transform: 'translate(-50%, 4px) scale(0.72)', opacity: 0 },
        { transform: 'translate(-50%, -8px) scale(1.06)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%, -22px) scale(0.92)', opacity: 0 },
      ],
      { duration: 640, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );
    plusAnim.onfinish = () => popPlus.remove();
    plusAnim.oncancel = () => popPlus.remove();

    // Pulse the live bag count pill after React commits the updated count
    window.requestAnimationFrame(() => {
      const badge = document.querySelector<HTMLElement>('[data-testid="bag-count-badge"]');
      if (badge) {
        badge.animate(
          [
            { transform: 'scale(0.85)' },
            { transform: 'scale(1.48)', offset: 0.45 },
            { transform: 'scale(1)' },
          ],
          {
            duration: 420,
            delay: 40,
            easing: 'cubic-bezier(.34, 1.56, .64, 1)',
          }
        );
      }
    });
  };

  anim.onfinish = finish;
  anim.oncancel = () => {
    clone.remove();
  };
}
