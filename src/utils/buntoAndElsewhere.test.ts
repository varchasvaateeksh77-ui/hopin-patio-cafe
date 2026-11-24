import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS } from '../data/cafeData';
import { getResponsiveCropStyle } from './galleryMath';
import {
  BUNTO_CX,
  BUNTO_CY,
  BUNTO_RING_SLOTS,
  BUNTO_SLOT_STEP,
  BUNTO_TILT_DEG,
  BUNTO_TOTAL_GATES,
  computeBuntoDetailPose,
  computeBuntoEntranceOffset,
  computeBuntoRingPose,
  computeBuntoShadowPose,
  computeFlyToBagKeyframes,
  computeShortestRingTargetAngle,
  findBuntoFrontIndex,
} from './buntoRingMath';
import {
  HOPIN_GOOGLE_REVIEWS,
  HOPIN_GOOGLE_REVIEW_URL,
  pickRandomGoogleReview,
} from './googleReviews';

test('getResponsiveCropStyle produces pure percentage CSS crops with zero hardcoded px zoom distortion', () => {
  const portrait = getResponsiveCropStyle(SHEETS.cuisineA, 0, 0.74);
  assert.ok(portrait.backgroundSize.includes('%'), 'backgroundSize must use responsive %');
  assert.ok(!portrait.backgroundSize.includes('px'), 'backgroundSize must never hardcode px');
  assert.ok(portrait.backgroundPosition.includes('%'), 'backgroundPosition must use responsive %');

  const centerCell = getResponsiveCropStyle(SHEETS.cuisineA, 4, 1);
  const [posX, posY] = centerCell.backgroundPosition.split(' ').map((s) => parseFloat(s));
  assert.ok(Math.abs(posX - 50) < 1.5, `center cell X should sit near 50%, got ${posX}`);
  assert.ok(Math.abs(posY - 50) < 1.5, `center cell Y should sit near 50%, got ${posY}`);
});

test('computeBuntoRingPose matches exact 6-piece BUNTO horizontal ring geometry and ±9deg outward lean', () => {
  assert.equal(BUNTO_RING_SLOTS, 6);
  const front = computeBuntoRingPose(0, 0, 6, false);
  assert.equal(front.x, BUNTO_CX);
  assert.equal(front.y, BUNTO_CY);
  assert.equal(front.rotateDeg, 0);
  assert.equal(front.zIndex, 101);
  assert.equal(findBuntoFrontIndex(0, 6), 0);

  // Piece 1 (60 deg) sits right & leans clockwise; piece 5 (300 deg) sits left & leans anticlockwise
  const rightFront = computeBuntoRingPose(1, 0, 6, false);
  const leftFront = computeBuntoRingPose(5, 0, 6, false);
  assert.ok(rightFront.x > BUNTO_CX && rightFront.y > BUNTO_CY);
  assert.ok(leftFront.x < BUNTO_CX && leftFront.y > BUNTO_CY);
  assert.ok(rightFront.rotateDeg > 7 && rightFront.rotateDeg <= BUNTO_TILT_DEG);
  assert.ok(leftFront.rotateDeg < -7 && leftFront.rotateDeg >= -BUNTO_TILT_DEG);
  assert.ok(rightFront.scale < front.scale);

  // Piece 3 (180 deg) sits lowest at the back
  const back = computeBuntoRingPose(3, 0, 6, false);
  assert.ok(back.y > rightFront.y, 'back piece sits lower than side pieces');
  assert.ok(back.zIndex < rightFront.zIndex);

  // Entrance rise starts front pieces earlier than back pieces
  const frontMidRise = computeBuntoEntranceOffset(0.35, 1);
  const backMidRise = computeBuntoEntranceOffset(0.35, -1);
  assert.ok(frontMidRise.opacity > backMidRise.opacity, 'front pieces rise ahead of back pieces');
});

test('all 12 Hopin submenus flow continuously through the 6-visible-slot BUNTO ring without crowding', () => {
  assert.equal(BUNTO_TOTAL_GATES, 12);

  // Every single one of the 12 submenus reaches exact front-center pose at -k * BUNTO_SLOT_STEP
  for (let k = 0; k < 12; k++) {
    const angle = -k * BUNTO_SLOT_STEP;
    assert.equal(findBuntoFrontIndex(angle, 12), k);
    const front = computeBuntoRingPose(k, angle, 12, false);
    assert.equal(front.x, BUNTO_CX);
    assert.equal(front.y, BUNTO_CY);
    assert.equal(front.baseOpacity, 1);
    assert.equal(front.zIndex, 101);

    // Opposite half of the 12-menu collection stays cleanly hidden behind dead-back
    const opposite = computeBuntoRingPose((k + 6) % 12, angle, 12, false);
    assert.equal(opposite.baseOpacity, 0);
    assert.equal(opposite.zIndex, 0);
  }

  // Shortest-path navigation from Gate XII (index 11) to Gate I (index 0) advances 1 slot, not 11
  const fromTwelve = -11 * BUNTO_SLOT_STEP;
  const toOne = computeShortestRingTargetAngle(fromTwelve, 0, 12);
  assert.ok(
    Math.abs((toOne - fromTwelve) - -BUNTO_SLOT_STEP) < 1e-6,
    'Gate XII -> Gate I wraps cleanly by 1 step'
  );
});

