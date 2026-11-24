import type { DishItem, SheetConfig } from '../data/cafeData';

export interface CellBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WebGLCropUV {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
}

export interface DomCropStyle {
  backgroundSize: string;
  backgroundPosition: string;
}

/**
 * Computes the exact source-pixel crop box for cellIndex (0..8) in a 3x3 artwork sheet,
 * safely inset inside the printed borders so no gutters ever bleed into frames.
 */
export function getSheetCellBox(sheet: SheetConfig, cellIndex: number): CellBox {
  const safeIdx = ((cellIndex % (sheet.cols * sheet.rows)) + sheet.cols * sheet.rows) % (sheet.cols * sheet.rows);
  const col = safeIdx % sheet.cols;
  const row = Math.floor(safeIdx / sheet.cols);

  const cellW = (sheet.width - sheet.outerX * 2 - sheet.gapX * (sheet.cols - 1)) / sheet.cols;
  const cellH = (sheet.height - sheet.outerY * 2 - sheet.gapY * (sheet.rows - 1)) / sheet.rows;

  const rawX = sheet.outerX + col * (cellW + sheet.gapX);
  const rawY = sheet.outerY + row * (cellH + sheet.gapY);

  return {
    x: Math.round(rawX + sheet.insetX),
    y: Math.round(rawY + sheet.insetY),
    w: Math.round(cellW - sheet.insetX * 2),
    h: Math.round(cellH - sheet.insetY * 2),
  };
}

/**
 * Computes WebGL UV repeat & offset (with flipped V axis) for a Three.js Texture clone.
 */
export function getWebGLCropUV(sheet: SheetConfig, cellIndex: number): WebGLCropUV {
  const box = getSheetCellBox(sheet, cellIndex);
  return {
    repeatX: box.w / sheet.width,
    repeatY: box.h / sheet.height,
    offsetX: box.x / sheet.width,
    offsetY: 1 - (box.y + box.h) / sheet.height,
  };
}

/**
 * Computes CSS background-size and background-position for rendering a sheet cell in DOM
 * using cover-fit math so aspect ratio never distorts.
 */
export function getDomCropStyle(
  sheet: SheetConfig,
  cellIndex: number,
  targetW: number,
  targetH: number
): DomCropStyle {
  const box = getSheetCellBox(sheet, cellIndex);
  const safeW = Math.max(1, targetW);
  const safeH = Math.max(1, targetH);

  // Use cover scaling so artwork fills the container cleanly without stretching
  const scale = Math.max(safeW / box.w, safeH / box.h);
  const renderedCellW = box.w * scale;
  const renderedCellH = box.h * scale;
  const extraX = (renderedCellW - safeW) / 2;
  const extraY = (renderedCellH - safeH) / 2;

  const bgW = sheet.width * scale;
  const bgH = sheet.height * scale;
  const posX = -(box.x * scale) - extraX;
  const posY = -(box.y * scale) - extraY;

  return {
    backgroundSize: `${bgW.toFixed(2)}px ${bgH.toFixed(2)}px`,
    backgroundPosition: `${posX.toFixed(2)}px ${posY.toFixed(2)}px`,
  };
}

/**
 * Computes resolution-independent CSS percentage background-size and background-position
 * for rendering a sheet cell cleanly with zero zoom-in distortion at any viewport width
 * or CSS transform scale. Matches the cell's natural aspect or cover-centers cleanly
 * inside square/custom aspect containers.
 */
export function getResponsiveCropStyle(
  sheet: SheetConfig,
  cellIndex: number,
  targetAspect: number = 0.74
): DomCropStyle {
  const box = getSheetCellBox(sheet, cellIndex);
  const safeAspect = Math.max(0.25, Math.min(4, targetAspect));
  const cellAspect = box.w / Math.max(1, box.h);

  let visW = box.w;
  let visH = box.h;
  let visX = box.x;
  let visY = box.y;

  if (safeAspect > cellAspect) {
    // Container is wider/squarer than the 3:4 cell -> match width, center vertically
    visH = box.w / safeAspect;
    visY = box.y + (box.h - visH) * 0.5;
  } else {
    // Container is narrower/taller than the cell -> match height, center horizontally
    visW = box.h * safeAspect;
    visX = box.x + (box.w - visW) * 0.5;
  }

  const sizeX = (sheet.width / Math.max(1, visW)) * 100;
  const sizeY = (sheet.height / Math.max(1, visH)) * 100;
  const posX = (visX / Math.max(1, sheet.width - visW)) * 100;
  const posY = (visY / Math.max(1, sheet.height - visH)) * 100;

  return {
    backgroundSize: `${sizeX.toFixed(3)}% ${sizeY.toFixed(3)}%`,
    backgroundPosition: `${posX.toFixed(3)}% ${posY.toFixed(3)}%`,
  };
}

