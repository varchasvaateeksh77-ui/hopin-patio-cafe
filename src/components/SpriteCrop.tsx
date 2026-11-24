import React, { useEffect, useRef, useState } from 'react';
import { SHEETS, type SheetId } from '../data/cafeData';
import { getResponsiveCropStyle } from '../utils/galleryMath';

interface SpriteCropProps {
  sheetId: SheetId;
  cellIndex: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders an exact inset crop from one of Hopin's 3x3 gouache artwork sheets
 * using pure resolution-independent CSS percentages so images never zoom in
 * excessively or distort on any screen size or CSS transform scale.
 */
export const SpriteCrop: React.FC<SpriteCropProps> = ({
  sheetId,
  cellIndex,
  alt,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<number>(0.74);
  const [failed, setFailed] = useState(false);

  const sheet = SHEETS[sheetId];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setAspect(rect.width / rect.height);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setFailed(false);
    const img = new Image();
    img.src = sheet.url;
    img.onerror = () => setFailed(true);
  }, [sheet.url]);

  const crop = getResponsiveCropStyle(sheet, cellIndex, aspect);

  if (failed) {
    return (
      <div
        ref={containerRef}
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#EFE4D4] text-[#26211E]/70 p-4 text-center font-serif-editorial italic text-sm ${className}`}
        style={style}
      >
        <span>{alt}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={alt}
      className={`bg-no-repeat bg-[#F3E9DB] ${className}`}
      style={{
        backgroundImage: `url("${sheet.url}")`,
        backgroundSize: crop.backgroundSize,
        backgroundPosition: crop.backgroundPosition,
        ...style,
      }}
    />
  );
};
