import test from 'node:test';
import assert from 'node:assert/strict';
import { DISHES, SHEETS } from '../data/cafeData';
import {
  addItemToCart,
  calculateCartTotals,
  calculateUnitPrice,
  formatINR,
  getDomCropStyle,
  getFocusPose,
  getSheetCellBox,
  getWebGLCropUV,
  interpolateGlidePose,
  removeCartItem,
  shortestAngleTarget,
  stepSlotAngle,
  updateCartQuantity,
  validateCheckoutOrder,
} from './galleryMath';

test('sprite sheet crop boxes stay strictly inside image bounds for all 9 cells', () => {
  for (const sheet of Object.values(SHEETS)) {
    for (let i = 0; i < 9; i++) {
      const box = getSheetCellBox(sheet, i);
      assert.ok(box.x >= 0 && box.y >= 0, `cell ${i} starts inside bounds`);
      assert.ok(box.w > 150 && box.h > 250, `cell ${i} has positive portrait size`);
      assert.ok(box.x + box.w <= sheet.width, `cell ${i} fits width`);
      assert.ok(box.y + box.h <= sheet.height, `cell ${i} fits height`);

      const uv = getWebGLCropUV(sheet, i);
      assert.ok(uv.repeatX > 0 && uv.repeatX < 0.4);
      assert.ok(uv.repeatY > 0 && uv.repeatY < 0.4);
      assert.ok(uv.offsetX >= 0 && uv.offsetX <= 1);
      assert.ok(uv.offsetY >= 0 && uv.offsetY <= 1);

      const dom = getDomCropStyle(sheet, i, 240, 320);
      assert.match(dom.backgroundSize, /^\d+\.\d+px \d+\.\d+px$/);
      assert.match(dom.backgroundPosition, /^-?\d+\.\d+px -?\d+\.\d+px$/);
    }
  }
});

test('shortestAngleTarget wraps across 2π cleanly', () => {
  const target = shortestAngleTarget(0.1, Math.PI * 2 - 0.1);
  assert.ok(Math.abs(target - -0.1) < 1e-6);

  const forward = shortestAngleTarget(Math.PI * 2 - 0.1, 0.1);
  assert.ok(Math.abs(forward - (Math.PI * 2 + 0.1)) < 1e-6);
});

test('stepSlotAngle advances forward by one 2π/36 slot', () => {
  const step = (Math.PI * 2) / 36;
  const next = stepSlotAngle(0.14, 1, 0.14);
  assert.ok(Math.abs(next - (0.14 - step)) < 1e-6);

  const prev = stepSlotAngle(0.14, -1, 0.14);
  assert.ok(Math.abs(prev - (0.14 + step)) < 1e-6);
});

test('interpolateGlidePose leads travel (th) ahead of turn (yaw)', () => {
  const from = { th: 0, r: 15.6, yaw: -0.3, y: 1.92, pitch: -0.12 };
  const to = getFocusPose(0.8, 'outer', 0, false);
  const mid = interpolateGlidePose(from, to, 0.5);

  const thProgress = (mid.th - from.th) / (to.th - from.th);
  const yawProgress = (mid.yaw - from.yaw) / (to.yaw - from.yaw);
  assert.ok(thProgress > yawProgress, 'quartic travel should lead quadratic yaw turn');

  const end = interpolateGlidePose(from, to, 1);
  assert.equal(end.th, to.th);
  assert.equal(end.yaw, to.yaw);
  assert.equal(end.r, to.r);
});

test('cart pricing, option deltas, quantity updates, and GST calculation work accurately', () => {
  const platter = DISHES[0]; // Lebanese Mezze Platter ₹545
  const opts = { prep: 'Regular Patio Style', dip: 'Extra Classic Hummus' };
  const unitPrice = calculateUnitPrice(platter, opts);
  assert.equal(unitPrice, 545 + 69);

  let cart = addItemToCart([], platter, 'Continental & Small Plates', opts, 2);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);

  // Adding same configuration merges quantity
  cart = addItemToCart(cart, platter, 'Continental & Small Plates', opts, 1);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);

  const totals = calculateCartTotals(cart);
  assert.equal(totals.itemCount, 3);
  assert.equal(totals.subtotal, 614 * 3);
  assert.equal(totals.gst, Math.round(614 * 3 * 0.05));
  assert.equal(totals.total, totals.subtotal + totals.gst);
  assert.equal(formatINR(1250), '₹1,250');

  cart = updateCartQuantity(cart, cart[0].key, -3);
  assert.equal(cart.length, 0);

  const second = addItemToCart([], DISHES[3], 'Continental & Small Plates', {}, 1);
  assert.equal(removeCartItem(second, second[0].key).length, 0);
});

