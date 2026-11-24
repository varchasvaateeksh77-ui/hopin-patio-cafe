import React, { useCallback, useEffect, useState } from 'react';
import {
  getRoomById,
  SUBCATEGORY_ROOMS,
  type DishItem,
  type SubcategoryRoom,
} from './data/cafeData';
import {
  addItemToCart,
  calculateCartTotals,
  getDefaultOptions,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
} from './utils/galleryMath';
import { Navbar, type AppStage } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Gallery3D } from './components/Gallery3D';
import { GatePortal3DOverlay } from './components/GatePortal3DOverlay';
import { DishModal, type FlyerOriginRect } from './components/DishModal';
import { MenuListView } from './components/MenuListView';
import { OrderBagDrawer } from './components/OrderBagDrawer';

interface GatePortalState {
  room: SubcategoryRoom;
  freezeAtMs?: number | null;
}

function getInitialStage(): {
  stage: AppStage;
  roomId: string;
  initialPortal: GatePortalState | null;
} {
  if (typeof window === 'undefined') {
    return { stage: 'landing', roomId: SUBCATEGORY_ROOMS[0].id, initialPortal: null };
  }
  const params = new URLSearchParams(window.location.search);

  // Deterministic inspection hook for any of the 12 Culinary Gate 3D fly-throughs
  const gateRoomParam = params.get('gateRoom');
  const gateEntryAtParam = params.get('gateEntryAt');
  if (gateRoomParam && SUBCATEGORY_ROOMS.some((r) => r.id === gateRoomParam)) {
    const parsedMs =
      gateEntryAtParam !== null && gateEntryAtParam !== '' ? Number(gateEntryAtParam) : null;
    return {
      stage: 'landing',
      roomId: gateRoomParam,
      initialPortal: {
        room: getRoomById(gateRoomParam),
        freezeAtMs: parsedMs !== null && Number.isFinite(parsedMs) ? parsedMs : null,
      },
    };
  }

  const roomParam = params.get('room');
  if (roomParam && SUBCATEGORY_ROOMS.some((r) => r.id === roomParam)) {
    return { stage: 'room', roomId: roomParam, initialPortal: null };
  }
  if (params.get('autostart') === '1' || params.get('view') === 'hallway') {
    return { stage: 'hallway', roomId: SUBCATEGORY_ROOMS[0].id, initialPortal: null };
  }
  return { stage: 'landing', roomId: SUBCATEGORY_ROOMS[0].id, initialPortal: null };
}

