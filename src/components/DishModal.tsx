import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { getDishesByRoom, getRoomById, type DishItem } from '../data/cafeData';
import {
  calculateUnitPrice,
  formatINR,
  getDefaultOptions,
} from '../utils/galleryMath';
import { SpriteCrop } from './SpriteCrop';
import { flyDishToBag } from '../utils/flyToBag';

export interface FlyerOriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DishModalProps {
  dish: DishItem | null;
  originRect: FlyerOriginRect | null;
  bookmarkedIds: string[];
  onToggleBookmark: (dishId: string) => void;
  onClose: () => void;
  onSelectDish: (dish: DishItem, rect: FlyerOriginRect | null) => void;
  onAddToOrder: (
    dish: DishItem,
    selectedOptions: Record<string, string>,
    quantity: number,
    instantCheckout?: boolean
  ) => void;
}

/**
 * Elevated floating Dish Description & Ordering Window.
 * Opens automatically when clicking any dish portrait inside a 3D culinary room
 * (leaving the top-right Bag icon visible so clicking "Add to Bag →" launches
 * the 3D parabolic flying-dish animation straight out of the window into the bag!).
 */
export const DishModal: React.FC<DishModalProps> = ({
  dish,
  bookmarkedIds,
  onToggleBookmark,
  onClose,
  onSelectDish,
  onAddToOrder,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const targetArtRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('ingredients');
  const [addedToBagLabel, setAddedToBagLabel] = useState(false);
  const addedTimerRef = useRef<number>(0);

  useEffect(() => {
    if (!dish) return;
    setSelectedOptions(getDefaultOptions(dish));
    setQuantity(1);
    setOpenAccordion('ingredients');
    setAddedToBagLabel(false);
    window.clearTimeout(addedTimerRef.current);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [dish]);

  useEffect(() => {
    return () => window.clearTimeout(addedTimerRef.current);
  }, []);

  // Escape closes the Dish Window cleanly
  useEffect(() => {
    if (!dish) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dish, onClose]);

  if (!dish) return null;

  const room = getRoomById(dish.roomId);
  const roomDishes = getDishesByRoom(dish.roomId);
  const relatedDishes = roomDishes.filter((d) => d.id !== dish.id).slice(0, 4);

  const unitPrice = calculateUnitPrice(dish, selectedOptions);
  const isBookmarked = bookmarkedIds.includes(dish.id);

  const accordions = [
    {
      id: 'ingredients',
      title: 'Ingredients & Dietary Notes',
      body: dish.ingredients,
    },
    {
      id: 'aroma',
      title: 'The Aroma & Patio Pairing',
      body: dish.aromaPairing,
    },
    {
      id: 'kitchen',
      title: 'Kitchen Preparation & Timing',
      body: `${dish.kitchenInfo} Typical preparation time: ${dish.prepTime}.`,
    },
  ];

  const handleAddToBag = () => {
    setAddedToBagLabel(true);
    window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      setAddedToBagLabel(false);
    }, 1800);

    flyDishToBag(
      dish,
      targetArtRef.current,
      () => {
        onAddToOrder(dish, selectedOptions, quantity, false);
      },
      quantity,
      addBtnRef.current
    );
  };

  return (
    <div
      id="dish-page"
      role="dialog"
      aria-modal="true"
      aria-label={`${dish.title} details`}
      data-testid="dish-detail-page"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-25 pt-[68px] pb-4 px-3 sm:px-6 flex items-center justify-center bg-[#141110]/52 backdrop-blur-[4px] animate-fade-soft"
    >
      {/* Floating Editorial Dish Window */}
      <div
        ref={scrollContainerRef}
        className="relative w-full max-w-[980px] max-h-[calc(100svh-86px)] overflow-y-auto rounded-[20px] bg-[#F9F2E9] text-[#3E3A3C] border border-[#E6D9D2] shadow-[0_32px_80px_-20px_rgba(20,14,10,0.45)]"
      >
        {/* Top Floating Window Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-8 py-3.5 bg-[#F9F2E9]/94 backdrop-blur-md border-b border-[#E6D9D2]">
          <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.28em] text-[#716D71] truncate">
            Gate {room.roman} · {room.title} · {dish.dietary}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleBookmark(dish.id)}
              aria-label={isBookmarked ? 'Remove saved dish' : 'Save dish to favorites'}
              aria-pressed={isBookmarked}
              className={`w-8 h-8 rounded-full border border-[#E6D9D2] hover:border-[#3E3A3C] flex items-center justify-center transition-colors ${
                isBookmarked ? 'text-[#B84C2E] border-[#B84C2E]' : 'text-[#3E3A3C]'
              }`}
            >
              <Bookmark
                className="w-3.5 h-3.5 stroke-[1.6]"
                fill={isBookmarked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              data-testid="dish-window-close"
              onClick={onClose}
              aria-label={`Close ${dish.title} window`}
              className="w-8 h-8 rounded-full border border-[#E6D9D2] hover:border-[#3E3A3C] flex items-center justify-center text-[#3E3A3C] transition-colors"
            >
              <X className="w-4 h-4 stroke-[1.5]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Window Body: Un-zoomed 3:4 Portrait Left + Rich Description & Controls Right */}
        <div className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-7 md:gap-9 items-start">
          {/* Left: Un-zoomed 3:4 dish portrait (launch origin for 3D fly-to-bag!) */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div
              ref={targetArtRef}
              className="w-full max-w-[235px] sm:max-w-[280px] md:max-w-none aspect-[3/4] rounded-[16px] overflow-hidden border border-[#E6D9D2] bg-[#F3E9DB] shadow-[0_18px_36px_-14px_rgba(90,70,58,0.22)]"
            >
              <SpriteCrop
                sheetId={dish.sheetId}
                cellIndex={dish.cellIndex}
                alt={dish.title}
                className="w-full h-full"
              />
            </div>

            <div className="mt-3 w-full max-w-[235px] sm:max-w-[280px] md:max-w-none flex items-center justify-between font-bunto text-[10px] uppercase tracking-[0.22em] text-[#716D71]">
              <span>{dish.prepTime}</span>
              <span>100% Vegetarian</span>
            </div>
          </div>

          {/* Right: Title, Description, Customizer Chips, Add-to-Bag (with 3D Flight!) */}
          <div className="md:col-span-7 flex flex-col">
            <h1 className="font-bunto font-medium text-[26px] sm:text-[32px] leading-[1.12] tracking-[-0.025em] text-[#3E3A3C]">
              {dish.title}
            </h1>

            <p className="mt-1.5 font-serif-editorial italic text-[16px] text-[#716D71]">
              {dish.chefNote}
            </p>

            <p className="mt-4 font-bunto text-[14px] sm:text-[15px] leading-[1.62] text-[#716D71]">
              {dish.description}
            </p>

            <div className="mt-5 flex items-baseline gap-3">
              <span
                data-testid="dish-unit-price"
                className="font-bunto text-[22px] font-medium text-[#3E3A3C]"
              >
                {formatINR(unitPrice * quantity)}
              </span>
              <span className="font-bunto text-[11px] text-[#716D71]">
                Freshly made · 5% GST in bag
              </span>
            </div>

            {/* Option Groups */}
            {dish.optionGroups.length > 0 && (
              <div className="mt-5 space-y-4">
                {dish.optionGroups.map((group) => {
                  const activeChoice = selectedOptions[group.id] || group.choices[0]?.label;
                  return (
                    <div key={group.id}>
                      <div className="flex items-center gap-2 font-bunto text-[10px] uppercase tracking-[0.22em] mb-2">
                        <span className="text-[#3E3A3C] font-medium">{group.label}</span>
                        <span className="text-[#716D71]">{activeChoice}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.choices.map((choice) => {
                          const isSelected = activeChoice === choice.label;
                          return (
                            <button
                              key={choice.label}
                              type="button"
                              onClick={() =>
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [group.id]: choice.label,
                                }))
                              }
                              aria-pressed={isSelected}
                              className={`min-h-[32px] px-3 rounded-full font-bunto text-[11px] border transition-colors whitespace-nowrap ${
                                isSelected
                                  ? 'bg-[#3E3A3C] border-[#3E3A3C] text-[#F9F2E9]'
                                  : 'bg-transparent border-[#E6D9D2] text-[#3E3A3C] hover:border-[#3E3A3C]'
                              }`}
                            >
                              {choice.label}
                              {choice.priceDelta > 0 ? ` (+${formatINR(choice.priceDelta)})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Row: Quantity Stepper + Add to Bag (3D Parabolic Flight!) + Order Now */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="inline-flex items-center justify-between h-[46px] w-full sm:w-[106px] shrink-0 rounded-full border border-[#E6D9D2] bg-[#FAF6EE]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-full flex items-center justify-center hover:text-[#B84C2E]"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span
                  data-testid="dish-quantity-value"
                  className="font-bunto text-[13px] font-medium text-center"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(9, q + 1))}
                  aria-label="Increase quantity"
                  className="w-9 h-full flex items-center justify-center hover:text-[#B84C2E]"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <button
                ref={addBtnRef}
                type="button"
                data-testid="dish-add-to-bag"
                onClick={handleAddToBag}
                className="w-full sm:flex-1 h-[46px] min-h-[46px] shrink-0 px-6 rounded-full bg-[#3E3A3C] text-[#F9F2E9] font-bunto text-[11px] font-medium uppercase tracking-[0.24em] hover:bg-[#B84C2E] transition-colors whitespace-nowrap flex items-center justify-center"
              >
                {addedToBagLabel ? 'ADDED TO BAG ✓' : 'ADD TO BAG →'}
              </button>

              <button
                type="button"
                onClick={() => onAddToOrder(dish, selectedOptions, quantity, true)}
                className="w-full sm:w-auto h-[46px] min-h-[46px] shrink-0 px-5 rounded-full border border-[#B84C2E] text-[#B84C2E] font-bunto text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-[#B84C2E] hover:text-[#F9F2E9] transition-colors whitespace-nowrap flex items-center justify-center"
              >
                Checkout
              </button>
            </div>

            {/* Compact Editorial Accordions */}
            <div className="mt-6 border-t border-[#E6D9D2]">
              {accordions.map((row) => {
                const isOpen = openAccordion === row.id;
                return (
                  <div key={row.id} className="border-b border-[#E6D9D2]">
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(isOpen ? null : row.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[42px] py-2.5 flex items-center justify-between text-left font-bunto text-[13px] font-medium text-[#3E3A3C]"
                    >
                      <span>{row.title}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#716D71] transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                      <div>
                        <p className="pb-3.5 font-bunto text-[13px] leading-[1.6] text-[#716D71]">
                          {row.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* More from this Room strip */}
        {relatedDishes.length > 0 && (
          <div className="px-5 sm:px-8 py-6 bg-[#F3E9DD]/65 border-t border-[#E6D9D2]">
            <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.26em] text-[#716D71] mb-4">
              Also in {room.title}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedDishes.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onSelectDish(rel, null)}
                  className="text-left group flex flex-col"
                >
                  <div className="w-full aspect-[3/4] rounded-[12px] overflow-hidden border border-[#E6D9D2] bg-[#F3E9DB] mb-2">
                    <SpriteCrop
                      sheetId={rel.sheetId}
                      cellIndex={rel.cellIndex}
                      alt={rel.title}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <span className="font-bunto text-[12.5px] font-medium text-[#3E3A3C] group-hover:text-[#B84C2E] transition-colors line-clamp-1">
                    {rel.title}
                  </span>
                  <span className="font-bunto text-[11px] text-[#716D71] mt-0.5">
                    {formatINR(rel.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
