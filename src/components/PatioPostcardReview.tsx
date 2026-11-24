import React, { useEffect, useRef } from 'react';
import { Check, Copy, ExternalLink, Shuffle, Star } from 'lucide-react';
import { getStarMood, HOPIN_GOOGLE_REVIEW_URL } from '../utils/googleReviews';

export interface PatioPostcardReviewProps {
  eyebrow?: string;
  headline?: string;
  rating: number;
  onRatingChange: (n: number) => void;
  reviewText: string;
  onReviewTextChange: (val: string) => void;
  vibeTag: string;
  copied: boolean;
  onShuffle: () => void;
  onCopy: () => void;
  mapsUrl?: string;
  /** Optional list of just-ordered dishes so guests can toggle mentioning their order */
  orderedDishTitles?: string[];
  includeOrderDishes?: boolean;
  onToggleIncludeOrderDishes?: () => void;
  compact?: boolean;
  /** When joined beneath a perforated ticket seam, omits outer border to prevent double lines */
  attached?: boolean;
  testId?: string;
  textareaId?: string;
}

export const PatioPostcardReview: React.FC<PatioPostcardReviewProps> = ({
  eyebrow = 'While the Kitchen Fires',
  headline = 'Send a postcard from your table',
  rating,
  onRatingChange,
  reviewText,
  onReviewTextChange,
  vibeTag,
  copied,
  onShuffle,
  onCopy,
  mapsUrl = HOPIN_GOOGLE_REVIEW_URL,
  orderedDishTitles = [],
  includeOrderDishes = false,
  onToggleIncludeOrderDishes,
  compact = false,
  attached = false,
  testId = 'patio-postcard-review',
  textareaId = 'hopin-patio-postcard-input',
}) => {
  const moodInfo = getStarMood(rating);
  const hasOrderedDishes = orderedDishTitles.length > 0 && Boolean(onToggleIncludeOrderDishes);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Keep line 1 visible whenever a new draft is shuffled or dish-mention is toggled
  useEffect(() => {
    const el = textareaRef.current;
    if (el && document.activeElement !== el) {
      el.scrollTop = 0;
    }
  }, [reviewText, vibeTag, includeOrderDishes]);

  return (
    <div
      data-testid={testId}
      className={`relative bg-[#FBF6EE] text-left overflow-hidden ${
        attached ? 'rounded-b-[15px]' : 'rounded-[16px] border border-[#D7C6B4]'
      } ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
    >
      {/* Delicate postcard inner stationery border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] rounded-[11px] border border-[#E7DAC9]"
      />

      <div className="relative z-10">
        {/* Postcard Top Strip: Title + Architectural Terracotta Postal Stamp */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bunto text-[9.5px] font-medium uppercase tracking-[0.22em] text-[#B84C2E]">
              {eyebrow}
            </p>
            <h4 className="font-serif-editorial italic font-normal text-[19px] sm:text-[21px] leading-[1.2] text-[#262324] mt-0.5">
              {headline}
            </h4>
          </div>

          {/* Tactile Terracotta Postmark Stamp */}
          <div
            aria-hidden="true"
            className="shrink-0 -rotate-3 px-2.5 py-1.5 rounded-[8px] border border-dashed border-[#B84C2E]/65 bg-[#F6ECE1] text-center select-none"
          >
            <p className="font-bunto text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[#B84C2E] leading-none">
              HOPIN°
            </p>
            <p className="font-bunto text-[7.5px] uppercase tracking-[0.16em] text-[#7D4B3B] mt-1 leading-none">
              17/2 · INDORE
            </p>
          </div>
        </div>

        {/* Interactive 5-Star Mood Selector + Vibe Tag */}
        <div className="mt-3.5 pt-3 border-t border-[#E6D9C7] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-0.5"
              role="radiogroup"
              aria-label="Google star rating"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    onClick={() => onRatingChange(star)}
                    className="p-0.5 transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B84C2E] rounded"
                  >
                    <Star
                      className={`w-[17px] h-[17px] transition-colors ${
                        filled ? 'text-[#C88435] fill-[#C88435]' : 'text-[#CFC3B5]'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
            <span
              data-testid={`${testId}-mood`}
              className="font-serif-editorial italic text-[13px] text-[#B84C2E]"
            >
              {moodInfo.mood}
            </span>
          </div>

          <span className="font-bunto text-[10px] uppercase tracking-[0.16em] text-[#787174]">
            {vibeTag}
          </span>
        </div>

        {/* Optional Dish-Aware Weave Toggle + Shuffle Draft Action */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {hasOrderedDishes ? (
            <button
              type="button"
              data-testid={`${testId}-mention-dishes`}
              aria-pressed={includeOrderDishes}
              onClick={onToggleIncludeOrderDishes}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bunto text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
                includeOrderDishes
                  ? 'bg-[#201D1E] border-[#201D1E] text-[#F9F2E9]'
                  : 'bg-[#F5ECE0] border-[#D7C6B4] text-[#4A4547] hover:border-[#201D1E]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  includeOrderDishes ? 'bg-[#E39A67]' : 'bg-[#A69B92]'
                }`}
              />
              {includeOrderDishes ? 'Mentioning my order' : 'Mention my order'}
            </button>
          ) : (
            <span className="font-bunto text-[10.5px] text-[#787174]">
              Editable courtyard note
            </span>
          )}

          <button
            type="button"
            data-testid="google-review-shuffle"
            onClick={onShuffle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#D7C6B4] bg-[#F5ECE0] hover:border-[#201D1E] font-bunto text-[10px] font-medium uppercase tracking-[0.14em] text-[#262324] transition-colors shrink-0"
            title="Load a different natural review draft"
          >
            <Shuffle className="w-3 h-3" aria-hidden="true" />
            New Note
          </button>
        </div>

        {/* Lined Stationery Editable Textarea */}
        <label htmlFor={textareaId} className="sr-only">
          Editable Google review text
        </label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          data-testid="google-review-textarea"
          rows={compact ? 6 : 5}
          value={reviewText}
          onChange={(e) => onReviewTextChange(e.target.value)}
          placeholder="Write or tweak your Hopin patio note…"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent, transparent 25px, rgba(215, 198, 180, 0.45) 25px, rgba(215, 198, 180, 0.45) 26px)',
            backgroundPosition: '0 8px',
            backgroundAttachment: 'local',
          }}
          className="mt-2.5 w-full rounded-[12px] px-3.5 py-2 bg-[#F6EFE4] border border-[#DFD0C0] focus:border-[#262324] focus:outline-none font-bunto text-[13px] leading-[26px] text-[#2A2628] resize-none"
        />

        <p className="mt-1.5 font-bunto text-[11px] leading-[1.45] text-[#716D71]">
          {moodInfo.prompt}
        </p>

        {/* Responsive Mobile-Safe Action Row (never uses window.open) */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="google-review-open-link"
            onClick={onCopy}
            title="Copies your edited note and opens Hopin on Google Maps"
            className="min-w-0 flex-1 h-[40px] px-3 rounded-full bg-[#201D1E] hover:bg-[#B84C2E] text-[#F9F2E9] font-bunto text-[10px] sm:text-[10.5px] font-medium uppercase tracking-[0.11em] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <span>{copied ? 'Copied · Open Google' : 'Copy & Post on Google'}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>

          <button
            type="button"
            data-testid="google-review-copy-btn"
            onClick={onCopy}
            className="h-[40px] px-3 rounded-full border border-[#D7C6B4] bg-[#F6EFE4] hover:border-[#201D1E] text-[#262324] font-bunto text-[10px] sm:text-[10.5px] font-medium uppercase tracking-[0.11em] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#3F6B5D]" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