export default function App() {
  const [initial] = useState(() => getInitialStage());
  const [stage, setStage] = useState<AppStage>(initial.stage);
  const [activeRoomId, setActiveRoomId] = useState<string>(initial.roomId);

  const [replayIntroSignal, setReplayIntroSignal] = useState<number>(0);
  const [heroIntroHidden, setHeroIntroHidden] = useState<boolean>(() => {
    if (initial.stage !== 'landing' || initial.initialPortal) return false;
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('skipIntro') === '1' || params.get('openGate')) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !params.get('heroEntryAt')) {
      return false;
    }
    return true;
  });
  const [gatePortal, setGatePortal] = useState<GatePortalState | null>(initial.initialPortal);
  const [gatePortalNavHidden, setGatePortalNavHidden] = useState<boolean>(
    Boolean(initial.initialPortal)
  );

  const [selectedDish, setSelectedDish] = useState<DishItem | null>(null);
  const [flyerRect, setFlyerRect] = useState<FlyerOriginRect | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [listRoomFilter, setListRoomFilter] = useState<string | null>(null);
  const [listAutoFocusSearch, setListAutoFocusSearch] = useState(false);

  const [bagOpen, setBagOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const totals = calculateCartTotals(cart);
  const isOverlayOpen = Boolean(selectedDish) || listOpen;
  const activeRoom = getRoomById(activeRoomId);
  const isDarkTheme = stage === 'room' && activeRoom.isDarkRoom;
  const isNavbarHidden = heroIntroHidden || gatePortalNavHidden;

  // Lock body scroll while inside the 3D WebGL gallery or playing a full-screen 3D entry fly-through
  useEffect(() => {
    if (stage === 'hallway' || stage === 'room' || Boolean(gatePortal) || heroIntroHidden) {
      document.body.classList.add('gallery-locked');
    } else {
      document.body.classList.remove('gallery-locked');
    }
    return () => {
      document.body.classList.remove('gallery-locked');
    };
  }, [stage, gatePortal, heroIntroHidden]);

  // Global Cmd+K / Ctrl+K opens searchable full menu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSelectedDish(null);
        setListRoomFilter(null);
        setListAutoFocusSearch(true);
        setListOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleGoLanding = useCallback(() => {
    setSelectedDish(null);
    setListOpen(false);
    setGatePortal(null);
    setGatePortalNavHidden(false);
    setStage('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReplayEntry = useCallback(() => {
    setSelectedDish(null);
    setListOpen(false);
    setGatePortal(null);
    setGatePortalNavHidden(false);
    setStage('landing');
    setHeroIntroHidden(true);
    setReplayIntroSignal((n) => n + 1);
  }, []);

  const handleGoGateways = useCallback(() => {
    setSelectedDish(null);
    setListOpen(false);
    setGatePortal(null);
    setGatePortalNavHidden(false);
    setStage('landing');
    window.setTimeout(() => {
      const el = document.getElementById('gateways-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  }, []);

  const handleGoHallway = useCallback(() => {
    setSelectedDish(null);
    setListOpen(false);
    setGatePortal(null);
    setGatePortalNavHidden(false);
    setStage('hallway');
  }, []);

  // Commit the room change cleanly underneath the active 3D Gate Portal
  const commitRoomSwitch = useCallback((roomId: string) => {
    setSelectedDish(null);
    setListOpen(false);
    setActiveRoomId(roomId);
    setStage('room');
  }, []);

  // Entering ANY culinary gate launches its bespoke Three.js 3D Colonnade & Brass Oculus Fly-Through
  const handleEnterRoom = useCallback(
    (roomId: string) => {
      const room = getRoomById(roomId);
      setSelectedDish(null);
      setListOpen(false);

      // If switching between rooms inside the room switcher pill bar while already in a room,
      // or entering from 12 Gates / 3D Hallway / Full Menu, fly through the room's 3D Gate!
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        commitRoomSwitch(room.id);
        return;
      }

      setGatePortalNavHidden(true);
      setGatePortal({ room, freezeAtMs: null });
    },
    [commitRoomSwitch]
  );

  const handleOpenList = useCallback((roomFilter: string | null = null, focusSearch = false) => {
    setSelectedDish(null);
    setListRoomFilter(roomFilter);
    setListAutoFocusSearch(focusSearch);
    setListOpen(true);
  }, []);

  const handleGoVisit = useCallback(() => {
    setSelectedDish(null);
    setListOpen(false);
    setGatePortal(null);
    setGatePortalNavHidden(false);
    setStage('landing');
    window.setTimeout(() => {
      const el = document.getElementById('visit-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  }, []);

  const handleOpenDish = useCallback((dish: DishItem, rect: FlyerOriginRect | null) => {
    setFlyerRect(rect);
    setSelectedDish(dish);
  }, []);

  const handleAddToOrder = useCallback(
    (
      dish: DishItem,
      selectedOptions: Record<string, string>,
      quantity: number,
      instantCheckout = false
    ) => {
      const room = getRoomById(dish.roomId);
      setCart((prev) => addItemToCart(prev, dish, room.title, selectedOptions, quantity));
      if (instantCheckout) {
        setSelectedDish(null);
        setBagOpen(true);
      }
    },
    []
  );

  const handleQuickAddDish = useCallback((dish: DishItem) => {
    const room = getRoomById(dish.roomId);
    setCart((prev) => addItemToCart(prev, dish, room.title, getDefaultOptions(dish), 1));
  }, []);

  const handleToggleBookmark = useCallback((dishId: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(dishId) ? prev.filter((id) => id !== dishId) : [...prev, dishId]
    );
  }, []);

  return (
    <div data-app-stage={stage} className="min-h-screen bg-[var(--wall)] text-[var(--ink)]">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <Navbar
        stage={stage}
        isOverlayOpen={isOverlayOpen}
        isDarkTheme={isDarkTheme}
        hidden={isNavbarHidden}
        bagCount={totals.itemCount}
        onGoLanding={handleGoLanding}
        onReplayEntry={handleReplayEntry}
        onGoGateways={handleGoGateways}
        onGoHallway={handleGoHallway}
        onOpenList={() => handleOpenList(stage === 'room' ? activeRoomId : null, false)}
        onGoVisit={handleGoVisit}
        onOpenBag={() => setBagOpen(true)}
        onOpenSearch={() => handleOpenList(null, true)}
      />

      {stage === 'landing' ? (
        <LandingPage
          replayIntroSignal={replayIntroSignal}
          onEnterHallway={handleGoHallway}
          onEnterRoomDirectly={handleEnterRoom}
          onOpenFullMenu={() => handleOpenList(null, false)}
          onHeroIntroActiveChange={setHeroIntroHidden}
          onQuickAddDish={handleQuickAddDish}
        />
      ) : (
        <Gallery3D
          mode={stage === 'hallway' ? 'hallway' : 'room'}
          activeRoomId={activeRoomId}
          isOverlayOpen={isOverlayOpen || Boolean(gatePortal)}
          onEnterRoom={handleEnterRoom}
          onBackToHallway={handleGoHallway}
          onOpenDish={handleOpenDish}
          onOpenList={() => handleOpenList(stage === 'room' ? activeRoomId : null, false)}
          onGoGateways={handleGoGateways}
        />
      )}

      {/* Full-Screen Three.js WebGL 3D Architectural Gate Fly-Through for ALL 12 Culinary Gates */}
      {gatePortal && (
        <GatePortal3DOverlay
          key={gatePortal.room.id}
          room={gatePortal.room}
          freezeAtMs={gatePortal.freezeAtMs}
          onSwapRoom={commitRoomSwitch}
          onNavHiddenChange={setGatePortalNavHidden}
          onComplete={() => {
            setGatePortal(null);
            setGatePortalNavHidden(false);
          }}
        />
      )}

      <MenuListView
        open={listOpen}
        initialRoomFilter={listRoomFilter}
        autoFocusSearch={listAutoFocusSearch}
        onCloseToGallery={() => {
          setListOpen(false);
          if (stage === 'landing') {
            setStage('hallway');
          }
        }}
        onSelectDish={handleOpenDish}
        onEnterRoom={handleEnterRoom}
      />

      <DishModal
        dish={selectedDish}
        originRect={flyerRect}
        bookmarkedIds={bookmarkedIds}
        onToggleBookmark={handleToggleBookmark}
        onClose={() => setSelectedDish(null)}
        onSelectDish={handleOpenDish}
        onAddToOrder={handleAddToOrder}
      />

      <OrderBagDrawer
        open={bagOpen}
        items={cart}
        onClose={() => setBagOpen(false)}
        onUpdateQty={(key, delta) => setCart((prev) => updateCartQuantity(prev, key, delta))}
        onRemoveItem={(key) => setCart((prev) => removeCartItem(prev, key))}
        onClearCart={() => setCart([])}
      />
    </div>
  );
}