// --- 3D Gallery Camera & Pose Math (Zestwell Architecture) ---

export const GALLERY_CONSTANTS = {
  R_OUTER: 18,
  R_INNER: 12.2,
  WALL_H: 6.2,
  PW: 1.36,
  PH: 1.36 * (763 / 567),
  PY: 1.95,
  OUTER_SLOTS: 36,
  INNER_SLOTS: 24,
  WALK_TAU: 0.36,
  GLIDE_DURATION: 0.95,
} as const;

export interface CameraPose {
  th: number;
  r: number;
  yaw: number;
  y: number;
  pitch: number;
}

export function getWalkOffsetD(isPortraitSmall: boolean): number {
  const step = (Math.PI * 2) / GALLERY_CONSTANTS.OUTER_SLOTS;
  return isPortraitSmall ? 0.14 + 0.9 * step : 0.14;
}

export function getWalkPose(th: number, isPortraitSmall: boolean): CameraPose {
  if (isPortraitSmall) {
    return { th, r: 15.4, yaw: -0.42, y: 1.9, pitch: -0.1 };
  }
  return { th, r: 15.6, yaw: -0.3, y: 1.92, pitch: -0.12 };
}

export function getFocusPose(
  frameAngle: number,
  wall: 'outer' | 'inner',
  currentTh: number,
  isPortraitSmall: boolean
): CameraPose {
  const targetTh = shortestAngleTarget(currentTh, frameAngle);
  if (wall === 'outer') {
    return {
      th: targetTh,
      r: isPortraitSmall ? GALLERY_CONSTANTS.R_OUTER - 5.2 : GALLERY_CONSTANTS.R_OUTER - 4.26,
      yaw: Math.PI / 2,
      y: isPortraitSmall ? GALLERY_CONSTANTS.PY - 1.05 : GALLERY_CONSTANTS.PY - 0.52,
      pitch: 0,
    };
  }
  return {
    th: targetTh,
    r: isPortraitSmall ? GALLERY_CONSTANTS.R_INNER + 5.2 : GALLERY_CONSTANTS.R_INNER + 4.26,
    yaw: -Math.PI / 2,
    y: isPortraitSmall ? GALLERY_CONSTANTS.PY - 1.05 : GALLERY_CONSTANTS.PY - 0.52,
    pitch: 0,
  };
}

/** Picks the equivalent angle of targetAngle within ±π of currentAngle so the camera takes the shortest arc. */
export function shortestAngleTarget(currentAngle: number, targetAngle: number): number {
  const twoPi = Math.PI * 2;
  let diff = ((targetAngle - currentAngle) % twoPi + twoPi) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  return currentAngle + diff;
}

/** Snaps walk target angle to the next/previous 2π/36 slot along the curved passage. */
export function stepSlotAngle(currentTarget: number, direction: 1 | -1, offsetD: number): number {
  const step = (Math.PI * 2) / GALLERY_CONSTANTS.OUTER_SLOTS;
  return (Math.round((currentTarget - offsetD) / step) - direction) * step + offsetD;
}

/**
 * Multi-easing pose interpolation matching Zestwell's signature camera glide:
 * th = quartic ease-out, yaw = quadratic ease-out, r/y/pitch = cubic ease-out.
 */
export function interpolateGlidePose(from: CameraPose, to: CameraPose, rawT: number): CameraPose {
  const t = Math.max(0, Math.min(1, rawT));
  const inv = 1 - t;
  const eQuart = 1 - inv * inv * inv * inv;
  const eCubic = 1 - inv * inv * inv;
  const eQuad = 1 - inv * inv;

  return {
    th: from.th + (to.th - from.th) * eQuart,
    r: from.r + (to.r - from.r) * eCubic,
    yaw: from.yaw + (to.yaw - from.yaw) * eQuad,
    y: from.y + (to.y - from.y) * eCubic,
    pitch: from.pitch + (to.pitch - from.pitch) * eCubic,
  };
}

