/**
 * Pure scroll-scrubbed parallax & portal choreography for Hopin's
 * Elsewhere-inspired twilight terracotta moon-gate landing hero.
 *
 * Desktop timeline across a 170svh section with a sticky 100svh stage:
 * - 0%  .. 20%: Hold the framed terracotta archway & upscaled Hopin twilight bungalow
 * - 20% .. 75%: Scale the foreground grotto smoothly from 1 -> 3.45 around its
 *               circular opening, easing foreground opacity out over the final third,
 *               while the upscaled bungalow plate scales slowly 1 -> 1.08 for depth.
 * - 75% .. 100%: Settle onto the unobstructed upscaled Hopin entrance and release
 *                naturally into the rotating 12 Gates ring.
 */

export interface ElsewhereHeroState {
  /** Scale of the foreground stone & foliage moon-gate (1.0 -> 3.45) */
  grottoScale: number;
  /** Opacity of the foreground moon-gate (1.0 -> 0.0 over final third of dive) */
  grottoOpacity: number;
  /** Slow background plate depth scale (1.0 -> 1.08) */
  skyScale: number;
  /** Hero lower-left copy opacity (fades gently as you dive into the bungalow) */
  copyOpacity: number;
  /** Hero copy vertical drift in px */
  copyTranslateY: number;
  /** Localized dark scrim opacity behind lower-left headline */
  scrimOpacity: number;
  /** Whether the foreground archway has completely cleared */
  cleared: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function computeElsewhereScrollState(
  scrollProgress: number,
  isMobile: boolean = false,
  reducedMotion: boolean = false
): ElsewhereHeroState {
  if (reducedMotion) {
    return {
      grottoScale: 1,
      grottoOpacity: 0.35,
      skyScale: 1,
      copyOpacity: 1,
      copyTranslateY: 0,
      scrimOpacity: 0.72,
      cleared: false,
    };
  }

  const p = clamp01(scrollProgress);

  if (isMobile) {
    // On narrow mobile screens: brief natural crossfade without sticky pinning
    const fade = easeOutCubic(clamp01((p - 0.08) / 0.55));
    return {
      grottoScale: 1 + fade * 0.42,
      grottoOpacity: 1 - fade,
      skyScale: 1 + fade * 0.04,
      copyOpacity: 1,
      copyTranslateY: 0,
      scrimOpacity: 0.78 - fade * 0.14,
      cleared: fade >= 0.98,
    };
  }

  // Desktop 170svh scrub: 0..20% hold, 20..75% dive through moon-gate, 75..100% settle
  const diveLinear = clamp01((p - 0.2) / 0.55);
  const diveEased = easeInOutCubic(diveLinear);

  // Foreground moon-gate expands organically around its opening center (1 -> 3.45)
  const grottoScale = 1 + diveEased * 2.45;

  // Ease foreground opacity out cleanly over the final third of the 20..75% move
  const fadeThird = clamp01((diveLinear - 0.64) / 0.36);
  const grottoOpacity = 1 - easeOutCubic(fadeThird);

  // Background upscaled Hopin entrance scales slowly (1 -> 1.08) for cinematic depth
  const skyScale = 1 + diveEased * 0.08;

  // Keep lower-left hero headline crisp at rest, then softly recede near the end of dive
  // and stay readable when settled over the lower-left shadow
  const copyFade = clamp01((diveLinear - 0.55) / 0.45);
  const copyOpacity = 1 - copyFade * 0.18;
  const copyTranslateY = -diveEased * 14;
  const scrimOpacity = 0.72 + (1 - grottoOpacity) * 0.16;

  return {
    grottoScale,
    grottoOpacity,
    skyScale,
    copyOpacity,
    copyTranslateY,
    scrimOpacity,
    cleared: diveLinear >= 0.99,
  };
}
