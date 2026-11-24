/**
 * Pure 3D mathematical choreography for Hopin's WebGL Architectural Colonnade
 * & Extruded Brass Oculus Fly-Throughs (both main "H [◯] P I N" Entry and
 * all 12 Culinary Gate Portals).
 *
 * Completely decoupled from DOM/Three.js so camera trajectories, continuous
 * zero-pause velocity profiles, 3D Venetian louver rotations, navbar visibility,
 * and arch bay spacing are 100% deterministic and unit-tested via node:test.
 */

export const ENTRY_DURATION_MS = 3600;
export const GATE_ENTRY_DURATION_MS = 2350;
export const SLICE_COUNT = 8;
export const ARCH_RING_COUNT = 9;
export const MONOLITH_Z = 2.8;
export const OCULUS_WORLD_X = -1.52;
export const OCULUS_WORLD_Y = 0.08;

export interface ArchRingPose {
  /** World Z coordinate of this 3D architectural colonnade bay */
  z: number;
  /** Subtle perspective opacity/visibility factor (0..1) */
  opacity: number;
  /** Uniform scale cue for compatibility */
  scale: number;
  /** Normalized depth from far (0) to near (1) */
  depth: number;
}

export interface SlicePose {
  /** Vertical stagger offset in world units (converges to 0) */
  translateYWorld: number;
  /** True 3D louver rotation around Y axis in radians (Math.PI/2 edge-on -> 0 flat) */
  rotateYRad: number;
  /** True 3D louver rotation in degrees for readability/tests */
  rotateYDeg: number;
  /** Vertical offset percentage (legacy helper) */
  translateYPercent: number;
  /** Assembly completion 0..1 */
  progress: number;
}

export interface Hero3DCameraState {
  /** Camera position in 3D world space */
  camX: number;
  camY: number;
  camZ: number;
  /** Camera look-at target in 3D world space */
  lookX: number;
  lookY: number;
  lookZ: number;
  /** Subtle cinematic Dutch roll in radians as camera banks toward the O oculus */
  rollRad: number;
  /** Dynamic perspective field of view in degrees (widens during oculus acceleration) */
  fovDeg: number;
  /** Normalized dive progress (0..1) from monolith approach through the physical O ring */
  diveProgress: number;
  /** Whether the 3D WebGL overlay should remain mounted & visible */
  overlayActive: boolean;
  /** Opacity of the WebGL stage overlay (1 during 3D flight, dissolves cleanly into real photo) */
  overlayOpacity: number;
  /** Subtle settle counter-zoom on the unobstructed real bungalow courtyard photo */
  photoScale: number;
  /** Opacity/rise reveal (0..1) for top quiet meta & matte balustrade deck */
  uiReveal: number;
  /** True while full-screen 3D animation is running so the top navigation bar stays hidden */
  hideNavbar: boolean;
}