// --- Cart & Ordering Logic ---

export interface CartItem {
  key: string;
  dishId: string;
  title: string;
  roomTitle: string;
  sheetId: DishItem['sheetId'];
  cellIndex: number;
  selectedOptions: Record<string, string>;
  unitPrice: number;
  quantity: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  gst: number;
  total: number;
}

export function getDefaultOptions(dish: DishItem): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const group of dish.optionGroups) {
    if (group.choices[0]) {
      opts[group.id] = group.choices[0].label;
    }
  }
  return opts;
}

export function calculateUnitPrice(dish: DishItem, selectedOptions: Record<string, string>): number {
  let price = dish.price;
  for (const group of dish.optionGroups) {
    const chosenLabel = selectedOptions[group.id];
    const choice = group.choices.find((c) => c.label === chosenLabel);
    if (choice) {
      price += choice.priceDelta;
    }
  }
  return price;
}

export function buildCartItemKey(dishId: string, selectedOptions: Record<string, string>): string {
  const sorted = Object.keys(selectedOptions)
    .sort()
    .map((k) => `${k}:${selectedOptions[k]}`)
    .join('|');
  return `${dishId}::${sorted}`;
}

export function addItemToCart(
  cart: CartItem[],
  dish: DishItem,
  roomTitle: string,
  selectedOptions: Record<string, string>,
  quantity: number
): CartItem[] {
  const safeQty = Math.max(1, Math.min(9, Math.round(quantity)));
  const key = buildCartItemKey(dish.id, selectedOptions);
  const unitPrice = calculateUnitPrice(dish, selectedOptions);

  const existingIndex = cart.findIndex((item) => item.key === key);
  if (existingIndex >= 0) {
    return cart.map((item, idx) =>
      idx === existingIndex
        ? { ...item, quantity: Math.min(19, item.quantity + safeQty) }
        : item
    );
  }

  return [
    ...cart,
    {
      key,
      dishId: dish.id,
      title: dish.title,
      roomTitle,
      sheetId: dish.sheetId,
      cellIndex: dish.cellIndex,
      selectedOptions: { ...selectedOptions },
      unitPrice,
      quantity: safeQty,
    },
  ];
}

export function updateCartQuantity(cart: CartItem[], key: string, delta: number): CartItem[] {
  return cart
    .map((item) =>
      item.key === key ? { ...item, quantity: Math.min(19, item.quantity + delta) } : item
    )
    .filter((item) => item.quantity > 0);
}

export function removeCartItem(cart: CartItem[], key: string): CartItem[] {
  return cart.filter((item) => item.key !== key);
}

export function calculateCartTotals(cart: CartItem[]): CartTotals {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const gst = Math.round(subtotal * 0.05);
  return {
    itemCount,
    subtotal,
    gst,
    total: subtotal + gst,
  };
}

export interface CheckoutInput {
  guestName: string;
  diningMode: 'table' | 'pickup';
  tableOrPhone: string;
}

export interface CheckoutValidationResult {
  valid: boolean;
  errors: {
    guestName?: string;
    tableOrPhone?: string;
  };
}

export function validateCheckoutOrder(input: CheckoutInput): CheckoutValidationResult {
  const errors: CheckoutValidationResult['errors'] = {};
  if (!input.guestName.trim() || input.guestName.trim().length < 2) {
    errors.guestName = 'Please enter your name for the kitchen ticket.';
  }
  const detail = input.tableOrPhone.trim();
  if (!detail) {
    errors.tableOrPhone =
      input.diningMode === 'table'
        ? 'Enter your patio table number (e.g. Patio 4 or Rooftop 2).'
        : 'Enter a 10-digit phone number for pickup readiness.';
  } else if (input.diningMode === 'pickup' && !/^\+?[0-9\s-]{8,15}$/.test(detail)) {
    errors.tableOrPhone = 'Please enter a valid phone number (8–15 digits).';
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
