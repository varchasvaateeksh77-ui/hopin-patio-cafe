import { CAFE_INFO } from '../data/cafeData';

export interface NaturalReviewDraft {
  id: string;
  vibeTag: string;
  text: string;
}

/**
 * 15 genuinely distinct, natural guest review drafts for Hopin — Patio Cafe (17/2 New Palasia, Indore).
 * Deliberately varied in length, phrasing, rhythm, and details so each guest gets a realistic,
 * human-sounding starting draft they can edit freely before posting on Google.
 */
export const HOPIN_GOOGLE_REVIEWS: NaturalReviewDraft[] = [
  {
    id: 'rev-01',
    vibeTag: 'Evening courtyard',
    text: 'Dropped in around sunset and ended up staying way longer than planned. The open-air patio with string lights feels super relaxed, and the Vietnamese iced coffee hit the spot.',
  },
  {
    id: 'rev-02',
    vibeTag: 'Food & vibe',
    text: 'Really liked how calm this place feels compared to most crowded cafes in New Palasia. Chilli Lotus Stem was crisp and flavorful, and the turquoise courtyard seating is lovely.',
  },
  {
    id: 'rev-03',
    vibeTag: 'Coffee & catch-up',
    text: 'Came here for a quick coffee catch-up with a friend and loved the whole bungalow setup. Good espresso, warm service, and you can actually hear each other talk.',
  },
  {
    id: 'rev-04',
    vibeTag: 'Vegetarian spread',
    text: 'One of the better all-veg menus in Indore right now. We tried the Lebanese Mezze Platter and a sizzler—fresh ingredients, generous portions, and nothing felt overly heavy.',
  },
  {
    id: 'rev-05',
    vibeTag: 'Desserts & tea',
    text: 'The chocolate fondue platter is worth saving room for. Cozy terracotta entrance, nice music at a sensible volume, and staff checked in without hovering.',
  },
  {
    id: 'rev-06',
    vibeTag: 'Jain-friendly',
    text: 'Super appreciative that they actually do thoughtful Jain options without compromising on taste. The baked risotto and sourdough toast came out piping hot and well seasoned.',
  },
  {
    id: 'rev-07',
    vibeTag: 'Weekend hangout',
    text: 'Great little heritage bungalow turned patio cafe. Loved sitting near the plants outside—iced yuzu coffee and loaded fries made for a really solid evening snack.',
  },
  {
    id: 'rev-08',
    vibeTag: 'Short & warm',
    text: 'Charming courtyard, quick service, and genuinely good vegetarian food. Easy spot to recommend in New Palasia.',
  },
  {
    id: 'rev-09',
    vibeTag: 'Indoor espresso bar',
    text: 'Tried the indoor lounge this time since it was warm outside and the teal espresso bar looks great. Biscoff latte wasn’t overly sweet, which was a nice surprise.',
  },
  {
    id: 'rev-10',
    vibeTag: 'Family dinner',
    text: 'Brought family here for dinner and everyone found something they liked on the menu—from Indian platters to Asian bowls. Pleasant outdoor lighting and clean, attentive service.',
  },
  {
    id: 'rev-11',
    vibeTag: 'Brunch & toasts',
    text: 'Mashed avocado on sourdough was fresh and properly toasted, not soggy at all. Paired it with a cold brew and spent a peaceful afternoon on the patio.',
  },
  {
    id: 'rev-12',
    vibeTag: 'Drinks & coolers',
    text: 'Their coolers and soda pops are refreshing without tasting artificial. Green Apple Khus Cooler + paneer starters on the outdoor benches is a great combo.',
  },
  {
    id: 'rev-13',
    vibeTag: 'First visit',
    text: 'First time at Hopin and definitely coming back. You walk through the terracotta gate and it instantly feels tucked away from the city rush. Pasta and shakes were both on point.',
  },
  {
    id: 'rev-14',
    vibeTag: 'Chill evening',
    text: 'Nice breeze on the upper veranda, fairy lights overhead, and comfort food done well. Service was polite and our order arrived faster than expected.',
  },
  {
    id: 'rev-15',
    vibeTag: 'Hidden gem',
    text: 'Really tasteful decor without trying too hard. The smoothie bowls and hot chocolate were delicious, and the overall patio atmosphere makes it easy to linger over conversations.',
  },
];

