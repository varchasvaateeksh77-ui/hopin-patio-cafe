import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import {
  DISHES,
  getRoomById,
  SUBCATEGORY_ROOMS,
  type DishItem,
} from '../data/cafeData';
import { formatINR } from '../utils/galleryMath';
import { SpriteCrop } from './SpriteCrop';
import type { FlyerOriginRect } from './DishModal';

interface MenuListViewProps {
  open: boolean;
  initialRoomFilter?: string | null;
  autoFocusSearch?: boolean;
  onCloseToGallery: () => void;
  onSelectDish: (dish: DishItem, rect: FlyerOriginRect | null) => void;
  onEnterRoom: (roomId: string) => void;
}

export const MenuListView: React.FC<MenuListViewProps> = ({
  open,
  initialRoomFilter = null,
  autoFocusSearch = false,
  onCloseToGallery,
  onSelectDish,
  onEnterRoom,
}) => {
  const [roomFilter, setRoomFilter] = useState<string>(initialRoomFilter || 'all');
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    if (open) {
      setRoomFilter(initialRoomFilter || 'all');
    }
  }, [open, initialRoomFilter]);

  const filteredDishes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DISHES.filter((dish) => {
      const matchesRoom = roomFilter === 'all' || dish.roomId === roomFilter;
      if (!matchesRoom) return false;
      if (!q) return true;
      return (
        dish.title.toLowerCase().includes(q) ||
        dish.description.toLowerCase().includes(q) ||
        dish.chefNote.toLowerCase().includes(q) ||
        getRoomById(dish.roomId).title.toLowerCase().includes(q)
      );
    });
  }, [roomFilter, query]);

  if (!open) return null;

  const handleCardOpen = (dish: DishItem, e: React.MouseEvent<HTMLButtonElement>) => {
    const artEl = e.currentTarget.querySelector('[data-art-box]');
    const rect = artEl ? artEl.getBoundingClientRect() : null;
    onSelectDish(
      dish,
      rect
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : null
    );
  };

  return (
    <section
      id="menu-list"
      aria-label="Full Hopin Patio Cafe Menu"
      data-testid="menu-list-view"
      className="fixed inset-0 z-20 bg-[var(--page)] text-[var(--ink)] overflow-y-auto animate-fade-soft"
    >
      <div className="pt-[84px] md:pt-[104px] pb-20 px-6 md:px-14 max-w-[1360px] mx-auto">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--ink-15)]">
          <div>
            <button
              type="button"
              onClick={onCloseToGallery}
              className="inline-flex items-center gap-2 font-mono-meta text-[11px] uppercase tracking-[0.14em] text-[var(--ink-60)] hover:text-[var(--ink)] mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Return to 3D Gallery
            </button>
            <h1 className="font-display font-semibold uppercase text-[38px] md:text-[54px] leading-[0.92] text-[var(--ink)]">
              Hopin — Complete Patio Menu
            </h1>
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-[300px]">
            <Search
              className="w-4 h-4 text-[var(--ink-60)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              autoFocus={autoFocusSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mezze, pasta, kokam, biscoff…"
              aria-label="Search patio dishes"
              className="w-full h-[42px] pl-10 pr-9 bg-[var(--wall)] border border-[var(--ink-35)] font-serif-editorial text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-60)] focus:border-[var(--ink)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--ink-60)] hover:text-[var(--ink)]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Subcategory filter tabs */}
        <div
          role="tablist"
          aria-label="Filter menu by culinary room"
          className="flex flex-wrap items-center gap-2 py-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={roomFilter === 'all'}
            onClick={() => setRoomFilter('all')}
            className={`min-h-[34px] px-4 font-mono-meta text-[11px] uppercase tracking-[0.12em] border transition-colors whitespace-nowrap ${
              roomFilter === 'all'
                ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--wall)]'
                : 'border-[var(--ink-35)] text-[var(--ink)] hover:border-[var(--ink)]'
            }`}
          >
            All Rooms ({DISHES.length})
          </button>

          {SUBCATEGORY_ROOMS.map((room) => {
            const active = roomFilter === room.id;
            return (
              <button
                key={room.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoomFilter(room.id)}
                className={`min-h-[34px] px-4 font-mono-meta text-[11px] uppercase tracking-[0.12em] border transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--wall)]'
                    : 'border-[var(--ink-35)] text-[var(--ink)] hover:border-[var(--ink)]'
                }`}
              >
                {room.shortTitle}
              </button>
            );
          })}
        </div>

        {/* Active room banner shortcut into 3D room */}
        {roomFilter !== 'all' && (
          <div className="mb-8 p-4 bg-[var(--band)] border border-[var(--ink-15)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-serif-editorial font-medium text-[17px]">
                {getRoomById(roomFilter).title}
              </p>
              <p className="text-[13.5px] text-[var(--ink-60)]">
                {getRoomById(roomFilter).subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEnterRoom(roomFilter)}
              className="px-4 py-2 bg-[var(--ink)] text-[var(--wall)] font-mono-meta text-[11px] uppercase tracking-[0.12em] whitespace-nowrap self-start sm:self-center"
            >
              Walk This 3D Room →
            </button>
          </div>
        )}

        {/* Dish grid */}
        {filteredDishes.length === 0 ? (
          <div className="py-20 text-center border border-[var(--ink-15)] bg-[var(--wall)]">
            <p className="font-mono-meta text-[12px] uppercase tracking-[0.14em] text-[var(--ink-60)]">
              No matching dishes found
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRoomFilter('all');
              }}
              className="mt-4 px-5 py-2.5 border border-[var(--ink)] font-mono-meta text-[11px] uppercase tracking-[0.12em] hover:bg-[var(--ink)] hover:text-[var(--wall)] transition-colors"
            >
              Reset Menu Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-7 gap-y-12">
            {filteredDishes.map((dish) => {
              const room = getRoomById(dish.roomId);
              return (
                <button
                  key={dish.id}
                  type="button"
                  onClick={(e) => handleCardOpen(dish, e)}
                  className="dish-card group text-left flex flex-col"
                >
                  <div
                    data-art-box
                    className="dish-card-art w-full aspect-[3/4] mb-4"
                    style={{
                      boxShadow: '0 0 0 8px var(--mat), 0 8px 20px rgba(38,33,30,0.06)',
                    }}
                  >
                    <SpriteCrop
                      sheetId={dish.sheetId}
                      cellIndex={dish.cellIndex}
                      alt={dish.title}
                      className="w-full h-full"
                    />
                  </div>
                  <span className="font-serif-editorial font-medium text-[15.5px] leading-[1.3] text-[var(--ink)] group-hover:text-[var(--terracotta)] transition-colors">
                    {dish.title}
                  </span>
                  <span className="font-serif-editorial italic text-[13.5px] text-[var(--ink-60)] mt-0.5">
                    {room.shortTitle} · {dish.dietary}
                  </span>
                  <span className="font-mono-meta text-[12px] text-[var(--ink)] mt-1">
                    {formatINR(dish.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
