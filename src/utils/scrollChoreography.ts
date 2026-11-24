import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CAFE_INFO } from '../data/cafeData';

let gsapRegistered = false;

export function ensureGsapRegistered(): void {
  if (!gsapRegistered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    gsapRegistered = true;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface MapCameraPreset {
  id: 'bungalow' | 'neighbourhood' | 'aerial';
  label: string;
  caption: string;
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeId: 'roadmap' | 'hybrid';
}

export const MAP_CAMERA_PRESETS: readonly MapCameraPreset[] = [
  {
    id: 'bungalow',
    label: '17/2 Bungalow',
    caption: 'Street-level arrival pin at 17/2 New Palasia',
    center: { lat: CAFE_INFO.coords.lat, lng: CAFE_INFO.coords.lng },
    zoom: 18,
    mapTypeId: 'roadmap',
  },
  {
    id: 'neighbourhood',
    label: 'New Palasia',
    caption: 'Approaching routes across central Indore',
    center: { lat: CAFE_INFO.coords.lat, lng: CAFE_INFO.coords.lng },
    zoom: 15,
    mapTypeId: 'roadmap',
  },
  {
    id: 'aerial',
    label: 'Satellite',
    caption: 'Overhead courtyard & surrounding tree canopy',
    center: { lat: CAFE_INFO.coords.lat, lng: CAFE_INFO.coords.lng },
    zoom: 19,
    mapTypeId: 'hybrid',
  },
];

export function getMapCameraPreset(id: MapCameraPreset['id']): MapCameraPreset {
  return MAP_CAMERA_PRESETS.find((p) => p.id === id) ?? MAP_CAMERA_PRESETS[0];
}

export function isQuotaErrorMessage(message: string): boolean {
  if (!message) return false;
  return (
    message.includes('OverQuotaMapError') ||
    message.includes('QuotaExceededError') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('OVER_QUERY_LIMIT')
  );
}

export function buildRealGoogleMapEmbedUrl(
  coords: { lat: number; lng: number },
  zoom: number,
  mapTypeId: 'roadmap' | 'hybrid'
): string {
  const clampedZoom = Math.max(12, Math.min(20, Math.round(zoom)));
  const tParam = mapTypeId === 'hybrid' ? 'k' : 'm';
  const query = encodeURIComponent(
    `Hopin - Patio Cafe, 17/2 New Palasia, Indore (${coords.lat},${coords.lng})`
  );
  return `https://maps.google.com/maps?q=${query}&ll=${coords.lat},${coords.lng}&t=${tParam}&z=${clampedZoom}&ie=UTF8&iwloc=B&output=embed`;
}

export function clampScrollProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}