export const HOPIN_GOOGLE_REVIEW_URL = CAFE_INFO.writeReviewUrl;

/**
 * Builds the official Google "Write a Review" deep link that opens the star-and-text
 * review composer directly for Hopin - Patio Cafe on Android, iOS, and desktop.
 */
export function buildGoogleWriteReviewUrl(placeId?: string): string {
  const cleanId = (placeId || CAFE_INFO.placeId || '').trim();
  if (!cleanId) return CAFE_INFO.writeReviewUrl;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(cleanId)}`;
}

/**
 * Builds an official Google Maps Place ID URL that opens Hopin - Patio Cafe pinned & selected.
 */
export function buildGooglePinnedPlaceUrl(placeId?: string): string {
  const cleanId = (placeId || CAFE_INFO.placeId || '').trim();
  if (!cleanId) return CAFE_INFO.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    'Hopin - Patio Cafe, New Palasia, Indore'
  )}&query_place_id=${encodeURIComponent(cleanId)}`;
}

export interface LiveGoogleReview {
  id: string;
  authorName: string;
  authorUri?: string;
  rating: number;
  text: string;
  relativeTime?: string;
  googleMapsUri?: string;
}

export interface StarMoodInfo {
  mood: string;
  prompt: string;
}

export const STAR_MOOD_LABELS: Record<number, StarMoodInfo> = {
  1: {
    mood: 'Missed the mark',
    prompt: 'Tell us what felt off so our patio team can make it right.',
  },
  2: {
    mood: 'Could be warmer',
    prompt: 'Honest feedback helps our kitchen and courtyard crew improve.',
  },
  3: {
    mood: 'Good patio stop',
    prompt: 'Note what stood out and what would make your next visit better.',
  },
  4: {
    mood: 'Really lovely evening',
    prompt: 'Share what you liked most—and any plate worth recommending.',
  },
  5: {
    mood: 'Courtyard magic',
    prompt: 'Tweak this natural draft in your own words before posting.',
  },
};

export function getStarMood(rating: number): StarMoodInfo {
  const clamped = Math.max(1, Math.min(5, Math.round(Number.isFinite(rating) ? rating : 5)));
  return STAR_MOOD_LABELS[clamped] || STAR_MOOD_LABELS[5];
}

const ORDER_WEAVE_TEMPLATES = [
  (dishPhrase: string) => `Just ordered the ${dishPhrase}—really hit the spot.`,
  (dishPhrase: string) => `Tried the ${dishPhrase} today and everything came out fresh.`,
  (dishPhrase: string) => `We went with the ${dishPhrase} and would easily order it again.`,
  (dishPhrase: string) => `Our table picked the ${dishPhrase}, both balanced and freshly made.`,
  (dishPhrase: string) => `Loved the ${dishPhrase} from this visit.`,
];

/**
 * Naturally weaves 1–2 of the guest's actually ordered dish names into a review draft
 * without duplicating a dish already mentioned in `baseDraft.text`.
 */
export function buildOrderAwareReviewDraft(
  orderedDishTitles: string[],
  baseDraft: NaturalReviewDraft
): string {
  const cleanTitles: string[] = [];
  const seen = new Set<string>();

  for (const raw of orderedDishTitles) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleanTitles.push(trimmed);
    if (cleanTitles.length >= 2) break;
  }

  if (cleanTitles.length === 0) {
    return baseDraft.text;
  }

  const lowerBase = baseDraft.text.toLowerCase();
  const unmentioned = cleanTitles.filter((title) => !lowerBase.includes(title.toLowerCase()));
  if (unmentioned.length === 0) {
    return baseDraft.text;
  }

  const dishPhrase =
    unmentioned.length === 1 ? unmentioned[0] : `${unmentioned[0]} and ${unmentioned[1]}`;

  // Deterministic template index from draft id so each draft pairs naturally
  let hash = 0;
  for (let i = 0; i < baseDraft.id.length; i += 1) {
    hash = (hash * 31 + baseDraft.id.charCodeAt(i)) >>> 0;
  }
  const templateIdx =
    unmentioned.length === 1 && hash % ORDER_WEAVE_TEMPLATES.length === 3
      ? 0
      : hash % ORDER_WEAVE_TEMPLATES.length;

  const orderSentence = ORDER_WEAVE_TEMPLATES[templateIdx](dishPhrase);
  return `${orderSentence} ${baseDraft.text}`;
}

