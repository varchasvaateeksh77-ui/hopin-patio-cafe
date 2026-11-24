import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arcOffsetB,
  computeGatePose,
  computeRulerProgress,
  createArcMetrics,
  GATE_COUNT,
  modGate,
  relIndex,
  screenScale,
  shortestGateTarget,
  TOTAL_SLOTS,
} from './curvedArcMath';

test('relIndex wraps 36 virtual slots symmetrically into [-18, 18)', () => {
  assert.equal(relIndex(12, 12), 0);
  assert.equal(relIndex(35, 0), -1);
  assert.equal(relIndex(0, 35), 1);
  assert.equal(relIndex(18, 0), -18);
  assert.equal(relIndex(17, 0), 17);
  assert.equal(TOTAL_SLOTS, 36);
});

test('arcOffsetB smoothly pushes neighbouring gates apart and is odd-symmetric', () => {
  assert.equal(arcOffsetB(0), 0);
  assert.equal(arcOffsetB(1), 0.5);
  assert.equal(arcOffsetB(-1), -0.5);
  assert.equal(arcOffsetB(5), 0.5);
  assert.equal(arcOffsetB(-5), -0.5);
  assert.ok(Math.abs(arcOffsetB(0.5) + arcOffsetB(-0.5)) < 1e-12);
  assert.ok(arcOffsetB(0.5) > 0.25 && arcOffsetB(0.5) < 0.5);
});

test('computeGatePose centers the active gate facing front (-90deg) with full clarity', () => {
  const m = createArcMetrics(360, false);
  const center = computeGatePose(0, 0, 0, 0, m);

  assert.equal(center.visible, true);
  assert.equal(center.o, 1);
  assert.equal(center.sc, 1);
  assert.equal(center.x, 0);
  assert.ok(center.z > 0, 'Active gate should push slightly forward in Z');
  assert.equal(center.rotateY, -90);
  assert.equal(center.coverShade, 0);
});

test('computeGatePose forms a receding shaded shallow bowl for side gates and hides far edges', () => {
  const m = createArcMetrics(360, false);
  const left3 = computeGatePose(-3, 0, 0, 0, m);
  const right3 = computeGatePose(3, 0, 0, 0, m);
  const lifted = computeGatePose(3, 1, 0, 0, m);
  const far = computeGatePose(15, 0, 0, 0, m);

  assert.equal(left3.visible, true);
  assert.equal(right3.visible, true);
  assert.equal(left3.o, 0);
  assert.ok(left3.sc < 1 && left3.sc > 0.2);
  assert.ok(left3.z < 0, 'Side gates recede into negative Z');
  assert.ok(left3.y > 0, 'Side gates sink slightly to form a shallow bowl');
  assert.ok(lifted.y < right3.y, 'Hover lift elevates a side pillar upward');
  assert.ok(left3.rotateY < 0 && right3.rotateY > 0, 'Side pillars turn gently toward center');
  assert.ok(left3.spineShade > 0 && left3.spineShade <= 0.6);
  assert.equal(far.visible, false, 'Gates past 1.95*U are hidden');
});

test('shortestGateTarget wraps around the 12-Gate ring by shortest distance', () => {
  assert.equal(shortestGateTarget(12, 11), 11); // Gate I (12) -> Gate XII (11): -1 step
  assert.equal(shortestGateTarget(23, 0), 24); // Gate XII (23) -> Gate I (0): +1 step
  assert.equal(shortestGateTarget(12, 5), 17); // Gate I -> Gate VI: +5 steps
  assert.equal(modGate(-1, GATE_COUNT), 11);
});

test('computeRulerProgress maps 12 gates smoothly and jumps cleanly at XII -> I midpoint', () => {
  assert.equal(computeRulerProgress(0), 0);
  assert.equal(computeRulerProgress(11), 1);
  assert.ok(Math.abs(computeRulerProgress(5.5) - 5.5 / 11) < 1e-9);
  assert.equal(computeRulerProgress(11.4), 1);
  assert.equal(computeRulerProgress(11.6), 0);
  assert.ok(screenScale(0, 400) === 1);
});
