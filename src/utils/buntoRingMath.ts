/**
 * Pure mathematical geometry for Hopin's BUNTO°-faithful Rotating Culinary Gate Ring
 * (exact 6-piece floating ring geometry: CX=718, CY=418, R=411, DROP=110, S0=0.97, TILT=9°)
 * and 3D Perspective Banking Quadratic Bézier Flying Dish-to-Bag animation.
 */

export const BUNTO_STAGE_W = 1440;
export const BUNTO_STAGE_H = 900;
export const BUNTO_CX = 718;
export const BUNTO_CY = 418;
export const BUNTO_R = 411;
export const BUNTO_DROP = 110;
export const BUNTO_S0 = 0.97;
export const BUNTO_TILT_DEG = 9;
export const BUNTO_RING_SLOTS = 6;
export const BUNTO_TOTAL_GATES = 12;
export const BUNTO_SLOT_STEP = (Math.PI * 2) / BUNTO_RING_SLOTS;
export const BUNTO_DETAIL_DURATION_MS = 560;
export const BUNTO_FLY_DURATION_MS = 950;
export const BUNTO_SECONDS_PER_SLOT = 4.2;

export interface BuntoRingPose {
  /** Design-frame X coordinate */
  x: number;
  /** Design-frame Y coordinate */
  y: number;
  /** Scale multiplier */
  scale: number;
  /** Outward lean angle in degrees */
  rotateDeg: number;
  /** Depth z-index */
  zIndex: number;
  /** Frontness factor k = (1 + cos θ) / 2 in [0, 1] */
  k: number;
  /** Ring cosine cos(θ) */
  cos: number;
  /** Ring sine sin(θ) */
  sin: number;
  /** Base visibility opacity (smooth back-of-ring handoff when totalCount > 6) */
  baseOpacity: number;
  /** Signed shortest slot distance from front center */
  relSlot: number;
}

export interface BuntoDetailPose {
  x: number;
  y: number;
  scale: number;
  rotateDeg: number;
  zIndex: number;
  opacity: number;
  pointerEvents: boolean;
}