/**
 * Normalizes real Google Places API (New) Review instances into clean render-ready records.
 * Keeps only positive reviews (`rating >= minRating`, default 4 stars) sorted highest-first.
 * Never fabricates text or reviewers; empty reviews are filtered out cleanly.
 */
export function normalizeLiveGoogleReviews(
  rawReviews: unknown,
  minRating = 4
): LiveGoogleReview[] {
  if (!Array.isArray(rawReviews)) return [];

  const normalized: LiveGoogleReview[] = [];

  for (let i = 0; i < rawReviews.length; i += 1) {
    const item = rawReviews[i] as Record<string, unknown> | null | undefined;
    if (!item || typeof item !== 'object') continue;

    const rawRating =
      typeof item.rating === 'number' && Number.isFinite(item.rating) ? item.rating : null;
    if (rawRating === null || rawRating < minRating) continue;
    const rating = Math.max(1, Math.min(5, rawRating));

    // Places JS SDK exposes `review.text` as string (or localized object `{ text: string }`)
    let rawText = '';
    if (typeof item.text === 'string') {
      rawText = item.text;
    } else if (
      item.text &&
      typeof item.text === 'object' &&
      typeof (item.text as { text?: unknown }).text === 'string'
    ) {
      rawText = (item.text as { text: string }).text;
    } else if (
      item.originalText &&
      typeof item.originalText === 'object' &&
      typeof (item.originalText as { text?: unknown }).text === 'string'
    ) {
      rawText = (item.originalText as { text: string }).text;
    }

    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;

    const attr = (item.authorAttribution ?? {}) as {
      displayName?: unknown;
      uri?: unknown;
    };
    const authorName =
      typeof attr.displayName === 'string' && attr.displayName.trim().length > 0
        ? attr.displayName.trim()
        : 'Google Maps Guest';
    const authorUri =
      typeof attr.uri === 'string' && attr.uri.startsWith('http') ? attr.uri : undefined;

    const relativeTime =
      typeof item.relativePublishTimeDescription === 'string' &&
      item.relativePublishTimeDescription.trim().length > 0
        ? item.relativePublishTimeDescription.trim()
        : undefined;

    const googleMapsUri =
      typeof item.googleMapsURI === 'string' && item.googleMapsURI.startsWith('http')
        ? item.googleMapsURI
        : undefined;

    normalized.push({
      id: `gmaps-rev-${i}-${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      authorName,
      authorUri,
      rating,
      text: cleanText,
      relativeTime,
      googleMapsUri,
    });
  }

  return normalized.sort((a, b) => b.rating - a.rating).slice(0, 5);
}

/**
 * Picks a natural review draft at random while guaranteeing it never repeats `excludeIndex`.
 */
export function pickRandomGoogleReview(
  excludeIndex?: number,
  rng: () => number = Math.random
): { index: number; draft: NaturalReviewDraft } {
  const total = HOPIN_GOOGLE_REVIEWS.length;
  if (total === 0) {
    return {
      index: 0,
      draft: {
        id: 'rev-fallback',
        vibeTag: 'Patio visit',
        text: 'Lovely courtyard vibe in New Palasia with great coffee and freshly made vegetarian food.',
      },
    };
  }

  const hasValidExclude =
    typeof excludeIndex === 'number' && excludeIndex >= 0 && excludeIndex < total && total > 1;

  const poolSize = hasValidExclude ? total - 1 : total;
  const r = Math.max(0, Math.min(0.999999, rng()));
  let idx = Math.floor(r * poolSize);

  if (hasValidExclude && idx >= excludeIndex) {
    idx += 1;
  }

  return { index: idx, draft: HOPIN_GOOGLE_REVIEWS[idx] };
}
