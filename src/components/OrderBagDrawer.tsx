import React, { useCallback, useEffect, useState } from 'react';
import { X, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  calculateCartTotals,
  formatINR,
  validateCheckoutOrder,
  type CartItem,
} from '../utils/galleryMath';
import {
  HOPIN_GOOGLE_REVIEWS,
  buildOrderAwareReviewDraft,
  pickRandomGoogleReview,
} from '../utils/googleReviews';
import { PatioPostcardReview } from './PatioPostcardReview';
import { SpriteCrop } from './SpriteCrop';

interface OrderBagDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
}

interface ConfirmedReceipt {
  orderCode: string;
  guestName: string;
  diningMode: 'table' | 'pickup';
  tableOrPhone: string;
  total: number;
  itemCount: number;
  orderedItems: Array<{ title: string; quantity: number }>;
  orderedDishTitles: string[];
}

export const OrderBagDrawer: React.FC<OrderBagDrawerProps> = ({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
}) => {
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [guestName, setGuestName] = useState('');
  const [diningMode, setDiningMode] = useState<'table' | 'pickup'>('table');
  const [tableOrPhone, setTableOrPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ guestName?: string; tableOrPhone?: string }>({});
  const [receipt, setReceipt] = useState<ConfirmedReceipt | null>(null);

  // Post-order Patio Postcard state (random pick from 15 unique drafts, optionally dish-aware)
  const [initialPick] = useState(() => pickRandomGoogleReview());
  const [reviewDraftIdx, setReviewDraftIdx] = useState<number>(initialPick.index);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>(initialPick.draft.text);
  const [reviewVibeTag, setReviewVibeTag] = useState<string>(initialPick.draft.vibeTag);
  const [includeOrderDishes, setIncludeOrderDishes] = useState<boolean>(true);
  const [reviewCopied, setReviewCopied] = useState<boolean>(false);

  const rollFreshReview = useCallback(
    (exclude?: number, dishTitles: string[] = [], weaveDishes = false) => {
      const picked = pickRandomGoogleReview(exclude);
      setReviewDraftIdx(picked.index);
      setReviewVibeTag(picked.draft.vibeTag);
      setReviewText(
        weaveDishes && dishTitles.length > 0
          ? buildOrderAwareReviewDraft(dishTitles, picked.draft)
          : picked.draft.text
      );
      setReviewCopied(false);
    },
    []
  );

  const handleToggleIncludeOrderDishes = useCallback(() => {
    const nextInclude = !includeOrderDishes;
    setIncludeOrderDishes(nextInclude);
    const currentDraft = HOPIN_GOOGLE_REVIEWS[reviewDraftIdx] ?? pickRandomGoogleReview().draft;
    const dishTitles = receipt?.orderedDishTitles ?? [];
    setReviewText(
      nextInclude && dishTitles.length > 0
        ? buildOrderAwareReviewDraft(dishTitles, currentDraft)
        : currentDraft.text
    );
    setReviewCopied(false);
  }, [includeOrderDishes, receipt?.orderedDishTitles, reviewDraftIdx]);

  const handleCopyReview = useCallback(() => {
    const clean = reviewText.trim();
    if (!clean) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).catch(() => {
        // Silent fallback if iframe clipboard permissions restrict direct write
      });
    }
    setReviewCopied(true);
    window.setTimeout(() => setReviewCopied(false), 2600);
  }, [reviewText]);

  const totals = calculateCartTotals(items);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (items.length === 0 && step === 'checkout') {
      setStep('bag');
    }
  }, [items.length, step]);

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCheckoutOrder({
      guestName,
      diningMode,
      tableOrPhone,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const orderedItems = items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
    }));
    const orderedDishTitles = items.map((item) => item.title);

    const code = `HP-${Math.floor(1000 + Math.random() * 9000)}`;
    setReceipt({
      orderCode: code,
      guestName: guestName.trim(),
      diningMode,
      tableOrPhone: tableOrPhone.trim(),
      total: totals.total,
      itemCount: totals.itemCount,
      orderedItems,
      orderedDishTitles,
    });
    setIncludeOrderDishes(true);
    setReviewRating(5);
    rollFreshReview(reviewDraftIdx, orderedDishTitles, true);
    setErrors({});
    onClearCart();
    setStep('confirmed');
  };

  const resetAndClose = () => {
    setStep('bag');
    setReceipt(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#26211E]/25 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Slide-out Warm Paper Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your Patio Order"
        data-testid="order-bag-drawer"
        className={`order-drawer fixed top-0 right-0 bottom-0 z-50 w-[min(94vw,416px)] md:w-[max(390px,calc(412*var(--w)))] bg-[#F2EBE0] text-[#3E3A3C] flex flex-col p-5 sm:p-6 shadow-[-16px_0_40px_rgba(38,33,30,0.14)] ${
          open ? 'open' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DFD0C0]">
          <h2 className="font-bunto font-medium text-[20px] sm:text-[22px] tracking-[-0.02em] text-[#3E3A3C]">
            {step === 'confirmed'
              ? 'Kitchen Ticket'
              : step === 'checkout'
              ? 'Complete Order'
              : 'Your Order'}
          </h2>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close order drawer"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DFD0C0] hover:border-[#3E3A3C] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-5">
          {step === 'confirmed' && receipt ? (
            <div className="py-1 animate-drawer-item space-y-5" data-testid="order-confirmed-view">
              {/* Perforated Thermal Kitchen Ticket + Tear-Off Patio Postcard */}
              <div className="relative">
                {/* Top Half: Thermal Kitchen Ticket */}
                <div className="rounded-t-[16px] bg-[#FAF4EB] border border-[#DFD0C0] border-b-0 p-4 sm:p-5 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bunto text-[9.5px] font-medium uppercase tracking-[0.24em] text-[#B84C2E]">
                        Sent to Hopin Kitchen
                      </p>
                      <h3 className="font-bunto font-medium text-[24px] tracking-[-0.02em] text-[#262324] mt-0.5 leading-tight">
                        Order #{receipt.orderCode}
                      </h3>
                    </div>
                    <CheckCircle2
                      className="w-7 h-7 text-[#3F6B5D] stroke-[1.7] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="font-bunto text-[13px] text-[#666164] mt-2 leading-[1.55]">
                    Thank you, <strong className="text-[#262324]">{receipt.guestName}</strong>.
                    Queued for{' '}
                    {receipt.diningMode === 'table'
                      ? `table ${receipt.tableOrPhone}`
                      : `self-pickup (${receipt.tableOrPhone})`}
                    .
                  </p>

                  {/* Live 3-Step Kitchen Progress Rail */}
                  <ol
                    aria-label="Kitchen preparation status"
                    className="mt-4 pt-3.5 border-t border-[#E6D9C7] grid grid-cols-3 gap-2 text-left"
                  >
                    <li className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-[#3F6B5D] shrink-0"
                      />
                      <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.1em] text-[#262324] truncate">
                        Ticket In
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-[#B84C2E] animate-pulse shrink-0"
                      />
                      <span className="font-bunto text-[10px] font-medium uppercase tracking-[0.1em] text-[#B84C2E] truncate">
                        Firing Now
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-[#D0C1B0] shrink-0"
                      />
                      <span className="font-bunto text-[10px] uppercase tracking-[0.1em] text-[#787174] truncate">
                        To Table
                      </span>
                    </li>
                  </ol>

                  {/* Ordered Dish List & Totals */}
                  <div className="mt-3.5 pt-3 border-t border-[#E6D9C7] font-bunto text-[12px] space-y-1.5">
                    {receipt.orderedItems.length > 0 && (
                      <p className="text-[#262324] leading-[1.45] pb-1">
                        {receipt.orderedItems
                          .map((entry) => `${entry.quantity}× ${entry.title}`)
                          .join(' · ')}
                      </p>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#716D71]">Total Paid / Due</span>
                      <span className="font-medium text-[#262324] tabular-nums">
                        {formatINR(receipt.total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#716D71]">Estimated Prep</span>
                      <span className="text-[#262324] tabular-nums">12–18 mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#716D71]">Location</span>
                      <span className="text-[#262324]">17/2 New Palasia</span>
                    </div>
                  </div>
                </div>

                {/* Perforated Tear-Off Seam separating Kitchen Ticket from Patio Postcard */}
                <div
                  aria-hidden="true"
                  className="relative flex items-center bg-[#FAF4EB] border-x border-[#DFD0C0] py-2"
                >
                  <span className="w-3 h-6 -ml-[1px] rounded-r-full bg-[#F2EBE0] border-y border-r border-[#DFD0C0]" />
                  <div className="flex-1 mx-2 border-t border-dashed border-[#CCB9A5]" />
                  <span className="px-2 font-bunto text-[8.5px] uppercase tracking-[0.22em] text-[#8E837A]">
                    Patio Postcard
                  </span>
                  <div className="flex-1 mx-2 border-t border-dashed border-[#CCB9A5]" />
                  <span className="w-3 h-6 -mr-[1px] rounded-l-full bg-[#F2EBE0] border-y border-l border-[#DFD0C0]" />
                </div>

                {/* Bottom Half: Creative Post-Order Patio Postcard Review Ritual */}
                <div className="rounded-b-[16px] overflow-hidden border border-[#DFD0C0] border-t-0 bg-[#FBF6EE]">
                  <PatioPostcardReview
                    compact
                    attached
                    testId="checkout-google-review"
                    textareaId="hopin-google-review-input"
                    eyebrow="While the Kitchen Fires"
                    headline="Leave a quick note from your table"
                    rating={reviewRating}
                    onRatingChange={setReviewRating}
                    reviewText={reviewText}
                    onReviewTextChange={setReviewText}
                    vibeTag={reviewVibeTag}
                    copied={reviewCopied}
                    orderedDishTitles={receipt.orderedDishTitles}
                    includeOrderDishes={includeOrderDishes}
                    onToggleIncludeOrderDishes={handleToggleIncludeOrderDishes}
                    onShuffle={() =>
                      rollFreshReview(reviewDraftIdx, receipt.orderedDishTitles, includeOrderDishes)
                    }
                    onCopy={handleCopyReview}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={resetAndClose}
                className="w-full h-[46px] rounded-full bg-[#221F20] text-[#F9F2E9] font-bunto text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-[#B84C2E] transition-colors"
              >
                Return to Patio Gallery
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-bunto text-[11px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                Your order tray is empty
              </p>
              <p className="font-serif-editorial italic text-[15px] text-[#716D71] mt-2">
                Click any dish portrait in a culinary room to add it here.
              </p>
            </div>
          ) : step === 'bag' ? (
            <ul className="space-y-4">
              {items.map((item) => {
                const optionSummary = Object.values(item.selectedOptions).join(' · ');
                return (
                  <li
                    key={item.key}
                    className="flex gap-3.5 pb-4 border-b border-[#DFD0C0] animate-drawer-item"
                  >
                    <div className="w-[62px] shrink-0 rounded-[10px] overflow-hidden border border-[#DFD0C0] bg-[#FAF4EB] self-start">
                      <SpriteCrop
                        sheetId={item.sheetId}
                        cellIndex={item.cellIndex}
                        alt={item.title}
                        className="w-full aspect-[3/4]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bunto font-medium text-[14px] leading-[1.3] text-[#3E3A3C]">
                          {item.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.key)}
                          aria-label={`Remove ${item.title}`}
                          className="p-1 text-[#716D71] hover:text-[#B84C2E] transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="font-bunto text-[11.5px] text-[#716D71] mt-0.5">
                        {item.roomTitle}
                      </p>
                      {optionSummary && (
                        <p className="font-bunto text-[11px] text-[#716D71] mt-1 leading-[1.4]">
                          {optionSummary}
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border border-[#DFD0C0] bg-[#FAF4EB]">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.key, -1)}
                            aria-label={`Decrease quantity of ${item.title}`}
                            className="w-7 h-7 flex items-center justify-center font-bunto text-[13px] hover:text-[#B84C2E]"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-bunto text-[12px] tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.key, 1)}
                            aria-label={`Increase quantity of ${item.title}`}
                            className="w-7 h-7 flex items-center justify-center font-bunto text-[13px] hover:text-[#B84C2E]"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bunto text-[13px] font-medium tabular-nums">
                          {formatINR(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            /* Clean, focused Checkout Form — review postcard appears naturally AFTER ordering */
            <form id="hopin-checkout-form" onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.2em] text-[#716D71] mb-2">
                  Dining Mode
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDiningMode('table');
                      setErrors({});
                    }}
                    className={`h-[40px] rounded-full border font-bunto text-[10.5px] font-medium uppercase tracking-[0.16em] transition-colors ${
                      diningMode === 'table'
                        ? 'bg-[#221F20] border-[#221F20] text-[#F9F2E9]'
                        : 'bg-[#FAF4EB] border-[#DFD0C0] text-[#716D71] hover:border-[#3E3A3C]'
                    }`}
                  >
                    Table Service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiningMode('pickup');
                      setErrors({});
                    }}
                    className={`h-[40px] rounded-full border font-bunto text-[10.5px] font-medium uppercase tracking-[0.16em] transition-colors ${
                      diningMode === 'pickup'
                        ? 'bg-[#221F20] border-[#221F20] text-[#F9F2E9]'
                        : 'bg-[#FAF4EB] border-[#DFD0C0] text-[#716D71] hover:border-[#3E3A3C]'
                    }`}
                  >
                    Self-Pickup
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="checkout-guest-name"
                  className="block font-bunto text-[10px] font-medium uppercase tracking-[0.2em] text-[#716D71] mb-1.5"
                >
                  Your Name
                </label>
                <input
                  id="checkout-guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Ananya Verma"
                  className="w-full h-[42px] px-3.5 rounded-[12px] bg-[#FAF4EB] border border-[#DFD0C0] font-bunto text-[14px] text-[#3E3A3C] focus:border-[#3E3A3C] focus:outline-none"
                />
                {errors.guestName && (
                  <p role="alert" className="mt-1 text-[11.5px] text-[#9E2A1C] font-bunto">
                    {errors.guestName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-table-or-phone"
                  className="block font-bunto text-[10px] font-medium uppercase tracking-[0.2em] text-[#716D71] mb-1.5"
                >
                  {diningMode === 'table' ? 'Table Number / Zone' : 'Mobile Number'}
                </label>
                <input
                  id="checkout-table-or-phone"
                  type="text"
                  value={tableOrPhone}
                  onChange={(e) => setTableOrPhone(e.target.value)}
                  placeholder={diningMode === 'table' ? 'e.g. Patio 4 or Rooftop 2' : 'e.g. 98260 12345'}
                  className="w-full h-[42px] px-3.5 rounded-[12px] bg-[#FAF4EB] border border-[#DFD0C0] font-bunto text-[14px] text-[#3E3A3C] focus:border-[#3E3A3C] focus:outline-none"
                />
                {errors.tableOrPhone && (
                  <p role="alert" className="mt-1 text-[11.5px] text-[#9E2A1C] font-bunto">
                    {errors.tableOrPhone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-notes"
                  className="block font-bunto text-[10px] font-medium uppercase tracking-[0.2em] text-[#716D71] mb-1.5"
                >
                  Kitchen Note (Optional)
                </label>
                <textarea
                  id="checkout-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Less ice, Jain preparation, bring starters first…"
                  className="w-full p-3 rounded-[12px] bg-[#FAF4EB] border border-[#DFD0C0] font-bunto text-[13.5px] text-[#3E3A3C] focus:border-[#3E3A3C] focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('bag')}
                  className="font-bunto text-[10.5px] font-medium uppercase tracking-[0.18em] underline underline-offset-4 text-[#716D71] hover:text-[#3E3A3C]"
                >
                  ← Back to Order Items
                </button>
              </div>

              <p className="pt-2 border-t border-[#E4D6C6] font-serif-editorial italic text-[13px] text-[#787174] leading-[1.5]">
                Your kitchen ticket &amp; Hopin patio postcard will appear right after placing your
                order.
              </p>
            </form>
          )}
        </div>

        {/* Footer Totals & Action */}
        {step !== 'confirmed' && items.length > 0 && (
          <div className="pt-4 border-t border-[#DFD0C0] space-y-3">
            <div className="space-y-1 font-bunto text-[12.5px]">
              <div className="flex justify-between text-[#716D71]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#716D71]">
                <span>GST (5%)</span>
                <span className="tabular-nums">{formatINR(totals.gst)}</span>
              </div>
              <div className="flex justify-between text-[15px] text-[#3E3A3C] font-medium pt-1">
                <span>Total</span>
                <span data-testid="bag-total-amount" className="tabular-nums">
                  {formatINR(totals.total)}
                </span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                key="bag-proceed-btn"
                type="button"
                data-testid="bag-proceed-checkout"
                onClick={() => {
                  setErrors({});
                  setStep('checkout');
                }}
                className="w-full h-[48px] rounded-full bg-[#221F20] text-[#F9F2E9] font-bunto text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-[#B84C2E] transition-colors flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                key="bag-submit-btn"
                type="submit"
                form="hopin-checkout-form"
                data-testid="bag-place-order"
                className="w-full h-[48px] rounded-full bg-[#B84C2E] text-[#F9F2E9] font-bunto text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-[#9E3F24] transition-colors flex items-center justify-center gap-2"
              >
                Place Order · {formatINR(totals.total)}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
