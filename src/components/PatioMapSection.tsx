import React, { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Feather,
  LocateFixed,
  Navigation,
  Star,
} from 'lucide-react';
import { CAFE_INFO, DISHES, SUBCATEGORY_ROOMS } from '../data/cafeData';
import {
  buildGooglePinnedPlaceUrl,
  buildGoogleWriteReviewUrl,
  normalizeLiveGoogleReviews,
  pickRandomGoogleReview,
  type LiveGoogleReview,
} from '../utils/googleReviews';
import {
  MAP_CAMERA_PRESETS,
  buildRealGoogleMapEmbedUrl,
  ensureGsapRegistered,
  getMapCameraPreset,
  isQuotaErrorMessage,
  prefersReducedMotion,
  type MapCameraPreset,
} from '../utils/scrollChoreography';
import { PatioPostcardReview } from './PatioPostcardReview';

interface LivePlaceSummary {
  placeId?: string;
  displayName?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsURI?: string;
  reviews: LiveGoogleReview[];
}

const HopinPlaceLookup: React.FC<{ onLoaded: (info: LivePlaceSummary) => void }> = ({
  onLoaded,
}) => {
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    const run = async () => {
      try {
        const { Place } = placesLib as unknown as {
          Place: {
            searchByText: (req: {
              textQuery: string;
              fields: string[];
              locationBias?: { center: { lat: number; lng: number }; radius: number };
            }) => Promise<{
              places?: Array<{
                id?: string;
                displayName?: string;
                formattedAddress?: string;
                rating?: number;
                userRatingCount?: number;
                googleMapsURI?: string;
                reviews?: unknown[];
                fetchFields?: (opts: { fields: string[] }) => Promise<unknown>;
              }>;
            }>;
          };
        };

        if (Place && typeof Place.searchByText === 'function') {
          const res = await Place.searchByText({
            textQuery: 'Hopin - Patio Cafe, New Palasia, Indore',
            fields: [
              'id',
              'displayName',
              'formattedAddress',
              'rating',
              'userRatingCount',
              'googleMapsURI',
              'reviews',
            ],
            locationBias: {
              center: CAFE_INFO.coords,
              radius: 500,
            },
          });
          const first = res.places?.[0];
          if (first) {
            let rawReviews = first.reviews;
            if (
              (!Array.isArray(rawReviews) || rawReviews.length === 0) &&
              typeof first.fetchFields === 'function'
            ) {
              try {
                await first.fetchFields({ fields: ['reviews'] });
                rawReviews = first.reviews;
              } catch {
                // Keep place metadata even if secondary reviews field fetch is unavailable
              }
            }

            if (!cancelled) {
              onLoaded({
                placeId: first.id,
                displayName: first.displayName,
                formattedAddress: first.formattedAddress,
                rating: first.rating,
                userRatingCount: first.userRatingCount,
                googleMapsURI: first.googleMapsURI,
                reviews: normalizeLiveGoogleReviews(rawReviews, 4),
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err ?? '');
        if (isQuotaErrorMessage(msg) || msg.includes('429')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [placesLib, onLoaded]);

  return null;
};

const MapCameraSync: React.FC<{ preset: MapCameraPreset; recenterTick: number }> = ({
  preset,
  recenterTick,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(preset.center);
    map.setZoom(preset.zoom);
    map.setMapTypeId(preset.mapTypeId);
  }, [map, preset, recenterTick]);

  return null;
};

const HopinAdvancedMarker: React.FC<{
  livePlace: LivePlaceSummary | null;
  infoOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  directionsUrl: string;
}> = ({ livePlace, infoOpen, onOpen, onClose, directionsUrl }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={CAFE_INFO.coords}
        title={livePlace?.displayName || CAFE_INFO.name}
        onClick={onOpen}
      >
        <Pin
          background="#B84C2E"
          glyphColor="#FAF4EB"
          borderColor="#201D1E"
          scale={1.2}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={250} onCloseClick={onClose}>
          <div className="p-1 text-[#201D1E]">
            <p className="font-bunto font-semibold text-[13.5px] leading-snug">
              {livePlace?.displayName || CAFE_INFO.name}
            </p>
            <p className="font-bunto text-[11.5px] text-[#635E61] mt-1 leading-relaxed">
              {livePlace?.formattedAddress || CAFE_INFO.address}
            </p>
            {typeof livePlace?.rating === 'number' && (
              <p className="font-bunto text-[11px] font-medium mt-1.5 text-[#B84C2E] tabular-nums">
                ★ {livePlace.rating.toFixed(1)}
                {typeof livePlace.userRatingCount === 'number'
                  ? ` (${livePlace.userRatingCount} Google reviews)`
                  : ''}
              </p>
            )}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 font-bunto text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#201D1E] hover:text-[#B84C2E] underline underline-offset-4"
            >
              Directions
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const PatioMapSection: React.FC = () => {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';
  const [infoOpen, setInfoOpen] = useState(true);
  const [livePlace, setLivePlace] = useState<LivePlaceSummary | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [activePresetId, setActivePresetId] = useState<MapCameraPreset['id']>('bungalow');
  const [recenterTick, setRecenterTick] = useState(0);

  // Patio Guestbook state (real live Google reviews + interactive postcard composer)
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [initialPick] = useState(() => pickRandomGoogleReview());
  const [draftIdx, setDraftIdx] = useState<number>(initialPick.index);
  const [draftRating, setDraftRating] = useState<number>(5);
  const [draftText, setDraftText] = useState<string>(initialPick.draft.text);
  const [draftVibeTag, setDraftVibeTag] = useState<string>(initialPick.draft.vibeTag);
  const [draftCopied, setDraftCopied] = useState<boolean>(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const featuredCardRef = useRef<HTMLDivElement | null>(null);

  const activePreset = getMapCameraPreset(activePresetId);
  const directionsUrl = CAFE_INFO.directionsUrl;
  const mapsPlaceUrl = livePlace?.googleMapsURI || buildGooglePinnedPlaceUrl(livePlace?.placeId);
  const writeReviewUrl = buildGoogleWriteReviewUrl(livePlace?.placeId);
  const liveReviews = livePlace?.reviews ?? [];
  const safeReviewIdx = liveReviews.length > 0 ? activeReviewIdx % liveReviews.length : 0;
  const activeReview = liveReviews[safeReviewIdx] ?? null;

  const handleLoadedPlace = useCallback((info: LivePlaceSummary) => {
    setLivePlace(info);
    setActiveReviewIdx(0);
  }, []);

  const stepReview = useCallback(
    (delta: number) => {
      if (liveReviews.length <= 1) return;
      setActiveReviewIdx((prev) => (prev + delta + liveReviews.length) % liveReviews.length);
    },
    [liveReviews.length]
  );

  const rollGuestbookDraft = useCallback(() => {
    const picked = pickRandomGoogleReview(draftIdx);
    setDraftIdx(picked.index);
    setDraftText(picked.draft.text);
    setDraftVibeTag(picked.draft.vibeTag);
    setDraftCopied(false);
  }, [draftIdx]);

  const handleCopyGuestbookDraft = useCallback(() => {
    const clean = draftText.trim();
    if (!clean) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).catch(() => {
        // Silent fallback if iframe clipboard permissions restrict direct write
      });
    }
    setDraftCopied(true);
    window.setTimeout(() => setDraftCopied(false), 2600);
  }, [draftText]);

  // Subtle GSAP transition when flipping through live Google review postcards
  useEffect(() => {
    if (!featuredCardRef.current || prefersReducedMotion() || !activeReview) return;
    gsap.fromTo(
      featuredCardRef.current,
      { y: 10, opacity: 0.45 },
      { y: 0, opacity: 1, duration: 0.42, ease: 'power2.out', clearProps: 'transform,opacity' }
    );
  }, [safeReviewIdx, activeReview]);

  // GSAP ScrollTrigger choreography for architectural wayfinding + live Google Map frame + Guestbook
  useEffect(() => {
    ensureGsapRegistered();
    if (!sectionRef.current || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from('.visit-rule', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.95,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 84%',
          once: true,
        },
      });

      gsap.from('.visit-reveal', {
        y: 34,
        opacity: 0,
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          once: true,
        },
      });

      gsap.from('.visit-map-shell', {
        y: 44,
        scale: 0.97,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.visit-map-shell',
          start: 'top 84%',
          once: true,
        },
      });

      gsap.from('.guestbook-reveal', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '.guestbook-band',
          start: 'top 86%',
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const useLiveSdk = Boolean(apiKey) && !mapFailed;
  const fallbackEmbedUrl = buildRealGoogleMapEmbedUrl(
    activePreset.center,
    activePreset.zoom,
    activePreset.mapTypeId
  );

  return (
    <section
      ref={sectionRef}
      id="visit-section"
      aria-labelledby="visit-heading"
      data-testid="visit-map-section"
      className="relative scroll-mt-[56px] py-20 md:py-28 px-5 sm:px-8 md:px-12 bg-[#F3E9DC] text-[#3E3A3C] border-b border-[#DFD0C0]"
    >
      <div className="max-w-[1360px] mx-auto">
        {/* Top Architectural Hairline Header */}
        <div className="visit-rule h-[1px] w-full bg-[#D7C6B4] mb-10 md:mb-14" aria-hidden="true" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          {/* Left: Editorial Architectural Wayfinding & Clean Hairline Timetable */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <p className="visit-reveal font-bunto text-[10px] font-medium uppercase tracking-[0.28em] text-[#B84C2E] mb-3">
                03 · New Palasia · Indore
              </p>
              <h2
                id="visit-heading"
                className="visit-reveal font-bunto font-medium text-[32px] sm:text-[40px] md:text-[48px] leading-[1.03] tracking-[-0.03em] text-[#262324] text-balance mb-4"
              >
                Find the{' '}
                <span className="font-serif-editorial italic font-normal text-[#B84C2E]">
                  Bungalow
                </span>
              </h2>
              <p className="visit-reveal font-bunto font-normal text-[14.5px] sm:text-[15.5px] leading-[1.7] text-[#666164] mb-9 max-w-[40ch]">
                Tucked behind a brick-terracotta pergola in New Palasia—sunlit courtyard espresso,
                sizzling vegetarian plates, and unhurried evening tables.
              </p>

              {/* Clean unboxed hairline architectural timetable */}
              <dl className="border-t border-[#D7C6B4] divide-y divide-[#D7C6B4] text-[14px]">
                <div className="visit-reveal py-4 grid grid-cols-12 gap-3 items-baseline">
                  <dt className="col-span-4 font-bunto text-[10px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                    Address
                  </dt>
                  <dd className="col-span-8 font-bunto text-[#262324] leading-[1.55]">
                    {livePlace?.formattedAddress || CAFE_INFO.address}
                  </dd>
                </div>

                <div className="visit-reveal py-4 grid grid-cols-12 gap-3 items-baseline">
                  <dt className="col-span-4 font-bunto text-[10px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                    Hours
                  </dt>
                  <dd className="col-span-8 font-bunto text-[#262324] tabular-nums">
                    {CAFE_INFO.hours}
                  </dd>
                </div>

                <div className="visit-reveal py-4 grid grid-cols-12 gap-3 items-baseline">
                  <dt className="col-span-4 font-bunto text-[10px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                    Kitchen
                  </dt>
                  <dd className="col-span-8 font-bunto text-[#262324] tabular-nums">
                    {SUBCATEGORY_ROOMS.length} culinary wings · {DISHES.length} vegetarian dishes ·
                    Jain options
                  </dd>
                </div>

                <div className="visit-reveal py-4 grid grid-cols-12 gap-3 items-baseline">
                  <dt className="col-span-4 font-bunto text-[10px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                    Seating
                  </dt>
                  <dd className="col-span-8 font-bunto text-[#262324]">
                    Open-air courtyard · Upper veranda · Indoor espresso bar
                  </dd>
                </div>

                {typeof livePlace?.rating === 'number' && (
                  <div className="visit-reveal py-4 grid grid-cols-12 gap-3 items-baseline">
                    <dt className="col-span-4 font-bunto text-[10px] font-medium uppercase tracking-[0.22em] text-[#716D71]">
                      Google Maps
                    </dt>
                    <dd className="col-span-8 font-bunto text-[#262324] tabular-nums">
                      ★ {livePlace.rating.toFixed(1)}
                      {typeof livePlace.userRatingCount === 'number'
                        ? ` · ${livePlace.userRatingCount.toLocaleString()} reviews`
                        : ''}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="visit-reveal mt-8 pt-6 border-t border-[#D7C6B4] flex flex-wrap items-center gap-5">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#201D1E] text-[#F9F2E9] font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em] hover:bg-[#B84C2E] transition-colors whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                Get Directions
              </a>
              <a
                href={mapsPlaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bunto text-[10.5px] font-medium uppercase tracking-[0.22em] text-[#262324] border-b border-[#262324] pb-1 hover:text-[#B84C2E] hover:border-[#B84C2E] transition-colors whitespace-nowrap"
              >
                Open in Google Maps
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Right: 100% Real Interactive Google Map */}
          <div className="visit-map-shell lg:col-span-7 flex flex-col">
            {/* Compact Map View Switcher Bar above the real map canvas */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
              <div
                role="tablist"
                aria-label="Google Map view presets"
                className="inline-flex items-center gap-1 p-1 rounded-full bg-[#EAE0D1] border border-[#D7C6B4]"
              >
                {MAP_CAMERA_PRESETS.map((preset) => {
                  const isActive = preset.id === activePreset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-testid={`map-preset-${preset.id}`}
                      onClick={() => {
                        setActivePresetId(preset.id);
                        setRecenterTick((t) => t + 1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-bunto text-[10px] font-medium uppercase tracking-[0.16em] transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#201D1E] text-[#F9F2E9]'
                          : 'text-[#5C575A] hover:text-[#201D1E]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="map-recenter-btn"
                onClick={() => {
                  setInfoOpen(true);
                  setRecenterTick((t) => t + 1);
                }}
                aria-label="Recenter map on Hopin Patio Cafe"
                className="inline-flex items-center gap-1.5 font-bunto text-[10px] font-medium uppercase tracking-[0.18em] text-[#5C575A] hover:text-[#B84C2E] transition-colors whitespace-nowrap"
              >
                <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                Recenter Pin
              </button>
            </div>

            {/* Real Google Map Viewport (Explicit height prevents 0x0 collapse) */}
            <div
              data-testid="real-google-map-container"
              data-map-mode={useLiveSdk ? 'google-maps-js-sdk' : 'google-maps-embed'}
              className="relative flex-1 w-full h-[410px] sm:h-[460px] lg:h-[520px] min-h-[410px] rounded-[20px] overflow-hidden border border-[#D7C6B4] bg-[#E7DEC8] shadow-[0_24px_60px_-32px_rgba(32,29,30,0.28)]"
            >
              {useLiveSdk ? (
                <APIProvider
                  apiKey={apiKey}
                  libraries={['marker', 'places']}
                  language="en"
                  region="IN"
                  onError={() => setMapFailed(true)}
                >
                  <HopinPlaceLookup onLoaded={handleLoadedPlace} />
                  <div className="w-full h-full">
                    <GoogleMap
                      defaultCenter={CAFE_INFO.coords}
                      defaultZoom={18}
                      mapId="DEMO_MAP_ID"
                      mapTypeId={activePreset.mapTypeId}
                      gestureHandling="cooperative"
                      mapTypeControl={false}
                      streetViewControl={true}
                      fullscreenControl={true}
                      zoomControl={true}
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      className="w-full h-full"
                    >
                      <MapCameraSync preset={activePreset} recenterTick={recenterTick} />
                      <HopinAdvancedMarker
                        livePlace={livePlace}
                        infoOpen={infoOpen}
                        onOpen={() => setInfoOpen(true)}
                        onClose={() => setInfoOpen(false)}
                        directionsUrl={directionsUrl}
                      />
                    </GoogleMap>
                  </div>
                </APIProvider>
              ) : (
                <iframe
                  key={`${activePreset.id}-${recenterTick}`}
                  title="Hopin Patio Cafe — 17/2 New Palasia, Indore on Google Maps"
                  src={fallbackEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              )}
            </div>

            {/* Quiet unboxed architectural caption below the map */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-bunto text-[11px] text-[#666164] tabular-nums">
              <span>{activePreset.caption}</span>
              <span>
                {CAFE_INFO.coords.lat.toFixed(4)}° N · {CAFE_INFO.coords.lng.toFixed(4)}° E
              </span>
            </div>
          </div>
        </div>

        {/* PATIO GUESTBOOK — Live Google Maps Reviews + Interactive Patio Postcard Composer */}
        <div
          data-testid="patio-guestbook"
          className="guestbook-band mt-14 md:mt-20 pt-12 md:pt-16 border-t border-[#D7C6B4]"
        >
          {/* Guestbook Header Split */}
          <div className="guestbook-reveal flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-10">
            <div>
              <p className="font-bunto text-[10px] font-medium uppercase tracking-[0.28em] text-[#B84C2E] mb-2.5">
                Patio Guestbook · Live from Google Maps
              </p>
              <h3 className="font-bunto font-medium text-[28px] sm:text-[34px] md:text-[40px] leading-[1.06] tracking-[-0.03em] text-[#262324]">
                Notes From the{' '}
                <span className="font-serif-editorial italic font-normal text-[#B84C2E]">
                  Courtyard
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {typeof livePlace?.rating === 'number' && (
                <div className="flex items-baseline gap-2.5 sm:pr-6 sm:border-r sm:border-[#D7C6B4]">
                  <span className="font-bunto font-light text-[34px] sm:text-[38px] leading-none tracking-[-0.03em] text-[#262324] tabular-nums">
                    {livePlace.rating.toFixed(1)}
                  </span>
                  <div>
                    <div className="flex items-center gap-0.5" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= Math.round(livePlace.rating ?? 0)
                              ? 'text-[#C88435] fill-[#C88435]'
                              : 'text-[#CFC3B5]'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="font-bunto text-[10.5px] text-[#666164] mt-1 tabular-nums">
                      {typeof livePlace.userRatingCount === 'number'
                        ? `${livePlace.userRatingCount.toLocaleString()} Google reviews`
                        : 'Google Maps rating'}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                data-testid="guestbook-toggle-composer"
                aria-expanded={composerOpen}
                onClick={() => setComposerOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-full border font-bunto text-[10px] sm:text-[10.5px] font-medium uppercase tracking-[0.2em] transition-colors whitespace-nowrap ${
                  composerOpen
                    ? 'bg-[#B84C2E] border-[#B84C2E] text-[#F9F2E9]'
                    : 'bg-[#FAF4EB] border-[#262324] text-[#262324] hover:bg-[#201D1E] hover:text-[#F9F2E9]'
                }`}
              >
                <Feather className="w-3.5 h-3.5" aria-hidden="true" />
                {composerOpen ? 'Close Postcard' : 'Write a Patio Postcard'}
              </button>
            </div>
          </div>

          {/* Expandable Inline Patio Postcard Composer */}
          {composerOpen && (
            <div className="mb-8 md:mb-10 max-w-[680px]">
              <PatioPostcardReview
                testId="guestbook-postcard-composer"
                textareaId="hopin-guestbook-review-input"
                eyebrow="Hopin Patio Postcard"
                headline="Add your note to our Google Guestbook"
                rating={draftRating}
                onRatingChange={setDraftRating}
                reviewText={draftText}
                onReviewTextChange={setDraftText}
                vibeTag={draftVibeTag}
                copied={draftCopied}
                onShuffle={rollGuestbookDraft}
                onCopy={handleCopyGuestbookDraft}
                mapsUrl={writeReviewUrl}
              />
            </div>
          )}

          {/* Live Google Maps Reviews Showcase (100% Real Places API Reviews, Zero Fabricated Quotes) */}
          {activeReview ? (
            <div
              data-testid="live-google-reviews-deck"
              className="guestbook-reveal grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch"
            >
              {/* Featured Courtyard Note Postcard */}
              <div
                ref={featuredCardRef}
                className="lg:col-span-7 relative rounded-[20px] bg-[#FAF4EB] border border-[#D7C6B4] p-6 sm:p-8 flex flex-col justify-between overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[8px] rounded-[14px] border border-[#E9DCCA]"
                />

                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E5D7C6]">
                    <div>
                      <div
                        className="flex items-center gap-1"
                        aria-label={`Rated ${activeReview.rating} out of 5 on Google Maps`}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(activeReview.rating)
                                ? 'text-[#C88435] fill-[#C88435]'
                                : 'text-[#D6C9B9]'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                        <span className="ml-1.5 font-bunto text-[11px] font-medium text-[#262324] tabular-nums">
                          {activeReview.rating.toFixed(1)}
                        </span>
                      </div>
                      {activeReview.relativeTime && (
                        <p className="font-bunto text-[11px] text-[#787174] mt-1">
                          Posted {activeReview.relativeTime} on Google Maps
                        </p>
                      )}
                    </div>

                    {/* Subtle Courtyard Postmark */}
                    <div
                      aria-hidden="true"
                      className="shrink-0 px-2.5 py-1 rounded-[8px] border border-dashed border-[#B84C2E]/55 bg-[#F5EBE0] text-right"
                    >
                      <p className="font-bunto text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#B84C2E]">
                        GOOGLE MAPS
                      </p>
                      <p className="font-bunto text-[8px] uppercase tracking-[0.14em] text-[#716D71] mt-0.5 tabular-nums">
                        NOTE {String(safeReviewIdx + 1).padStart(2, '0')} /{' '}
                        {String(liveReviews.length).padStart(2, '0')}
                      </p>
                    </div>
                  </div>

                  <blockquote className="mt-5 sm:mt-6">
                    <span
                      aria-hidden="true"
                      className="block font-serif-editorial text-[42px] leading-[0.6] text-[#B84C2E]/45 select-none mb-2"
                    >
                      “
                    </span>
                    <p
                      data-testid="live-google-review-quote"
                      className="font-bunto text-[15px] sm:text-[16.5px] leading-[1.72] text-[#262324] line-clamp-6"
                    >
                      {activeReview.text}
                    </p>
                  </blockquote>
                </div>

                {/* Attribution + Postcard Navigation Controls */}
                <div className="relative z-10 mt-6 pt-5 border-t border-[#E5D7C6] flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex flex-col items-start gap-1">
                    {activeReview.authorUri ? (
                      <a
                        href={activeReview.authorUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-serif-editorial italic text-[18px] leading-snug text-[#262324] hover:text-[#B84C2E] transition-colors"
                      >
                        — {activeReview.authorName}
                      </a>
                    ) : (
                      <p className="font-serif-editorial italic text-[18px] leading-snug text-[#262324]">
                        — {activeReview.authorName}
                      </p>
                    )}
                    <a
                      href={activeReview.googleMapsUri || mapsPlaceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bunto text-[10px] font-medium uppercase tracking-[0.18em] text-[#716D71] hover:text-[#B84C2E] transition-colors"
                    >
                      View on Google Maps
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>

                  {liveReviews.length > 1 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="guestbook-prev-review"
                        onClick={() => stepReview(-1)}
                        aria-label="Previous Google review"
                        className="w-9 h-9 rounded-full border border-[#D7C6B4] bg-[#F4ECE0] hover:border-[#201D1E] hover:bg-[#201D1E] hover:text-[#F9F2E9] text-[#262324] flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="font-bunto text-[11px] font-medium text-[#666164] tabular-nums min-w-[44px] text-center">
                        {String(safeReviewIdx + 1).padStart(2, '0')} /{' '}
                        {String(liveReviews.length).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        data-testid="guestbook-next-review"
                        onClick={() => stepReview(1)}
                        aria-label="Next Google review"
                        className="w-9 h-9 rounded-full border border-[#D7C6B4] bg-[#F4ECE0] hover:border-[#201D1E] hover:bg-[#201D1E] hover:text-[#F9F2E9] text-[#262324] flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Architectural Guestbook Index Ledger */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <div className="border-t border-[#D7C6B4] divide-y divide-[#D7C6B4]">
                  {liveReviews.map((review, idx) => {
                    const isCurrent = idx === safeReviewIdx;
                    return (
                      <button
                        key={review.id}
                        type="button"
                        onClick={() => setActiveReviewIdx(idx)}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={`w-full text-left py-4 px-3 -mx-3 rounded-[12px] transition-colors flex items-start justify-between gap-4 ${
                          isCurrent ? 'bg-[#FAF4EB]' : 'hover:bg-[#EFE4D5]/70'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bunto text-[10px] font-medium tabular-nums ${
                                isCurrent ? 'text-[#B84C2E]' : 'text-[#877F82]'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-bunto text-[13.5px] font-medium text-[#262324] truncate">
                              {review.authorName}
                            </span>
                            {review.relativeTime && (
                              <span className="font-bunto text-[11px] text-[#787174] shrink-0 hidden sm:inline">
                                · {review.relativeTime}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-bunto text-[12.5px] text-[#666164] line-clamp-1">
                            {review.text}
                          </p>
                        </div>

                        <span className="shrink-0 inline-flex items-center gap-1 font-bunto text-[11.5px] font-medium text-[#262324] tabular-nums pt-0.5">
                          <Star
                            className="w-3 h-3 text-[#C88435] fill-[#C88435]"
                            aria-hidden="true"
                          />
                          {review.rating.toFixed(1)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-4 border-t border-[#D7C6B4] flex flex-wrap items-center justify-between gap-3">
                  <span className="font-bunto text-[11px] text-[#716D71]">
                    Verified guest reviews via Google Maps
                  </span>
                  <a
                    href={mapsPlaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bunto text-[10.5px] font-medium uppercase tracking-[0.2em] text-[#262324] border-b border-[#262324] pb-0.5 hover:text-[#B84C2E] hover:border-[#B84C2E] transition-colors whitespace-nowrap"
                  >
                    Read All on Google
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Honest zero-fabrication state while reviews load or if Places reviews are unavailable */
            <div className="guestbook-reveal rounded-[18px] bg-[#FAF4EB] border border-[#D7C6B4] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <p className="font-serif-editorial italic text-[20px] text-[#262324]">
                  Read verified Indore guest notes on Google Maps
                </p>
                <p className="font-bunto text-[13.5px] text-[#666164] mt-1 max-w-[54ch]">
                  See what diners love about the courtyard espresso bar, sizzling platters, and
                  evening patio—or open a postcard above to share your own visit.
                </p>
              </div>
              <a
                href={mapsPlaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#201D1E] hover:bg-[#B84C2E] text-[#F9F2E9] font-bunto text-[10.5px] font-medium uppercase tracking-[0.2em] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Google Maps Reviews
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
