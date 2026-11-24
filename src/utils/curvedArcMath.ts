/**
 * Pure geometry and spring physics for Hopin's "Twelve Gates of Heaven"
 * curved 3D bowl-arc colonnade (inspired by the Leon Vasari curved shelf math).
 *
 * 12 culinary gates are tiled 3 times (36 virtual slots) along an infinite arc.
 * The centered gate (r = 0) rotates 90 degrees in 3D so its ornate portal cover
 * faces the visitor while pushing neighbouring gate pillars smoothly apart.
 */

export const GATE_COUNT = 12;
export const COPY_COUNT = 3;
export const TOTAL_SLOTS = GATE_COUNT * COPY_COUNT; // 36
export const PERSPECTIVE_PX = 1400;

export interface ArcMetrics {
  /** Base gate height in px */
  H: number;
  /** Spine / pillar face width in px */
  ws: number;
  /** Portal cover face width (depth of the 3D volume) in px */
  d: number;
  /** Base spacing between neighbouring pillars in px */
  gap: number;
  /** Depth falloff distance in px */
  U: number;
  /** CSS perspective distance in px */
  P: number;
  /** Precomputed cumulative screen-x lookup table (2px steps up to 3*U) */
  XS: Float64Array;
}

export interface GatePose {
  visible: boolean;
  /** Openness factor: 0 = side pillar spine, 1 = centered open portal */
  o: number;
  /** Arc length from center in px */
  u: number;
  /** Perspective screen scale (0..1) */
  sc: number;
  /** 3D transform coordinates in px */
  x: number;
  y: number;
  z: number;
  /** 3D rotations in degrees */
  rotateX: number;
  rotateY: number;
  /** Stacking order */
  zIndex: number;
  /** Dynamic shading overlay opacity for spine & cover faces */
  spineShade: number;
  coverShade: number;
}

export function clamp01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * Wraps virtual slot index `v` relative to continuous scroll position `s`
 * into the symmetric half-open range [-18, 18).
 */
export function relIndex(v: number, s: number, totalSlots = TOTAL_SLOTS): number {
  const half = totalSlots / 2;
  let r = (v - s) % totalSlots;
  if (r < -half) r += totalSlots;
  if (r >= half) r -= totalSlots;
  return r;
}

/**
 * Smooth opening displacement curve B(r):
 *   (r + sin(pi * r) / pi) / 2   for |r| < 1
 *   +/- 0.5                      for |r| >= 1
 * Ensures the centered 90°-turned gate smoothly pushes neighbouring pillars apart.
 */
export function arcOffsetB(r: number): number {
  if (Math.abs(r) < 1) {
    return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
  }
  return r >= 0 ? 0.5 : -0.5;
}

/**
 * Arc length u from the center along the curved sanctuary shelf.
 */
export function arcLengthF(r: number, ws: number, d: number, gap: number): number {
  return r * (ws + gap) + (d - ws + 1.4 * gap) * arcOffsetB(r);
}

/**
 * On-screen perspective scale at arc distance u.
 */
export function screenScale(u: number, U: number): number {
  const ratio = Math.abs(u) / Math.max(1, U);
  return 1 / (1 + Math.pow(ratio, 1.6));
}

/**
 * Precomputes integral of screenScale(u) from 0 to 3*U in 2px increments
 * so far-edge gate pillars pack tightly in screen space.
 */
export function buildScreenXTable(U: number): Float64Array {
  const safeU = Math.max(1, U);
  const steps = Math.ceil((3 * safeU) / 2) + 2;
  const table = new Float64Array(steps);
  let acc = 0;
  for (let i = 1; i < steps; i++) {
    const u = i * 2;
    acc += 2 / (1 + Math.pow(u / safeU, 1.6));
    table[i] = acc;
  }
  return table;
}

/**
 * Evaluates signed screen-x position from the precomputed integral table.
 */
