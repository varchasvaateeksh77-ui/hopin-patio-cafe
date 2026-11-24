import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_CAMERA_PRESETS,
  getMapCameraPreset,
  isQuotaErrorMessage,
  buildRealGoogleMapEmbedUrl,
  clampScrollProgress,
} from './scrollChoreography';
import { CAFE_INFO } from '../data/cafeData';
import {
  HOPIN_GOOGLE_REVIEWS,
  HOPIN_GOOGLE_REVIEW_URL,
  STAR_MOOD_LABELS,
  buildGooglePinnedPlaceUrl,
  buildGoogleWriteReviewUrl,
  buildOrderAwareReviewDraft,
  getStarMood,
  normalizeLiveGoogleReviews,
} from './googleReviews';

test('MAP_CAMERA_PRESETS exposes bungalow, neighbourhood, and aerial presets centered on Hopin', () => {
  assert.equal(MAP_CAMERA_PRESETS.length, 3);
  const bungalow = getMapCameraPreset('bungalow');
  const neighbourhood = getMapCameraPreset('neighbourhood');
  const aerial = getMapCameraPreset('aerial');

  assert.equal(bungalow.center.lat, CAFE_INFO.coords.lat);
  assert.equal(bungalow.center.lng, CAFE_INFO.coords.lng);
  assert.equal(bungalow.zoom, 18);
  assert.equal(bungalow.mapTypeId, 'roadmap');

  assert.equal(neighbourhood.zoom, 15);
  assert.equal(aerial.mapTypeId, 'hybrid');
  assert.ok(aerial.zoom > bungalow.zoom);
});

test('isQuotaErrorMessage detects Google Maps Platform quota errors without false positives', () => {
  assert.equal(isQuotaErrorMessage('Google Maps JavaScript API error: OverQuotaMapError'), true);
  assert.equal(isQuotaErrorMessage('RESOURCE_EXHAUSTED from Places API'), true);
  assert.equal(isQuotaErrorMessage('OVER_QUERY_LIMIT'), true);
  assert.equal(isQuotaErrorMessage('QuotaExceededError'), true);

  // Must not trigger on benign network or empty search states
  assert.equal(isQuotaErrorMessage('0 places found'), false);
  assert.equal(isQuotaErrorMessage('Network timeout'), false);
  assert.equal(isQuotaErrorMessage(''), false);
});

test('buildRealGoogleMapEmbedUrl builds valid live Google Maps embed URL with clamped zoom & map type', () => {
  const streetUrl = buildRealGoogleMapEmbedUrl(CAFE_INFO.coords, 18, 'roadmap');
  assert.ok(streetUrl.startsWith('https://maps.google.com/maps?'));
  assert.ok(streetUrl.includes('t=m'));
  assert.ok(streetUrl.includes('z=18'));
  assert.ok(streetUrl.includes('output=embed'));
  assert.ok(streetUrl.includes(String(CAFE_INFO.coords.lat)));

  const satUrl = buildRealGoogleMapEmbedUrl(CAFE_INFO.coords, 25, 'hybrid');
  assert.ok(satUrl.includes('t=k'));
  assert.ok(satUrl.includes('z=20'));
});

test('clampScrollProgress bounds values cleanly into [0, 1]', () => {
  assert.equal(clampScrollProgress(-0.5), 0);
  assert.equal(clampScrollProgress(0.42), 0.42);
  assert.equal(clampScrollProgress(1.8), 1);
  assert.equal(clampScrollProgress(Number.NaN), 0);
});

test('normalizeLiveGoogleReviews keeps only positive (4-5 star) reviews, sorts highest first, and drops empty entries', () => {
  const parsed = normalizeLiveGoogleReviews([
    {
      authorAttribution: { displayName: 'Negative Reviewer' },
      rating: 1,
      text: 'Bad experience.',
    },
    {
      authorAttribution: { displayName: 'Average Reviewer' },
      rating: 3,
      text: 'Okayish place.',
    },
    {
      authorAttribution: { displayName: 'Meera Patel' },
      rating: 4,
      originalText: { text: 'Warm lighting and fast vegetarian service.' },
      relativePublishTimeDescription: '3 weeks ago',
    },
    {
      authorAttribution: { displayName: 'Empty Text Guest' },
      rating: 5,
      text: '   ',
    },
    {
      authorAttribution: { displayName: 'Aarav Joshi', uri: 'https://maps.google.com/contrib/1' },
      rating: 5,
      text: '  Peaceful evening courtyard and great espresso.  ',
      relativePublishTimeDescription: '2 months ago',
      googleMapsURI: 'https://maps.google.com/reviews/1',
    },
  ]);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].authorName, 'Aarav Joshi');
  assert.equal(parsed[0].rating, 5);
  assert.equal(parsed[0].text, 'Peaceful evening courtyard and great espresso.');
  assert.equal(parsed[0].relativeTime, '2 months ago');
  assert.equal(parsed[0].googleMapsUri, 'https://maps.google.com/reviews/1');
  assert.equal(parsed[1].authorName, 'Meera Patel');
  assert.equal(parsed[1].rating, 4);
  assert.equal(parsed[1].text, 'Warm lighting and fast vegetarian service.');
  assert.deepEqual(normalizeLiveGoogleReviews(null), []);
});

test('Google review and pinned Maps links target Hopin Place ID directly', () => {
  assert.equal(
    HOPIN_GOOGLE_REVIEW_URL,
    `https://search.google.com/local/writereview?placeid=${CAFE_INFO.placeId}`
  );
  assert.equal(
    buildGoogleWriteReviewUrl('ChIJCustom123'),
    'https://search.google.com/local/writereview?placeid=ChIJCustom123'
  );
  const pinnedUrl = buildGooglePinnedPlaceUrl();
  assert.ok(pinnedUrl.startsWith('https://www.google.com/maps/search/?api=1&'));
  assert.ok(pinnedUrl.includes(`query_place_id=${CAFE_INFO.placeId}`));
  assert.ok(CAFE_INFO.directionsUrl.includes(`destination_place_id=${CAFE_INFO.placeId}`));
});

test('buildOrderAwareReviewDraft weaves ordered dishes naturally without repeating already-mentioned dishes', () => {
  const draft = HOPIN_GOOGLE_REVIEWS[0]; // mentions Vietnamese iced coffee
  const withOrder = buildOrderAwareReviewDraft(['Chilli Lotus Stem', 'Baked Risotto'], draft);
  assert.ok(withOrder.includes('Chilli Lotus Stem and Baked Risotto'));
  assert.ok(withOrder.endsWith(draft.text));

  // Should not duplicate Vietnamese iced coffee already mentioned in rev-01
  const alreadyMentioned = buildOrderAwareReviewDraft(['Vietnamese Iced Coffee'], draft);
  assert.equal(alreadyMentioned, draft.text);

  // Empty order list returns raw draft cleanly
  assert.equal(buildOrderAwareReviewDraft([], draft), draft.text);
});

test('STAR_MOOD_LABELS and getStarMood cover 1 through 5 stars and clamp out-of-range values', () => {
  for (let s = 1; s <= 5; s += 1) {
    assert.ok(STAR_MOOD_LABELS[s].mood.length > 0);
    assert.ok(STAR_MOOD_LABELS[s].prompt.length > 0);
  }
  assert.equal(getStarMood(0).mood, STAR_MOOD_LABELS[1].mood);
  assert.equal(getStarMood(9).mood, STAR_MOOD_LABELS[5].mood);
  assert.equal(getStarMood(Number.NaN).mood, STAR_MOOD_LABELS[5].mood);
});