test('checkout validation enforces required guest name and table/phone fields', () => {
  const empty = validateCheckoutOrder({ guestName: '', diningMode: 'table', tableOrPhone: '' });
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.guestName);
  assert.ok(empty.errors.tableOrPhone);

  const badPhone = validateCheckoutOrder({
    guestName: 'Aarav',
    diningMode: 'pickup',
    tableOrPhone: 'abc',
  });
  assert.equal(badPhone.valid, false);
  assert.ok(badPhone.errors.tableOrPhone);

  const validTable = validateCheckoutOrder({
    guestName: 'Aarav Sharma',
    diningMode: 'table',
    tableOrPhone: 'Patio 4',
  });
  assert.equal(validTable.valid, true);
});

test('all 12 authentic Hopin menu gates have valid dishes, prices, and sprite bounds', async () => {
  const { SUBCATEGORY_ROOMS, getDishesByRoom } = await import('../data/cafeData');
  assert.equal(SUBCATEGORY_ROOMS.length, 12, 'should contain all 12 Hopin menu categories');
  assert.ok(DISHES.length >= 75, 'should contain at least 75 authentic menu items');

  for (const room of SUBCATEGORY_ROOMS) {
    const roomDishes = getDishesByRoom(room.id);
    assert.ok(roomDishes.length >= 5, `gate ${room.id} should have at least 5 dishes`);
    assert.ok(room.cellIndex >= 0 && room.cellIndex <= 8);
    for (const dish of roomDishes) {
      assert.ok(dish.price > 0, `dish ${dish.id} should have positive INR price`);
      assert.ok(dish.cellIndex >= 0 && dish.cellIndex <= 8, `dish ${dish.id} cellIndex in 0..8`);
    }
  }
});

test('zero pizza cells are assigned to any room or dish and bespoke culinary mappings match dishes', async () => {
  const { SUBCATEGORY_ROOMS } = await import('../data/cafeData');
  const retiredPizzaKeys = new Set(['rooms:0', 'savory:0', 'savory:1', 'savory:2']);

  for (const room of SUBCATEGORY_ROOMS) {
    const key = `${room.sheetId}:${room.cellIndex}`;
    assert.equal(
      retiredPizzaKeys.has(key),
      false,
      `room ${room.id} must not use retired pizza cell ${key}`
    );
  }

  for (const dish of DISHES) {
    const key = `${dish.sheetId}:${dish.cellIndex}`;
    assert.equal(
      retiredPizzaKeys.has(key),
      false,
      `dish ${dish.id} (${dish.title}) must not use retired pizza cell ${key}`
    );
  }

  const byId = new Map(DISHES.map((d) => [d.id, `${d.sheetId}:${d.cellIndex}`]));
  assert.equal(byId.get('stuffed-conchiglie-arrabbiata'), 'cuisineA:4');
  assert.equal(byId.get('korean-ramen'), 'cuisineB:1');
  assert.equal(byId.get('hot-asian-sizzler'), 'cuisineB:2');
  assert.equal(byId.get('dal-makhani-platter'), 'cuisineB:5');
  assert.equal(byId.get('sev-tamatar-platter'), 'cuisineB:7');
  assert.equal(byId.get('korean-sizzling-burger'), 'cuisineA:2');
  assert.equal(byId.get('mashed-avocado-sourdough'), 'cuisineA:0');
  assert.equal(byId.get('blue-tonic-coffee'), 'cafeBar:1');
  assert.equal(byId.get('bun-maska-masala-chai'), 'cafeBar:3');
  assert.equal(byId.get('chocolate-fondue-extravaganza'), 'cafeBar:7');
  assert.equal(byId.get('waffle-sundae'), 'cafeBar:8');
});