export function evalScreenX(u: number, XS: Float64Array): number {
  const absU = Math.abs(u);
  const idxF = absU / 2;
  const i0 = Math.min(XS.length - 1, Math.floor(idxF));
  const i1 = Math.min(XS.length - 1, i0 + 1);
  const frac = idxF - i0;
  const val = XS[i0] + (XS[i1] - XS[i0]) * frac;
  return u < 0 ? -val : val;
}

/**
 * Builds all proportional geometry metrics from the measured stage gate height H.
 */
export function createArcMetrics(H: number, isMobile: boolean): ArcMetrics {
  const safeH = Math.max(160, H);
  const ws = (safeH * 148) / 840;
  const d = (safeH * 500) / 860;
  const gap = safeH * 0.036;
  const U = safeH * (isMobile ? 1.05 : 1.32);
  const P = PERSPECTIVE_PX;
  const XS = buildScreenXTable(U);
  return { H: safeH, ws, d, gap, U, P, XS };
}

/**
 * Computes exact 3D bowl-arc pose & shading for a single gate volume.
 */
export function computeGatePose(
  r: number,
  lift: number,
  tiltX: number,
  tiltY: number,
  m: ArcMetrics
): GatePose {
  const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
  const u = arcLengthF(r, m.ws, m.d, m.gap);

  if (Math.abs(u) > m.U * 1.95) {
    return {
      visible: false,
      o,
      u,
      sc: 0,
      x: 0,
      y: 0,
      z: -3000,
      rotateX: 0,
      rotateY: 0,
      zIndex: 0,
      spineShade: 0.6,
      coverShade: 0.82,
    };
  }

  const sc = screenScale(u, m.U);
  const k = 1 / sc;

  const z = m.P * (1 - k) + o * m.H * 0.1;
  const x = evalScreenX(u, m.XS) * k;
  const y = (m.H * 0.5 * (1 - sc) * 0.42 + o * m.H * 0.012 - lift * m.H * 0.055) * k;

  const signU = u === 0 ? 0 : u > 0 ? 1 : -1;
  const edgeTurn = signU * Math.min(1, Math.abs(u) / m.U) * 26 * (1 - o);
  const rotateY = edgeTurn - 90 * o + tiltY * o;
  const rotateX = tiltX * o;

  const spineShade = Math.min(0.6, o * 0.55 + (1 - sc) * 0.34);
  const coverShade = (1 - o) * 0.82;
  const zIndex = Math.round(3000 + z);

  return {
    visible: true,
    o,
    u,
    sc,
    x,
    y,
    z,
    rotateX,
    rotateY,
    zIndex,
    spineShade,
    coverShade,
  };
}

/**
 * Wraps any real index into [0, count).
 */
export function modGate(index: number, count = GATE_COUNT): number {
  return ((index % count) + count) % count;
}

/**
 * Given current target `currentT` and desired gate index `targetMod` (0..11),
 * returns the new continuous target via the shortest wrap-around path.
 */
export function shortestGateTarget(
  currentT: number,
  targetMod: number,
  count = GATE_COUNT
): number {
  const base = Math.round(currentT);
  const currMod = modGate(base, count);
  let delta = modGate(targetMod, count) - currMod;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return base + delta;
}

/**
 * Computes continuous normalized ruler position [0, 1] for the gliding golden dot
 * along the 12-Gate bottom timeline, handling the Gate XII -> Gate I wrap cleanly.
 */
export function computeRulerProgress(s: number, count = GATE_COUNT): number {
  const floorS = Math.floor(s);
  const frac = s - floorS;
  const i0 = modGate(floorS, count);
  const i1 = modGate(floorS + 1, count);

  // Wrap jump at halfway point between Gate XII (11) and Gate I (0)
  if (i0 === count - 1 && i1 === 0) {
    return frac < 0.5 ? 1 : 0;
  }
  const interp = i0 + (i1 - i0) * frac;
  return interp / (count - 1);
}