test('computeBuntoDetailPose glides chosen piece left/center while drifting non-chosen pieces outward', () => {
  const chosenRing = computeBuntoRingPose(0, 0, 6, false);
  const rightRing = computeBuntoRingPose(1, 0, 6, false);

  const chosenOpen = computeBuntoDetailPose(chosenRing, true, chosenRing.x, 1, false);
  assert.equal(chosenOpen.x, 470);
  assert.equal(chosenOpen.y, 425);
  assert.equal(chosenOpen.scale, 1.12);
  assert.equal(chosenOpen.rotateDeg, 0);
  assert.equal(chosenOpen.zIndex, 300);

  const rightOpen = computeBuntoDetailPose(rightRing, false, chosenRing.x, 1, false);
  assert.ok(rightOpen.x > rightRing.x + 200, 'non-chosen piece drifts outward');
  assert.equal(rightOpen.opacity, 0);
  assert.equal(rightOpen.pointerEvents, false);

  const shadowOpen = computeBuntoShadowPose(1, false);
  assert.ok(shadowOpen.tx < -180, 'floor shadow glides left beneath opened desktop piece');
  assert.ok(Math.abs(shadowOpen.scaleX - 0.55) < 0.001);
});

test('computeFlyToBagKeyframes generates 25 3D-banking parabolic frames arcing cleanly into the bag', () => {
  const frames = computeFlyToBagKeyframes(
    { left: 320, top: 260, width: 240, height: 240 },
    { left: 1320, top: 18, width: 42, height: 42 },
    25
  );
  assert.equal(frames.length, 25);
  assert.equal(frames[0].translateX, 0);
  assert.equal(frames[0].translateY, 0);
  assert.equal(frames[0].scale, 1);

  // Initial lift swell > 1.07 inside first 14% phase
  const maxEarlyScale = Math.max(...frames.slice(1, 5).map((f) => f.scale));
  assert.ok(maxEarlyScale > 1.07, `expected buoyant lift swell > 1.07, got ${maxEarlyScale}`);

  // Mid-flight 3D perspective banking pitch & yaw active
  assert.ok(frames[12].rotateXDeg > 12, `expected 3D pitch > 12deg, got ${frames[12].rotateXDeg}`);
  assert.ok(Math.abs(frames[6].rotateYDeg) > 4, `expected 3D yaw banking, got ${frames[6].rotateYDeg}`);

  // Landing frame shrinks cleanly to bag ratio and fades smoothly
  const last = frames[24];
  assert.ok(last.scale < 0.2, `expected landing scale < 0.2, got ${last.scale}`);
  assert.ok(last.opacity < 0.45, `expected final opacity < 0.45, got ${last.opacity}`);
});

test('phone ring geometry frames flanking cards symmetrically inside narrow mobile viewports', () => {
  const desktopRight = computeBuntoRingPose(1, 0, 12, false);
  const phoneRight = computeBuntoRingPose(1, 0, 12, true);
  const phoneLeft = computeBuntoRingPose(11, 0, 12, true);

  const desktopSpread = desktopRight.x - BUNTO_CX;
  const phoneSpread = phoneRight.x - BUNTO_CX;

  assert.ok(desktopSpread > 350, `desktop spread should remain wide, got ${desktopSpread}`);
  assert.ok(phoneSpread > 180 && phoneSpread < 240, `phone spread should frame cleanly inside 390px, got ${phoneSpread}`);
  assert.ok(
    Math.abs((BUNTO_CX - phoneLeft.x) - phoneSpread) < 0.01,
    'phone left and right neighbors must be horizontally symmetric'
  );

  // Mobile fly-to-bag arc's visual top edge stays strictly inside viewport (no clipping over mobile header)
  const phoneFly = computeFlyToBagKeyframes(
    { left: 160, top: 520, width: 68, height: 68 },
    { left: 300, top: 10, width: 74, height: 36 },
    25
  );
  const minVisualTop = Math.min(
    ...phoneFly.map((f) => {
      const centerY = 520 + f.translateY + 34;
      return centerY - (68 * f.scale) * 0.5;
    })
  );
  assert.ok(minVisualTop >= 4, `mobile fly-to-bag visual top must stay inside viewport, minVisualTop=${minVisualTop}`);
});

test('checkout Google reviews pool provides 15 unique natural drafts and never repeats on shuffle', () => {
  assert.equal(HOPIN_GOOGLE_REVIEWS.length, 15);
  assert.ok(HOPIN_GOOGLE_REVIEW_URL.includes('search.google.com/local/writereview?placeid='));

  const uniqueTexts = new Set(HOPIN_GOOGLE_REVIEWS.map((r) => r.text.trim().toLowerCase()));
  assert.equal(uniqueTexts.size, 15, 'all 15 natural review drafts must be unique');

  for (const draft of HOPIN_GOOGLE_REVIEWS) {
    assert.ok(draft.text.length >= 70 && draft.text.length <= 240, `natural review length for ${draft.id}`);
    assert.ok(draft.vibeTag.length >= 4);
  }

  // Never repeats excluded index across every possible RNG output
  for (let exclude = 0; exclude < 15; exclude++) {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const picked = pickRandomGoogleReview(exclude, () => r);
      assert.notEqual(picked.index, exclude, `shuffle must not repeat index ${exclude}`);
      assert.ok(picked.draft.text.length > 0);
    }
  }
});
