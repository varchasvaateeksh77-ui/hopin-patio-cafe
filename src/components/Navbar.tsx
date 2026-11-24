import React from 'react';
import { ShoppingBag, Search } from 'lucide-react';

export type AppStage = 'landing' | 'hallway' | 'room';

interface NavbarProps {
  stage: AppStage;
  isOverlayOpen: boolean;
  isDarkTheme: boolean;
  hidden?: boolean;
  bagCount: number;
  onGoLanding: () => void;
  onReplayEntry: () => void;
  onGoGateways: () => void;
  onGoHallway: () => void;
  onOpenList: () => void;
  onGoVisit: () => void;
  onOpenBag: () => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stage,
  isOverlayOpen,
  isDarkTheme,
  hidden = false,
  bagCount,
  onGoLanding,
  onReplayEntry,
  onGoGateways,
  onGoHallway,
  onOpenList,
  onGoVisit,
  onOpenBag,
  onOpenSearch,
}) => {
  // Harmonize top chrome with the active backdrop:
  // - Warm BUNTO° cream (#F9F2E9) on Landing (Gates of Heaven) & Light 3D Gallery rooms
  // - Dark nocturnal glass only inside dark 3D rooms (when no light overlay is open)
  const useNocturnalChrome = !isOverlayOpen && stage === 'room' && isDarkTheme;
  const isLandingWarm = !isOverlayOpen && stage === 'landing';

  const headerSurface = useNocturnalChrome
    ? 'bg-transparent border-b border-transparent text-[#FAF6EE]'
    : isLandingWarm
      ? 'bg-[#F9F2E9]/92 backdrop-blur-md border-b border-[#E6D9D2] text-[#3E3A3C]'
      : isOverlayOpen
        ? 'bg-[var(--page)]/95 backdrop-blur-md border-b border-[var(--ink-15)] text-[var(--ink)]'
        : 'bg-transparent border-b border-transparent text-[var(--ink)]';

  const accentUnderline = useNocturnalChrome
    ? 'decoration-[#E6CFA6]'
    : 'decoration-[#B84C2E]';

  return (
    <header
      data-testid="primary-navbar"
      data-nav-hidden={hidden ? 'true' : 'false'}
      aria-hidden={hidden || undefined}
      className={`fixed top-0 left-0 right-0 z-30 h-[56px] px-4 md:px-5 lg:px-[calc(38*var(--u))] flex items-center justify-between gap-3 lg:gap-6 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${headerSurface} ${
        hidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Zone 1: Clean single-line brand wordmark */}
      <button
        type="button"
        onClick={onGoLanding}
        aria-label="Hopin Patio Cafe Home"
        className="font-bunto font-bold text-[19px] lg:text-[22px] tracking-[-0.035em] whitespace-nowrap shrink-0 hover:opacity-75 transition-opacity"
      >
        HOPIN
        <sup className="text-[0.52em] font-medium align-[0.82em] ml-[0.06em] text-[#B84C2E]">°</sup>
      </button>

      {/* Zone 2: Clean single-line editorial nav links */}
      <nav
        aria-label="Primary"
        className="hidden md:flex items-center gap-3.5 lg:gap-7 font-bunto text-[10px] lg:text-[11px] font-medium uppercase tracking-[0.14em] lg:tracking-[0.22em]"
      >
        <button
          type="button"
          onClick={onReplayEntry}
          className="min-h-[28px] whitespace-nowrap shrink-0 opacity-68 hover:opacity-100 transition-opacity"
        >
          3D Entry
        </button>
        <button
          type="button"
          onClick={onGoGateways}
          className={`min-h-[28px] whitespace-nowrap shrink-0 transition-opacity ${
            stage === 'landing' && !isOverlayOpen
              ? `opacity-100 underline underline-offset-4 ${accentUnderline}`
              : 'opacity-68 hover:opacity-100'
          }`}
        >
          12 Gates
        </button>
        <button
          type="button"
          onClick={onGoHallway}
          className={`min-h-[28px] whitespace-nowrap shrink-0 transition-opacity ${
            (stage === 'hallway' || stage === 'room') && !isOverlayOpen
              ? `opacity-100 underline underline-offset-4 ${accentUnderline}`
              : 'opacity-68 hover:opacity-100'
          }`}
        >
          3D Hallway
        </button>
        <button
          type="button"
          onClick={onOpenList}
          className={`min-h-[28px] whitespace-nowrap shrink-0 transition-opacity ${
            isOverlayOpen
              ? `opacity-100 underline underline-offset-4 ${accentUnderline}`
              : 'opacity-68 hover:opacity-100'
          }`}
        >
          Full Menu
        </button>
        <button
          type="button"
          onClick={onGoVisit}
          className="min-h-[28px] whitespace-nowrap shrink-0 opacity-68 hover:opacity-100 transition-opacity"
        >
          Bungalow
        </button>
      </nav>

      {/* Zone 3: Search + BUNTO° Round Bag Button */}
      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search menu dishes"
          className={`hidden sm:flex items-center justify-center lg:justify-between gap-2.5 h-[34px] w-[34px] lg:w-[148px] lg:px-3 rounded-full border transition-colors whitespace-nowrap shrink-0 ${
            useNocturnalChrome
              ? 'border-[#E6BE78]/32 bg-[#0D2322]/75 hover:border-[#F5D692]'
              : 'border-[#E6D9D2] bg-[#FAF6EE]/80 hover:border-[#3E3A3C]'
          }`}
        >
          <span
            className={`flex items-center gap-1.5 text-[11px] font-bunto ${
              useNocturnalChrome ? 'text-[#FAF6EE]/75' : 'text-[#716D71]'
            }`}
          >
            <Search className="w-3.5 h-3.5 stroke-[1.6]" aria-hidden="true" />
            <span className="hidden lg:inline">Search…</span>
          </span>
          <kbd
            className={`hidden lg:inline-block font-mono-meta text-[10px] px-1.5 py-0.5 rounded-full border ${
              useNocturnalChrome
                ? 'border-[#E6BE78]/25 text-[#F5D692]/80'
                : 'border-[#E6D9D2] text-[#716D71]'
            }`}
          >
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          data-testid="navbar-bag-btn"
          onClick={onOpenBag}
          aria-label={`Open order bag, ${bagCount} items`}
          className={`relative flex items-center justify-center gap-1.5 min-w-[36px] h-[36px] px-3.5 rounded-full border transition-colors whitespace-nowrap shrink-0 ${
            useNocturnalChrome
              ? 'border-[#FFF5E9]/35 bg-[#100D19]/75 text-[#FFF5E9] hover:bg-[#FFF5E9] hover:text-[#100D19]'
              : 'border-[#E6D9D2] bg-[#FAF6EE]/90 text-[#3E3A3C] hover:bg-[#3E3A3C] hover:text-[#F9F2E9] hover:border-[#3E3A3C]'
          }`}
        >
          <ShoppingBag className="w-4 h-4 stroke-[1.5]" aria-hidden="true" />
          <span className="font-bunto text-[10.5px] font-medium uppercase tracking-[0.18em]">
            Bag
          </span>
          {bagCount > 0 && (
            <span
              data-testid="bag-count-badge"
              className="absolute -top-[5px] -right-[5px] inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#3E3A3C] text-[#F9F2E9] font-bunto text-[9.5px] font-semibold leading-none"
            >
              {bagCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