export interface Gate3DCameraState {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  rollRad: number;
  fovDeg: number;
  diveProgress: number;
  /** Opacity of the full-screen 3D WebGL gate portal (1 during flight, dissolves into 3D room) */
  overlayOpacity: number;
  /** Whether the portal is still active */
  overlayActive: boolean;
  /** True once camera is deep inside the portal so the destination room swaps seamlessly underneath */
  shouldSwapRoom: boolean;
  /** Opacity of the centered quiet gate typography caption (fades out cleanly before piercing the ring) */
  labelOpacity: number;
  /** True while portal is running so top navigation stays hidden */
  hideNavbar: boolean;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeInOutQuart(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function easeInExpo(t: number): number {
  const x = clamp01(t);
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes deterministic world-space Z positions for the 9 physical 3D stone & brass
 * patio colonnade archways leading toward the monumental portal wall.
 */
export function computeTunnelArch(
  ringIndex: number,
  tunnelTravel: number,
  totalRings: number = ARCH_RING_COUNT
): ArchRingPose {
  const clampedIdx = Math.max(0, Math.min(totalRings - 1, ringIndex));
  const spacing = 2.5;
  const z = 4.5 + (totalRings - 1 - clampedIdx) * spacing;
  const depth = clamp01((clampedIdx + 1) / totalRings + tunnelTravel * 0.25);
  const scale = 0.25 + depth * 1.15;
  const opacity = clamp01(0.35 + (1 - Math.abs(depth - 0.6)) * 0.55);
  return { z, depth, scale, opacity };
}

/**
 * Computes genuine 3D Venetian shutter louver rotation (edge-on 86deg -> 0deg flush)
 * and opposing vertical glide for the 8 physical 3D photographic slats framed inside the portal.
 */
export function computeSlicePose(
  sliceIndex: number,
  elapsedMs: number,
  totalSlices: number = SLICE_COUNT,
  timeScale: number = 1
): SlicePose {
  const center = (totalSlices - 1) / 2;
  const distFromCenter = Math.abs(sliceIndex - center);
  const startMs = (120 + distFromCenter * 75) * timeScale;
  const durationMs = 860 * timeScale;

  const raw = clamp01((elapsedMs - startMs) / durationMs);
  const eased = easeOutCubic(raw);
  const direction = sliceIndex % 2 === 0 ? -1 : 1;

  const rotateYDeg = direction * (1 - eased) * 86 + 0;
  const rotateYRad = (rotateYDeg * Math.PI) / 180 + 0;
  const translateYWorld = direction * (1 - eased) * 2.4 + 0;
  const translateYPercent = direction * (1 - eased) * 52 + 0;

  return {
    translateYWorld,
    rotateYRad,
    rotateYDeg,
    translateYPercent,
    progress: eased,
  };
}

/**
 * Master 3D WebGL Hero camera flight path — SINGLE CONTINUOUS ZERO-PAUSE MOMENTUM CURVE:
 *
 * Unlike piecewise beat curves (which decelerate to zero mid-flight and cause a rough pause),
 * camZ follows a single C-infinity monotonic acceleration curve across the full 2800ms dive:
 *   zProgress(u) = 0.74 * u + 0.26 * u^2
 * Its forward speed dZ/du = 0.74 + 0.52 * u NEVER drops, NEVER pauses, and glides fluidly
 * down the 9 vaulted patio arches, banks effortlessly onto the 3D brass "O" axis, and pierces
 * straight through MONOLITH_Z (2.8 -> 0.95) into the unobstructed twilight courtyard photo.
 */
export function computeHero3DCameraState(elapsedMs: number): Hero3DCameraState {
  const t = Math.max(0, Math.min(ENTRY_DURATION_MS, elapsedMs));

  const FLIGHT_MS = 2800;
  const u = clamp01(t / FLIGHT_MS);

  // Single continuous forward progression — derivative strictly >= 0.74 everywhere (ZERO rough pause!)
  const zProgress = 0.74 * u + 0.26 * u * u;
  const camZ = lerp(24.8, 0.95, zProgress);

  // Smooth lateral & vertical alignment onto the brass "O" center completed gracefully by u = 0.74
  const alignT = smootherstep(clamp01(u / 0.74));
  const camX = lerp(2.05, OCULUS_WORLD_X, alignT);
  const camY = lerp(0.88, OCULUS_WORLD_Y, alignT);

  // Look-at smoothly tracks from center of "HOPIN" onto the O axis and deep into the courtyard
  const lookFocusT = smootherstep(clamp01((u - 0.08) / 0.62));
  const lookX = lerp(0.18, OCULUS_WORLD_X, lookFocusT);
  const lookY = lerp(0.12, OCULUS_WORLD_Y, lookFocusT);
  const lookZ = lerp(MONOLITH_Z, -6.5, zProgress * zProgress);

  // Gentle banking roll during colonnade cruise that levels smoothly to 0° before piercing O
  const rollRad = Math.sin(clamp01(u / 0.76) * Math.PI) * -0.042 + 0;

  // Smooth continuous FOV widening (42° -> 64°) as camera accelerates through the brass O ring
  const diveProgress = smootherstep(clamp01((u - 0.32) / 0.68));
  const fovDeg = lerp(42, 64, diveProgress);

  // Crossfade right after passing cleanly through MONOLITH_Z (at ~2520..2960ms)
  const fadeT = clamp01((t - 2520) / 440);
  const overlayOpacity = 1 - easeOutCubic(fadeT);
  const overlayActive = t < 2990;

  // Hide the top navigation bar throughout the full-screen 3D fly-through until reveal begins
  const hideNavbar = t < 2680;

  // Gentle settle counter-zoom on the real bungalow photograph
  const photoT = clamp01((t - 2100) / 1420);
  const photoScale = 1.1 - easeOutCubic(photoT) * 0.1;

  // Quiet top meta & matte balustrade deck rise once you emerge into the courtyard
  const uiT = clamp01((t - 2620) / 880);
  const uiReveal = easeOutCubic(uiT);

  return {
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
    rollRad,
    fovDeg,
    diveProgress,
    overlayActive,
    overlayOpacity,
    photoScale,
    uiReveal,
    hideNavbar,
  };
}

/**
 * Pure 3D camera choreography for ALL 12 Culinary Gate Portals:
 * Launches whenever a guest steps through any gate (from the 12-Gate shelf,
 * 3D Hallway, or Full Menu). Uses the exact same zero-pause continuous momentum
 * spline aimed cleanly through a centered sculpted 3D brass gate oculus (x = 0).
 */
export function computeGate3DCameraState(elapsedMs: number): Gate3DCameraState {
  const t = Math.max(0, Math.min(GATE_ENTRY_DURATION_MS, elapsedMs));

  const FLIGHT_MS = 1850;
  const u = clamp01(t / FLIGHT_MS);

  // Strictly continuous forward acceleration (derivative >= 0.72 everywhere, ZERO rough pause)
  const zProgress = 0.72 * u + 0.28 * u * u;
  const camZ = lerp(22.5, 0.85, zProgress);

  // Subtle off-axis sweep from +1.55 -> dead-center 0 to showcase extruded 3D arch depth
  const alignT = smootherstep(clamp01(u / 0.7));
  const camX = lerp(1.55, 0, alignT);
  const camY = lerp(0.72, OCULUS_WORLD_Y, alignT);

  const lookFocusT = smootherstep(clamp01(u / 0.6));
  const lookX = lerp(0.12, 0, lookFocusT);
  const lookY = lerp(0.14, OCULUS_WORLD_Y, lookFocusT);
  const lookZ = lerp(MONOLITH_Z, -6.5, zProgress * zProgress);

  const rollRad = Math.sin(clamp01(u / 0.72) * Math.PI) * -0.036 + 0;
  const diveProgress = smootherstep(clamp01((u - 0.28) / 0.72));
  const fovDeg = lerp(43, 66, diveProgress);

  // Swap underlying App stage to destination room while portal is still 100% opaque (t >= 1450ms)
  const shouldSwapRoom = t >= 1450;

  // Quiet architectural title sits cleanly during approach and fades out before piercing the ring
  const labelFadeIn = easeOutCubic(clamp01(t / 280));
  const labelFadeOut = 1 - easeOutCubic(clamp01((t - 1020) / 360));
  const labelOpacity = labelFadeIn * labelFadeOut;

  // Dissolve smoothly into the destination 3D Gallery room once camera pierces the gate oculus
  const fadeT = clamp01((t - 1720) / 560);
  const overlayOpacity = 1 - easeOutCubic(fadeT);
  const overlayActive = t < GATE_ENTRY_DURATION_MS;
  const hideNavbar = t < 1920;

  return {
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
    rollRad,
    fovDeg,
    diveProgress,
    overlayOpacity,
    overlayActive,
    shouldSwapRoom,
    labelOpacity,
    hideNavbar,
  };
}