export interface BuntoRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlyKeyframePose {
  t: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotateDeg: number;
  rotateXDeg: number;
  rotateYDeg: number;
  opacity: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function buntoEaseInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function buntoEaseOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Exact BUNTO° horizontal elliptical ring geometry scaled seamlessly to all 12 Hopin submenus:
 * - Adjacent submenus ALWAYS sit 60° (2π / 6) apart — preserving exact airy 6-piece BUNTO° spacing!
 * - Front piece (rel = 0, k = 1): largest (0.97), straight (0°), highest (CY = 418), z-index 101.
 * - Side pieces (rel = ±1, ±2): smaller, lower, leaning outwards ±9°.
 * - When totalCount > 6 (all 12 submenus on one continuous ring), pieces beyond |rel| > 2.45
 *   cross-fade smoothly right behind the front piece at dead-back (|rel| = 3) so all 12 flow
 *   continuously through the 6-piece silhouette without ever crowding.
 */
export function computeBuntoRingPose(
  index: number,
  baseAngle: number,
  totalCount: number = BUNTO_TOTAL_GATES,
  isPhone: boolean = false
): BuntoRingPose {
  const count = Math.max(1, totalCount);
  const step = count <= BUNTO_RING_SLOTS ? (Math.PI * 2) / count : BUNTO_SLOT_STEP;
  const activeFloat = -baseAngle / step;

  let rel = ((index - activeFloat) % count + count) % count;
  if (rel >= count / 2) rel -= count;

  const theta = rel * step;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const k = (1 + cos) * 0.5;

  // Desktop preserves exact BUNTO° geometry; phone narrows horizontal spread so neighboring
  // cards frame symmetrically inside 390px instead of slicing off harshly at viewport edges.
  const radius = isPhone ? 248 : BUNTO_R;
  const cy = isPhone ? 396 : BUNTO_CY;
  const drop = isPhone ? 86 : BUNTO_DROP;
  const s0 = isPhone ? 0.88 : BUNTO_S0;
  const tilt = isPhone ? 7.5 : BUNTO_TILT_DEG;

  const x = BUNTO_CX + radius * sin;
  const y = cy + (1 - k) * drop;
  const scale = s0 * (isPhone ? 0.68 + 0.32 * k : 0.72 + 0.28 * k);
  const rotateDeg = tilt * sin + 0;

  let baseOpacity = 1;
  let zIndex = Math.round(k * 100) + 1;

  if (count > BUNTO_RING_SLOTS) {
    const absRel = Math.abs(rel);
    if (absRel >= 3.15) {
      baseOpacity = 0;
      zIndex = 0;
    } else if (absRel > 2.45) {
      baseOpacity = 1 - smoothstep01((absRel - 2.45) / 0.7);
      zIndex = Math.max(1, Math.round(k * 100));
    }
  }

  return {
    x,
    y,
    scale,
    rotateDeg,
    zIndex,
    k,
    cos,
    sin,
    baseOpacity,
    relSlot: rel,
  };
}

/**
 * Exact BUNTO° staggered entrance rise for each piece on the ring (front pieces rise first).
 */
export function computeBuntoEntranceOffset(
  enteredProgress: number,
  cosTheta: number
): { offsetY: number; scaleMul: number; opacity: number } {
  const raw = clamp((enteredProgress * 1600 - (1 - cosTheta) * 260) / 1000, 0, 1);
  const eased = buntoEaseOutCubic(raw);
  return {
    offsetY: (1 - eased) * 36,
    scaleMul: 0.95 + 0.05 * eased,
    opacity: eased,
  };
}

/**
 * Returns the index (0..totalCount-1) of the piece currently closest to front center.
 */
export function findBuntoFrontIndex(
  baseAngle: number,
  totalCount: number = BUNTO_TOTAL_GATES
): number {
  const count = Math.max(1, totalCount);
  const step = count <= BUNTO_RING_SLOTS ? (Math.PI * 2) / count : BUNTO_SLOT_STEP;
  const activeFloat = -baseAngle / step;
  const rounded = Math.round(activeFloat);
  return ((rounded % count) + count) % count;
}

/**
 * Computes the shortest wrapped target baseAngle so clicking any of the 12 dots
 * glides smoothly around the continuous ring (e.g. Gate XII -> Gate I takes 1 step, not 11).
 */
export function computeShortestRingTargetAngle(
  currentBaseAngle: number,
  targetIndex: number,
  totalCount: number = BUNTO_TOTAL_GATES
): number {
  const count = Math.max(1, totalCount);
  const step = count <= BUNTO_RING_SLOTS ? (Math.PI * 2) / count : BUNTO_SLOT_STEP;
  const currentFloat = -currentBaseAngle / step;
  let diff = ((targetIndex - currentFloat) % count + count) % count;
  if (diff >= count / 2) diff -= count;
  return -(currentFloat + diff) * step;
}

/**
 * Exact BUNTO° target rest pose for the opened piece in Detail View.
 */
export function getBuntoDetailTarget(isPhone: boolean): { x: number; y: number; scale: number } {
  return isPhone
    ? { x: 716, y: 248, scale: 0.78 }
    : { x: 470, y: 425, scale: 1.12 };
}

/**
 * Exact BUNTO° detail transition interpolation (560ms ease-in-out cubic).
 */
export function computeBuntoDetailPose(
  ringPose: BuntoRingPose,
  isChosen: boolean,
  chosenRingX: number,
  detailBlend: number,
  isPhone: boolean
): BuntoDetailPose {
  const d = clamp(detailBlend, 0, 1);
  if (d <= 0.0001) {
    return {
      x: ringPose.x,
      y: ringPose.y,
      scale: ringPose.scale,
      rotateDeg: ringPose.rotateDeg,
      zIndex: ringPose.zIndex,
      opacity: ringPose.baseOpacity,
      pointerEvents: ringPose.baseOpacity > 0.25,
    };
  }

  if (isChosen) {
    const target = getBuntoDetailTarget(isPhone);
    return {
      x: ringPose.x + (target.x - ringPose.x) * d,
      y: ringPose.y + (target.y - ringPose.y) * d,
      scale: ringPose.scale + (target.scale - ringPose.scale) * d,
      rotateDeg: ringPose.rotateDeg * (1 - d) + 0,
      zIndex: 300,
      opacity: 1,
      pointerEvents: true,
    };
  }

  const sideSign = ringPose.x >= chosenRingX ? 1 : -1;
  return {
    x: ringPose.x + sideSign * 240 * d,
    y: ringPose.y,
    scale: ringPose.scale * (1 - 0.45 * d),
    rotateDeg: ringPose.rotateDeg,
    zIndex: ringPose.zIndex,
    opacity: ringPose.baseOpacity * Math.max(0, 1 - 1.4 * d),
    pointerEvents: false,
  };
}

/**
 * Exact BUNTO° floor shadow transform under the ring / opened piece.
 */
export function computeBuntoShadowPose(
  detailBlend: number,
  isPhone: boolean
): { tx: number; ty: number; scaleX: number } {
  const d = clamp(detailBlend, 0, 1);
  const target = getBuntoDetailTarget(isPhone);
  return {
    tx: (target.x - BUNTO_CX) * 0.82 * d,
    ty: (target.y - BUNTO_CY) * d + (isPhone ? -60 * d : 0),
    scaleX: 1 - 0.45 * d,
  };
}

/**
 * Exact BUNTO° close button placement at the top-right corner of the opened piece.
 */
export function computeBuntoClosePos(isPhone: boolean): { x: number; y: number } {
  const target = getBuntoDetailTarget(isPhone);
  return {
    x: target.x + 158 * target.scale,
    y: target.y - 188 * target.scale,
  };
}

/**
 * Upgraded 25-keyframe Quadratic Bézier 3D Banking Flying Dish-to-Bag trajectory:
 * - High graceful parabolic arc from source dish portrait to exact Bag icon center.
 * - Initial 1.10x buoyant lift swell over first 14% with 3D tilt pitch (rotateX / rotateY),
 *   then smooth mid-flight 3D banking roll and early shrink (exponent 0.55) into the bag mouth.
 */
export function computeFlyToBagKeyframes(
  source: BuntoRect,
  bag: BuntoRect,
  steps: number = 25
): FlyKeyframePose[] {
  const startX = source.left;
  const startY = source.top;
  const endX = bag.left + bag.width * 0.5 - source.width * 0.5;
  const endY = bag.top + bag.height * 0.5 - source.height * 0.5;

  const lift = Math.max(54, Math.min(130, 0.42 * source.height + 36));
  const ctrlX = startX + 0.56 * (endX - startX);
  const ctrlY = Math.max(8, Math.min(startY, endY) - lift);

  const targetVisualPx = Math.max(22, Math.min(34, Math.min(bag.width, bag.height) * 0.65));
  const endScale = Math.max(0.14, Math.min(0.65, targetVisualPx / Math.max(1, source.width)));
  const frames: FlyKeyframePose[] = [];
  const count = Math.max(2, steps);

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const inv = 1 - t;

    const px = inv * inv * startX + 2 * inv * t * ctrlX + t * t * endX;
    const py = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY;

    let scale: number;
    if (t <= 0.14) {
      scale = 1 + 0.1 * Math.sin((t / 0.14) * Math.PI * 0.5);
    } else {
      const shrinkT = (t - 0.14) / 0.86;
      scale = 1.1 + (endScale - 1.1) * Math.pow(shrinkT, 0.55);
    }

    // Dynamic 3D banking turn so the dish lifts, arcs, banks, and tucks physically into the bag
    const rotateDeg = -20 * Math.sin(Math.PI * t) + 10 * Math.sin(Math.PI * 2 * t) * (1 - t) + 0;
    const rotateXDeg = 16 * Math.sin(Math.PI * t) + 0;
    const rotateYDeg = -22 * Math.sin(Math.PI * t) + 26 * t * Math.sin(Math.PI * t) + 0;
    const opacity = t >= 0.88 ? 1 - ((t - 0.88) / 0.12) * 0.62 : 1;

    frames.push({
      t,
      translateX: px - startX,
      translateY: py - startY,
      scale,
      rotateDeg,
      rotateXDeg,
      rotateYDeg,
      opacity,
    });
  }

  return frames;
}
