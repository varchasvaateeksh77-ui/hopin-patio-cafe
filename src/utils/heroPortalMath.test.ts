import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCH_RING_COUNT,
  computeGate3DCameraState,
  computeHero3DCameraState,
  computeSlicePose,
  computeTunnelArch,
  ENTRY_DURATION_MS,
  GATE_ENTRY_DURATION_MS,
  MONOLITH_Z,
  OCULUS_WORLD_X,
  OCULUS_WORLD_Y,
  SLICE_COUNT,
} from './heroPortalMath';

test('computeHero3DCameraState flies continuously with zero rough pause, hides navbar, pierces O, and settles cleanly', () => {
  const start = computeHero3DCameraState(0);
  assert.equal(start.overlayActive, true);
  assert.equal(start.overlayOpacity, 1);
  assert.equal(start.hideNavbar, true, 'navbar must be hidden while 3D entry plays');
  assert.ok(start.camZ > 24, `camera should start deep down colonnade, got ${start.camZ}`);
  assert.ok(start.camX > 1.5, 'camera should start off-axis to showcase 3D arch depth');
  assert.equal(start.uiReveal, 0);

  // Verify ZERO rough pause across the entire 2800ms forward flight (sample every 50ms)
  let minStep = Infinity;
  let totalStep = 0;
  let count = 0;
  for (let ms = 50; ms <= 2800; ms += 50) {
    const prev = computeHero3DCameraState(ms - 50);
    const curr = computeHero3DCameraState(ms);
    const forwardStep = prev.camZ - curr.camZ;
    assert.ok(forwardStep > 0, `camera must move forward without stopping at ${ms}ms`);
    if (forwardStep < minStep) minStep = forwardStep;
    totalStep += forwardStep;
    count++;
  }
  const avgStep = totalStep / count;
  assert.ok(
    minStep >= avgStep * 0.55,
    `camera must never stall mid-flight (minStep=${minStep.toFixed(3)}, avg=${avgStep.toFixed(3)})`
  );

  // Mid-colonnade monolith framing (~1150ms)
  const monolithView = computeHero3DCameraState(1150);
  assert.equal(monolithView.hideNavbar, true);
  assert.ok(
    monolithView.camZ > MONOLITH_Z + 5 && monolithView.camZ < 17,
    `camera should frame the 3D HOPIN monolith cleanly before diving, got z=${monolithView.camZ}`
  );

  // Piercing directly through the physical brass O ring (~2250ms)
  const midDive = computeHero3DCameraState(2250);
  assert.equal(midDive.overlayActive, true);
  assert.ok(
    Math.abs(midDive.camX - OCULUS_WORLD_X) < 0.05,
    `camera X should align with O oculus center (${OCULUS_WORLD_X}), got ${midDive.camX}`
  );
  assert.ok(
    Math.abs(midDive.camY - OCULUS_WORLD_Y) < 0.05,
    `camera Y should align with O oculus center (${OCULUS_WORLD_Y}), got ${midDive.camY}`
  );
  assert.ok(midDive.fovDeg > 50, `FOV should widen smoothly during dive, got ${midDive.fovDeg}`);

  // End of flight (2800ms): camera has physically passed THROUGH MONOLITH_Z
  const pierced = computeHero3DCameraState(2800);
  assert.ok(
    pierced.camZ < MONOLITH_Z,
    `camera must physically pass through the 3D O plane (z=${MONOLITH_Z}), got ${pierced.camZ}`
  );

  // Settled hero state
  const end = computeHero3DCameraState(ENTRY_DURATION_MS);
  assert.equal(end.overlayActive, false);
  assert.equal(end.overlayOpacity, 0);
  assert.equal(end.hideNavbar, false, 'navbar must reappear once 3D entry finishes');
  assert.equal(end.photoScale, 1);
  assert.equal(end.uiReveal, 1);
});

test('computeGate3DCameraState flies smoothly with zero pause through centered gate oculus and swaps room while opaque', () => {
  const start = computeGate3DCameraState(0);
  assert.equal(start.overlayActive, true);
  assert.equal(start.overlayOpacity, 1);
  assert.equal(start.hideNavbar, true);
  assert.equal(start.shouldSwapRoom, false);

  // Strictly continuous forward flight across 0..1850ms
  let minStep = Infinity;
  let totalStep = 0;
  let count = 0;
  for (let ms = 50; ms <= 1850; ms += 50) {
    const prev = computeGate3DCameraState(ms - 50);
    const curr = computeGate3DCameraState(ms);
    const forwardStep = prev.camZ - curr.camZ;
    assert.ok(forwardStep > 0, `gate camera must never stall at ${ms}ms`);
    if (forwardStep < minStep) minStep = forwardStep;
    totalStep += forwardStep;
    count++;
  }
  const avgStep = totalStep / count;
  assert.ok(
    minStep >= avgStep * 0.55,
    `gate camera must stay silky smooth (minStep=${minStep.toFixed(3)}, avg=${avgStep.toFixed(3)})`
  );

  // At 1500ms: centered on x=0, portal still 100% opaque, room swap triggered seamlessly underneath
  const swapMoment = computeGate3DCameraState(1500);
  assert.equal(swapMoment.shouldSwapRoom, true);
  assert.equal(swapMoment.overlayOpacity, 1);
  assert.ok(Math.abs(swapMoment.camX) < 0.02, `gate camera centers on x=0, got ${swapMoment.camX}`);

  // At 1850ms: physically pierced through MONOLITH_Z
  const pierced = computeGate3DCameraState(1850);
  assert.ok(pierced.camZ < MONOLITH_Z);

  // End of gate transition: overlay gone, navbar restored
  const end = computeGate3DCameraState(GATE_ENTRY_DURATION_MS);
  assert.equal(end.overlayActive, false);
  assert.equal(end.overlayOpacity, 0);
  assert.equal(end.hideNavbar, false);
});

test('computeSlicePose staggers 8 opposing 3D louver slats symmetrically and locks flush at 0 deg', () => {
  const early0 = computeSlicePose(0, 0, SLICE_COUNT);
  const early1 = computeSlicePose(1, 0, SLICE_COUNT);
  assert.ok(early0.rotateYDeg < -80, 'even louver starts rotated nearly edge-on');
  assert.ok(early1.rotateYDeg > 80, 'odd louver starts rotated in opposite 3D direction');

  const centerMid = computeSlicePose(3, 480, SLICE_COUNT);
  const edgeMid = computeSlicePose(0, 480, SLICE_COUNT);
  assert.ok(centerMid.progress > edgeMid.progress, 'center louvers assemble ahead of outer louvers');

  for (let i = 0; i < SLICE_COUNT; i++) {
    const locked = computeSlicePose(i, 1350, SLICE_COUNT);
    assert.equal(locked.progress, 1);
    assert.equal(locked.rotateYDeg, 0);
    assert.equal(locked.rotateYRad, 0);
    assert.equal(locked.translateYWorld, 0);
  }
});

test('computeTunnelArch spaces all 9 3D colonnade bays cleanly in front of the monolith', () => {
  const first = computeTunnelArch(0, 0, ARCH_RING_COUNT);
  const last = computeTunnelArch(ARCH_RING_COUNT - 1, 0, ARCH_RING_COUNT);
  assert.ok(first.z > last.z, 'nearer bays sit at larger Z coordinates');
  assert.ok(last.z > MONOLITH_Z, 'all colonnade bays stand in front of the monolith plane');
  assert.ok(first.opacity > 0 && first.opacity <= 1);
});
