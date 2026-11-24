import React, { useEffect, useRef } from 'react';

interface CelestialDustCanvasProps {
  /** Number of warm golden motes drifting upward */
  count?: number;
  /** Optional tint hex/rgb string for the motes */
  color?: string;
  className?: string;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
  alpha: number;
}

export const CelestialDustCanvas: React.FC<CelestialDustCanvasProps> = ({
  count = 46,
  color = '246, 212, 148',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      motes = Array.from({ length: count }, (_, idx) => ({
        x: ((idx * 137.5) % 100) * 0.01 * width,
        y: ((idx * 73.1) % 100) * 0.01 * height,
        r: 0.9 + ((idx * 17) % 10) * 0.16,
        vy: 0.14 + ((idx * 23) % 10) * 0.032,
        vx: (((idx % 7) - 3) * 0.045),
        phase: idx * 0.9,
        alpha: 0.25 + ((idx * 11) % 10) * 0.055,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !rafId) {
          rafId = window.requestAnimationFrame(draw);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    let tick = 0;
    const draw = () => {
      rafId = 0;
      if (!visible) return;
      tick += 0.015;
      ctx.clearRect(0, 0, width, height);

      for (const m of motes) {
        m.y -= m.vy;
        m.x += m.vx + Math.sin(tick + m.phase) * 0.16;

        if (m.y < -12) {
          m.y = height + 12;
          m.x = (m.x + width * 0.37) % width;
        }
        if (m.x < -12) m.x = width + 12;
        if (m.x > width + 12) m.x = -12;

        const shimmer = 0.55 + 0.45 * Math.sin(tick * 2.1 + m.phase);
        const a = m.alpha * shimmer;

        const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.4);
        grad.addColorStop(0, `rgba(${color}, ${a.toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${color}, ${(a * 0.35).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [count, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
    />
  );
};
