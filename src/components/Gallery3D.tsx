import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import {
  DISHES,
  getDishesByRoom,
  getRoomById,
  SHEETS,
  SUBCATEGORY_ROOMS,
  type DishItem,
  type FloorPattern,
  type SheetId,
  type SubcategoryRoom,
} from '../data/cafeData';
import {
  formatINR,
  GALLERY_CONSTANTS,
  getFocusPose,
  getWalkOffsetD,
  getWalkPose,
  getWebGLCropUV,
  interpolateGlidePose,
  stepSlotAngle,
  type CameraPose,
} from '../utils/galleryMath';
import type { FlyerOriginRect } from './DishModal';

export type GalleryMode = 'hallway' | 'room';

interface Gallery3DProps {
  mode: GalleryMode;
  activeRoomId: string;
  isOverlayOpen: boolean;
  onEnterRoom: (roomId: string) => void;
  onBackToHallway: () => void;
  onOpenDish: (dish: DishItem, originRect: FlyerOriginRect | null) => void;
  onOpenList: () => void;
  onGoGateways: () => void;
}

interface GalleryItemDescriptor {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  sheetId: SheetId;
  cellIndex: number;
  room?: SubcategoryRoom;
  dish?: DishItem;
}

interface FrameRecord {
  group: THREE.Group;
  artMesh: THREE.Mesh;
  frameMesh: THREE.Mesh;
  labelMesh: THREE.Mesh;
  wall: 'outer' | 'inner';
  angle: number;
  slotIndex: number;
  itemIndex: number;
}

const SMALL_SCREEN_QUERY =
  '(max-width: 819px), (orientation: portrait) and (max-width: 1100px), (orientation: landscape) and (max-height: 500px)';

const HALLWAY_THEME = {
  isDarkRoom: false,
  wallColor: '#FBF6EE',
  wallStops: ['#F1E4D1', '#FBF6EE', '#F6EDE0', '#E8D5BC'] as [string, string, string, string],
  floorStops: ['#E6CEAE', '#F1E1C7', '#E8D2B3'] as [string, string, string],
  ceilingColor: '#F7EDE0',
  frameColor: '#9E6E47',
  haloColors: ['rgba(255, 252, 246, 0.92)', 'rgba(255, 252, 246, 0)'] as [string, string],
  floorPattern: 'travertine' as FloorPattern,
  plaqueInk: '#26211E',
  plaqueSubInk: 'rgba(38, 33, 30, 0.78)',
  plaqueAccent: '#B85A3A',
};

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Architectural curved wall texture with vertical plaster tonal falloff,
 * crown cornice band, subtle dado rail, skirting baseboard, and organic plaster texture.
 */
function createArchitecturalWallTexture(
  stops: [string, string, string, string],
  isDark: boolean
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.22, stops[1]);
  grad.addColorStop(0.76, stops[2]);
  grad.addColorStop(1, stops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);

  // Subtle vertical limewash plaster texture strokes
  for (let i = 0; i < 14; i++) {
    const x = (i * 19 + 7) % 64;
    ctx.fillStyle = isDark
      ? i % 2 === 0
        ? 'rgba(255, 232, 200, 0.03)'
        : 'rgba(0, 0, 0, 0.05)'
      : i % 2 === 0
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(70, 48, 30, 0.025)';
    ctx.fillRect(x, 0, 4, 512);
  }

  // Upper cornice molding band
  ctx.fillStyle = isDark ? 'rgba(255, 226, 188, 0.14)' : 'rgba(38, 30, 24, 0.09)';
  ctx.fillRect(0, 22, 64, 3);
  ctx.fillRect(0, 30, 64, 1.5);

  // Subtle dado rail below portraits
  ctx.fillStyle = isDark ? 'rgba(255, 226, 188, 0.11)' : 'rgba(38, 30, 24, 0.07)';
  ctx.fillRect(0, 424, 64, 2);

  // Floor skirting baseboard
  ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(42, 30, 20, 0.12)';
  ctx.fillRect(0, 486, 64, 26);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(22, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Architectural radial floor texture tailored to each room's physical flooring material.
 */
function createArchitecturalFloorTexture(
  stops: [string, string, string],
  pattern: FloorPattern
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const rInner = 256 * (GALLERY_CONSTANTS.R_INNER / GALLERY_CONSTANTS.R_OUTER);

  const grad = ctx.createRadialGradient(256, 256, rInner, 256, 256, 256);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.55, stops[1]);
  grad.addColorStop(1, stops[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Concentric architectural inlay rings along the curved passage
  ctx.save();
  ctx.translate(256, 256);

  const isDarkPattern =
    pattern === 'walnut' ||
    pattern === 'walnut-herringbone' ||
    pattern === 'hearth' ||
    pattern === 'dark-slate' ||
    pattern === 'teal-tile';

  const ringCount =
    pattern === 'walnut' || pattern === 'walnut-herringbone'
      ? 9
      : pattern === 'teal-tile'
      ? 8
      : pattern === 'hearth' || pattern === 'dark-slate'
      ? 5
      : 6;
  for (let i = 1; i < ringCount; i++) {
    const r = rInner + ((256 - rInner) * i) / ringCount;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDarkPattern
      ? 'rgba(247, 232, 200, 0.1)'
      : 'rgba(38, 30, 24, 0.065)';
    ctx.lineWidth =
      pattern === 'marble' || pattern === 'blush-marble' || pattern === 'teal-tile' ? 1.5 : 1;
    ctx.stroke();
  }

  // Radial masonry / timber / geometric bar tile joints
  const spokes =
    pattern === 'walnut' || pattern === 'walnut-herringbone'
      ? 48
      : pattern === 'teal-tile'
      ? 40
      : pattern === 'conservatory' || pattern === 'sage-slate'
      ? 36
      : 24;
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rInner, Math.sin(a) * rInner);
    ctx.lineTo(Math.cos(a) * 256, Math.sin(a) * 256);
    ctx.strokeStyle =
      pattern === 'teal-tile'
        ? 'rgba(247, 232, 200, 0.08)'
        : isDarkPattern
        ? 'rgba(0, 0, 0, 0.14)'
        : 'rgba(38, 30, 24, 0.045)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Terrazzo / marble mineral flecks
  if (
    pattern === 'terrazzo' ||
    pattern === 'marble' ||
    pattern === 'blush-marble' ||
    pattern === 'conservatory' ||
    pattern === 'sage-slate'
  ) {
    for (let i = 0; i < 160; i++) {
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = rInner + ((i * 37) % Math.floor(256 - rInner));
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(255, 252, 245, 0.24)' : 'rgba(60, 42, 28, 0.08)';
      ctx.fillRect(Math.cos(ang) * rad, Math.sin(ang) * rad, 2.5, 2.5);
    }
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHaloTexture(colors: readonly string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  if (colors.length >= 3) {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.45, colors[1]);
    grad.addColorStop(1, colors[2]);
  } else {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.36, colors[0]);
    grad.addColorStop(1, colors[1] ?? 'rgba(0,0,0,0)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(30, 18, 12, 0.34)');
  grad.addColorStop(0.28, 'rgba(30, 18, 12, 0.28)');
  grad.addColorStop(1, 'rgba(30, 18, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawWallPlaqueCanvas(
  title: string,
  subtitle: string,
  meta: string,
  ink: string,
  subInk: string,
  accent: string
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 260;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 640, 260);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = ink;
  ctx.font = '500 46px "Fraunces", Georgia, serif';
  const trimmedTitle = title.length > 26 ? `${title.slice(0, 25)}…` : title;
  ctx.fillText(trimmedTitle, 24, 78);

  ctx.fillStyle = subInk;
  ctx.font = 'italic 400 37px "Fraunces", Georgia, serif';
  const trimmedSub = subtitle.length > 34 ? `${subtitle.slice(0, 33)}…` : subtitle;
  ctx.fillText(trimmedSub, 24, 144);

  ctx.fillStyle = accent;
  ctx.font = '500 28px "DM Mono", ui-monospace, monospace';
  ctx.fillText(meta.toUpperCase(), 24, 210);

  return c;
}

function buildItemsForMode(mode: GalleryMode, roomId: string): GalleryItemDescriptor[] {
  if (mode === 'hallway') {
    return SUBCATEGORY_ROOMS.map((room) => {
      const count = getDishesByRoom(room.id).length;
      return {
        id: room.id,
        title: room.title,
        subtitle: room.gatewayName,
        meta: `${room.number} · ${count} DISHES · ENTER`,
        sheetId: room.sheetId,
        cellIndex: room.cellIndex,
        room,
      };
    });
  }

  const dishes = getDishesByRoom(roomId);
  return dishes.map((dish) => ({
    id: dish.id,
    title: dish.title,
    subtitle: dish.chefNote,
    meta: `${formatINR(dish.price)} · ${dish.dietary} · ORDER`,
    sheetId: dish.sheetId,
    cellIndex: dish.cellIndex,
    dish,
  }));
}

export const Gallery3D: React.FC<Gallery3DProps> = ({
  mode,
  activeRoomId,
  isOverlayOpen,
  onEnterRoom,
  onBackToHallway,
  onOpenDish,
  onOpenList,
  onGoGateways,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const activeRoomPillRef = useRef<HTMLButtonElement | null>(null);

  const [focusedItem, setFocusedItem] = useState<GalleryItemDescriptor | null>(null);
  const [veilVisible, setVeilVisible] = useState(true);
  const [pillVisible, setPillVisible] = useState(false);
  const [cursorMode, setCursorMode] = useState<'grab' | 'grabbing' | 'pointer'>('grab');
  const [webglError, setWebglError] = useState(false);

  const activeRoom = getRoomById(activeRoomId);
  const isDarkRoom = mode === 'room' && activeRoom.isDarkRoom;
  const activeVeilColor = mode === 'room' ? activeRoom.wallColor : HALLWAY_THEME.wallColor;

  // Keep the active room pill centered inside the scrollable mobile switcher
  useEffect(() => {
    if (mode === 'room' && activeRoomPillRef.current) {
      activeRoomPillRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [mode, activeRoomId]);

  // Store latest props/callbacks in refs so WebGLRenderer mounts ONCE and never tears down
  const callbacksRef = useRef({
    onEnterRoom,
    onOpenDish,
    isOverlayOpen,
    mode,
    activeRoomId,
  });
  callbacksRef.current = {
    onEnterRoom,
    onOpenDish,
    isOverlayOpen,
    mode,
    activeRoomId,
  };

  // Expose imperative step/focus controls to DOM buttons
  const engineApiRef = useRef<{
    step: (dir: 1 | -1) => void;
    stepBack: () => void;
    activateFocused: () => void;
    focusById: (id: string) => void;
    syncModeAndRoom: (nextMode: GalleryMode, nextRoomId: string) => void;
  } | null>(null);

  const currentItems = buildItemsForMode(mode, activeRoomId);

  // Mount Three.js scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isPortraitSmall = () =>
      window.matchMedia(SMALL_SCREEN_QUERY).matches && window.innerHeight > window.innerWidth;
    const supportsHoverCursor = () =>
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      setVeilVisible(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(HALLWAY_THEME.wallColor);
    scene.fog = new THREE.Fog(HALLWAY_THEME.wallColor, 10, 44);

    const camera = new THREE.PerspectiveCamera(
      window.innerWidth >= window.innerHeight ? 56 : 70,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );

    scene.add(new THREE.HemisphereLight(0xfffdf6, 0xe8d0b2, 1.4));
    scene.add(new THREE.AmbientLight(0xfff6e6, 0.5));

    // Architecture: Outer curved wall, Inner central pillar, Floor, Ceiling
    const outerWallMat = new THREE.MeshBasicMaterial({
      map: createArchitecturalWallTexture(HALLWAY_THEME.wallStops, false),
      side: THREE.BackSide,
    });
    const outerWall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        GALLERY_CONSTANTS.R_OUTER,
        GALLERY_CONSTANTS.R_OUTER,
        GALLERY_CONSTANTS.WALL_H,
        144,
        1,
        true
      ),
      outerWallMat
    );
    outerWall.position.y = GALLERY_CONSTANTS.WALL_H / 2;
    scene.add(outerWall);

    const innerWallMat = new THREE.MeshBasicMaterial({
      map: createArchitecturalWallTexture(HALLWAY_THEME.wallStops, false),
      side: THREE.FrontSide,
    });
    const innerWall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        GALLERY_CONSTANTS.R_INNER,
        GALLERY_CONSTANTS.R_INNER,
        GALLERY_CONSTANTS.WALL_H,
        112,
        1,
        true
      ),
      innerWallMat
    );
    innerWall.position.y = GALLERY_CONSTANTS.WALL_H / 2;
    scene.add(innerWall);

    const floorMat = new THREE.MeshBasicMaterial({
      map: createArchitecturalFloorTexture(HALLWAY_THEME.floorStops, 'travertine'),
    });
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(GALLERY_CONSTANTS.R_OUTER, 144),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ceilingMat = new THREE.MeshBasicMaterial({
      color: HALLWAY_THEME.ceilingColor,
      side: THREE.BackSide,
    });
    const ceiling = new THREE.Mesh(
      new THREE.CircleGeometry(GALLERY_CONSTANTS.R_OUTER, 144),
      ceilingMat
    );
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.y = GALLERY_CONSTANTS.WALL_H;
    scene.add(ceiling);

    // Shared geometries & dynamic spotlight halo / shadow textures
    let haloTex = createHaloTexture(HALLWAY_THEME.haloColors);
    const shadowTex = createShadowTexture();
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const frameSharedMat = new THREE.MeshBasicMaterial({ color: HALLWAY_THEME.frameColor });

    const { PW, PH, PY, OUTER_SLOTS, INNER_SLOTS, R_OUTER, R_INNER } = GALLERY_CONSTANTS;
    const haloGeo = new THREE.PlaneGeometry(2.2 * PW, 1.82 * PH);
    const shadowGeo = new THREE.PlaneGeometry(1.26 * PW, 1.18 * PH);
    const frameGeo = new THREE.BoxGeometry(PW + 0.08, PH + 0.08, 0.06);
    const artGeo = new THREE.PlaneGeometry(PW, PH);
    const labelGeo = new THREE.PlaneGeometry(1.08, 1.08 * (260 / 640));

    // Preload all 3 gouache sprite sheets once
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const loader = new THREE.TextureLoader();
    const baseTextures: Partial<Record<SheetId, THREE.Texture>> = {};
    const croppedTextureCache = new Map<string, THREE.Texture>();
    const plaqueTextureCache = new Map<string, THREE.CanvasTexture>();

    const getCroppedTexture = (sheetId: SheetId, cellIndex: number): THREE.Texture | null => {
      const base = baseTextures[sheetId];
      if (!base) return null;
      const cacheKey = `${sheetId}:${cellIndex}`;
      const existing = croppedTextureCache.get(cacheKey);
      if (existing) return existing;

      const clone = base.clone();
      const uv = getWebGLCropUV(SHEETS[sheetId], cellIndex);
      clone.repeat.set(uv.repeatX, uv.repeatY);
      clone.offset.set(uv.offsetX, uv.offsetY);
      clone.colorSpace = THREE.SRGBColorSpace;
      clone.anisotropy = isSoftwareGl ? 1 : maxAniso;
      clone.needsUpdate = true;
      croppedTextureCache.set(cacheKey, clone);
      return clone;
    };

    const getPlaqueTexture = (
      item: GalleryItemDescriptor,
      ink: string,
      subInk: string,
      accent: string
    ): THREE.CanvasTexture => {
      const key = `${item.id}|${item.meta}|${ink}|${accent}`;
      const existing = plaqueTextureCache.get(key);
      if (existing) return existing;
      const canvas = drawWallPlaqueCanvas(
        item.title,
        item.subtitle,
        item.meta,
        ink,
        subInk,
        accent
      );
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = isSoftwareGl ? 1 : maxAniso;
      plaqueTextureCache.set(key, tex);
      return tex;
    };

    // Build 36 outer + 24 inner frame groups
    const frames: FrameRecord[] = [];
    // Include art, frame, AND plaque as clickable hit targets so taps never miss!
    const interactiveMeshes: THREE.Mesh[] = [];

    const createFrameGroup = (wall: 'outer' | 'inner', angle: number, slotIndex: number) => {
      const group = new THREE.Group();
      if (wall === 'outer') {
        const r = R_OUTER - 0.02;
        group.position.set(r * Math.cos(angle), 0, r * Math.sin(angle));
        group.lookAt(0, 0, 0);
      } else {
        const r = R_INNER + 0.02;
        group.position.set(r * Math.cos(angle), 0, r * Math.sin(angle));
        group.lookAt(r * 2 * Math.cos(angle), 0, r * 2 * Math.sin(angle));
      }

      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(0, PY + 0.05, 0.005);
      group.add(halo);

      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.position.set(0.05, PY - 0.06, 0.01);
      group.add(shadow);

      const frameMesh = new THREE.Mesh(frameGeo, frameSharedMat);
      frameMesh.position.set(0, PY, 0.045);
      group.add(frameMesh);

      const artMat = new THREE.MeshBasicMaterial({ color: '#EFE3D1' });
      const artMesh = new THREE.Mesh(artGeo, artMat);
      artMesh.position.set(0, PY, 0.078);
      group.add(artMesh);

      const labelMat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        fog: true,
      });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(-PW / 2 + 0.54, PY - PH / 2 - 0.42, 0.022);
      group.add(labelMesh);

      scene.add(group);

      const rec: FrameRecord = {
        group,
        artMesh,
        frameMesh,
        labelMesh,
        wall,
        angle,
        slotIndex,
        itemIndex: 0,
      };
      artMesh.userData.frameRecord = rec;
      frameMesh.userData.frameRecord = rec;
      labelMesh.userData.frameRecord = rec;

      frames.push(rec);
      interactiveMeshes.push(artMesh, frameMesh, labelMesh);
    };

    for (let s = 0; s < OUTER_SLOTS; s++) {
      createFrameGroup('outer', (s * Math.PI * 2) / OUTER_SLOTS, s);
    }
    for (let k = 0; k < INNER_SLOTS; k++) {
      createFrameGroup('inner', ((k + 0.5) * Math.PI * 2) / INNER_SLOTS, k);
    }

    // Active catalog items for current mode/room
    let activeItems: GalleryItemDescriptor[] = buildItemsForMode(
      callbacksRef.current.mode,
      callbacksRef.current.activeRoomId
    );

    const refreshFrameContent = (nextMode: GalleryMode, nextRoomId: string) => {
      activeItems = buildItemsForMode(nextMode, nextRoomId);
      const count = Math.max(1, activeItems.length);

      const theme = nextMode === 'room' ? getRoomById(nextRoomId) : HALLWAY_THEME;

      // Apply full architectural theme (walls, floor finish, ceiling, fog, spotlight halo, frames)
      scene.background = new THREE.Color(theme.wallColor);
      (scene.fog as THREE.Fog).color.set(theme.wallColor);

      outerWallMat.map?.dispose();
      outerWallMat.map = createArchitecturalWallTexture(theme.wallStops, theme.isDarkRoom);
      outerWallMat.needsUpdate = true;

      innerWallMat.map?.dispose();
      innerWallMat.map = createArchitecturalWallTexture(theme.wallStops, theme.isDarkRoom);
      innerWallMat.needsUpdate = true;

      floorMat.map?.dispose();
      floorMat.map = createArchitecturalFloorTexture(theme.floorStops, theme.floorPattern);
      floorMat.needsUpdate = true;

      ceilingMat.color.set(theme.ceilingColor);
      frameSharedMat.color.set(theme.frameColor);

      haloTex.dispose();
      haloTex = createHaloTexture(theme.haloColors);
      haloMat.map = haloTex;
      haloMat.needsUpdate = true;

      for (const rec of frames) {
        const idx =
          rec.wall === 'outer'
            ? rec.slotIndex % count
            : (rec.slotIndex + Math.floor(count / 2)) % count;
        rec.itemIndex = idx;
        const item = activeItems[idx];

        const artMat = rec.artMesh.material as THREE.MeshBasicMaterial;
        const tex = getCroppedTexture(item.sheetId, item.cellIndex);
        if (tex) {
          artMat.map = tex;
          artMat.color.set('#ffffff');
          artMat.needsUpdate = true;
        }

        const labelMat = rec.labelMesh.material as THREE.MeshBasicMaterial;
        labelMat.map = getPlaqueTexture(
          item,
          theme.plaqueInk,
          theme.plaqueSubInk,
          theme.plaqueAccent
        );
        labelMat.needsUpdate = true;
      }
    };

    // Camera state & Zestwell kinematics
    const initD = getWalkOffsetD(isPortraitSmall());
    let targetTh = initD;
    let currentPose: CameraPose = getWalkPose(initD, isPortraitSmall());
    let focusedFrame: FrameRecord | null = null;

    // Glide / Intro state
    let glideActive = false;
    let glideFrom: CameraPose = { ...currentPose };
    let glideTo: CameraPose = { ...currentPose };
    let glideStart = 0;
    let glideDuration: number = GALLERY_CONSTANTS.GLIDE_DURATION;
    let isIntro = false;

    const _pos = new THREE.Vector3();
    const _look = new THREE.Vector3();
    const _corner = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const applyCameraPose = (pose: CameraPose) => {
      const cosT = Math.cos(pose.th);
      const sinT = Math.sin(pose.th);
      _pos.set(pose.r * cosT, pose.y, pose.r * sinT);
      camera.position.copy(_pos);

      const tanX = sinT;
      const tanZ = -cosT;
      const dirX = Math.cos(pose.yaw) * tanX + Math.sin(pose.yaw) * cosT;
      const dirZ = Math.cos(pose.yaw) * tanZ + Math.sin(pose.yaw) * sinT;

      _look.set(_pos.x + dirX, _pos.y + pose.pitch, _pos.z + dirZ);
      camera.lookAt(_look);
    };

    const projectArtScreenRect = (mesh: THREE.Mesh): FlyerOriginRect => {
      mesh.updateWorldMatrix(true, false);
      const hw = PW / 2;
      const hh = PH / 2;
      const corners = [
        [-hw, -hh, 0],
        [hw, -hh, 0],
        [-hw, hh, 0],
        [hw, hh, 0],
      ];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const w = window.innerWidth;
      const h = window.innerHeight;

      for (const [cx, cy, cz] of corners) {
        _corner.set(cx, cy, cz).applyMatrix4(mesh.matrixWorld).project(camera);
        const sx = (_corner.x * 0.5 + 0.5) * w;
        const sy = (-_corner.y * 0.5 + 0.5) * h;
        if (sx < minX) minX = sx;
        if (sy < minY) minY = sy;
        if (sx > maxX) maxX = sx;
        if (sy > maxY) maxY = sy;
      }
      return {
        left: minX,
        top: minY,
        width: Math.max(40, maxX - minX),
        height: Math.max(40, maxY - minY),
      };
    };

    // On-demand + software-WebGL paced render loop
    let frameHandle = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastTickTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameHandle = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync(sync);
            frameHandle = window.setTimeout(cb, 70);
          }
        };
        frameHandle = window.setTimeout(poll, 6);
      } else {
        frameHandle = window.setTimeout(cb, 80);
      }
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameHandle = requestAnimationFrame((now) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.1, Math.max(0.001, (now - lastTickTime) / 1000));
        lastTickTime = now;

        let needsMoreFrames = false;

        if (glideActive) {
          const elapsed = (now - glideStart) / 1000;
          const rawT = glideDuration <= 0 ? 1 : Math.min(1, elapsed / glideDuration);
          if (isIntro) {
            const expo = rawT >= 1 ? 1 : 1 - Math.pow(2, -10 * rawT);
            currentPose = {
              th: glideFrom.th + (glideTo.th - glideFrom.th) * expo,
              r: glideFrom.r + (glideTo.r - glideFrom.r) * expo,
              yaw: glideTo.yaw,
              y: glideTo.y,
              pitch: glideTo.pitch,
            };
          } else {
            currentPose = interpolateGlidePose(glideFrom, glideTo, rawT);
          }
          if (rawT >= 1) {
            glideActive = false;
            isIntro = false;
            targetTh = currentPose.th;
          } else {
            needsMoreFrames = true;
          }
        } else if (!focusedFrame) {
          const diff = targetTh - currentPose.th;
          if (Math.abs(diff) > 0.00035) {
            if (prefersReduced) {
              currentPose.th = targetTh;
            } else {
              const alpha = 1 - Math.exp(-dt / GALLERY_CONSTANTS.WALK_TAU);
              currentPose.th += diff * alpha;
              needsMoreFrames = true;
            }
          } else {
            currentPose.th = targetTh;
          }
        }

        applyCameraPose(currentPose);
        renderer.render(scene, camera);

        const finish = () => {
          if (disposed) return;
          renderBusy = false;
          if (needsMoreFrames || renderDirty) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(finish);
        else finish();
      });
    };

    const startGlideTo = (to: CameraPose, duration: number = GALLERY_CONSTANTS.GLIDE_DURATION) => {
      glideFrom = { ...currentPose };
      glideTo = { ...to };
      glideStart = performance.now();
      glideDuration = prefersReduced ? 0 : duration;
      glideActive = true;
      isIntro = false;
      lastTickTime = performance.now();
      requestRender();
    };

    let autoOpenDishTimer = 0;

    const focusFrame = (rec: FrameRecord) => {
      window.clearTimeout(autoOpenDishTimer);
      focusedFrame = rec;
      const item = activeItems[rec.itemIndex];
      setFocusedItem(item);
      setPillVisible(false);
      const focusPose = getFocusPose(rec.angle, rec.wall, currentPose.th, isPortraitSmall());
      const isRoomDish = callbacksRef.current.mode === 'room' && Boolean(item?.dish);
      startGlideTo(focusPose, isRoomDish ? 0.56 : GALLERY_CONSTANTS.GLIDE_DURATION);

      // Inside any culinary room, automatically open the Dish Description Window right as the
      // camera frames the dish portrait — zero extra "OPEN DISH CARD" click required!
      if (isRoomDish && item?.dish) {
        const targetDish = item.dish;
        autoOpenDishTimer = window.setTimeout(
          () => {
            if (disposed || focusedFrame !== rec || callbacksRef.current.isOverlayOpen) return;
            const rect = projectArtScreenRect(rec.artMesh);
            callbacksRef.current.onOpenDish(targetDish, rect);
          },
          prefersReduced ? 20 : 420
        );
      }
    };

    const stepBackToWalk = () => {
      window.clearTimeout(autoOpenDishTimer);
      if (!focusedFrame) return;
      focusedFrame = null;
      setFocusedItem(null);
      setPillVisible(false);
      const d = getWalkOffsetD(isPortraitSmall());
      const walkTh = currentPose.th + d;
      targetTh = walkTh;
      startGlideTo(getWalkPose(walkTh, isPortraitSmall()), GALLERY_CONSTANTS.GLIDE_DURATION);
    };

    const activateFrame = (rec: FrameRecord) => {
      window.clearTimeout(autoOpenDishTimer);
      const item = activeItems[rec.itemIndex];
      if (!item) return;
      if (callbacksRef.current.mode === 'hallway' && item.room) {
        callbacksRef.current.onEnterRoom(item.room.id);
      } else if (callbacksRef.current.mode === 'room' && item.dish) {
        const rect = projectArtScreenRect(rec.artMesh);
        callbacksRef.current.onOpenDish(item.dish, rect);
      }
    };

    // Imperative API for React UI buttons
    engineApiRef.current = {
      step: (dir: 1 | -1) => {
        if (focusedFrame) stepBackToWalk();
        const d = getWalkOffsetD(isPortraitSmall());
        targetTh = stepSlotAngle(targetTh, dir, d);
        lastTickTime = performance.now();
        requestRender();
      },
      stepBack: stepBackToWalk,
      activateFocused: () => {
        if (focusedFrame) {
          activateFrame(focusedFrame);
        }
      },
      focusById: (id: string) => {
        const idx = activeItems.findIndex((it) => it.id === id);
        if (idx < 0) return;
        let best: FrameRecord | null = null;
        let bestDist = Infinity;
        for (const rec of frames) {
          if (rec.wall === 'outer' && rec.itemIndex === idx) {
            const wrapped = getFocusPose(rec.angle, 'outer', currentPose.th, isPortraitSmall());
            const dist = Math.abs(wrapped.th - currentPose.th);
            if (dist < bestDist) {
              bestDist = dist;
              best = rec;
            }
          }
        }
        if (best) focusFrame(best);
      },
      syncModeAndRoom: (nextMode: GalleryMode, nextRoomId: string) => {
        focusedFrame = null;
        setFocusedItem(null);
        setPillVisible(false);
        refreshFrameContent(nextMode, nextRoomId);
        const d = getWalkOffsetD(isPortraitSmall());
        targetTh = d;
        const walkPose = getWalkPose(d, isPortraitSmall());
        currentPose = { ...walkPose, th: d + 0.14, r: walkPose.r - 0.3 };
        glideFrom = { ...currentPose };
        glideTo = { ...walkPose };
        glideStart = performance.now();
        glideDuration = prefersReduced ? 0 : 0.9;
        glideActive = true;
        isIntro = true;
        lastTickTime = performance.now();
        requestRender();
      },
    };

    // Load all 3 sprite sheets + wait for fonts before opening choreography
    let readyTriggered = false;
    const triggerOpening = () => {
      if (readyTriggered || disposed) return;
      readyTriggered = true;
      refreshFrameContent(callbacksRef.current.mode, callbacksRef.current.activeRoomId);

      const d = getWalkOffsetD(isPortraitSmall());
      const walkPose = getWalkPose(d, isPortraitSmall());
      currentPose = prefersReduced
        ? { ...walkPose }
        : { ...walkPose, th: d + 0.16, r: walkPose.r - 0.35 };
      glideFrom = { ...currentPose };
      glideTo = { ...walkPose };
      glideStart = performance.now();
      glideDuration = prefersReduced ? 0 : 1.35;
      glideActive = !prefersReduced;
      isIntro = !prefersReduced;
      lastTickTime = performance.now();
      requestRender();
      setVeilVisible(false);
    };

    const sheetIds = Object.keys(SHEETS) as SheetId[];
    let loadedSheets = 0;

    const onSheetDone = () => {
      loadedSheets += 1;
      if (loadedSheets >= sheetIds.length) {
        (document.fonts?.ready ?? Promise.resolve()).then(() => {
          plaqueTextureCache.forEach((t) => t.dispose());
          plaqueTextureCache.clear();
          triggerOpening();
        });
      }
    };

    for (const id of sheetIds) {
      loader.load(
        SHEETS[id].url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          baseTextures[id] = tex;
          onSheetDone();
        },
        undefined,
        () => onSheetDone()
      );
    }

    const failsafeTimer = window.setTimeout(triggerOpening, 3500);

    // Input handlers: wheel, drag/pointer, click raycast, keyboard
    const domEl = renderer.domElement;
    let pointerDown = false;
    let dragged = false;
    let startX = 0;
    let startY = 0;
    let downTargetTh = targetTh;
    let lastHoverCheck = 0;

    const raycastAt = (clientX: number, clientY: number): FrameRecord | null => {
      const rect = domEl.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData.frameRecord as FrameRecord) || null;
    };

    const onWheel = (e: WheelEvent) => {
      if (callbacksRef.current.isOverlayOpen) return;
      e.preventDefault();
      if (focusedFrame) {
        stepBackToWalk();
        return;
      }
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      targetTh -= dy * 0.0016;
      lastTickTime = performance.now();
      requestRender();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (callbacksRef.current.isOverlayOpen) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointerDown = true;
      dragged = false;
      startX = e.clientX;
      startY = e.clientY;
      downTargetTh = targetTh;
      try {
        domEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on synthetic events
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (callbacksRef.current.isOverlayOpen) return;

      if (pointerDown) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) > 8) {
          dragged = true;
          setCursorMode('grabbing');
          if (focusedFrame) {
            stepBackToWalk();
            downTargetTh = targetTh;
          }
        }
        if (dragged) {
          const isSmall = window.matchMedia(SMALL_SCREEN_QUERY).matches;
          const speed = isSmall ? 0.0042 : 0.0022;
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          targetTh = downTargetTh + delta * speed;
          lastTickTime = performance.now();
          requestRender();
        }
        return;
      }

      // Desktop-only hover raycast for pointer & cursor-following action pill
      if (!supportsHoverCursor()) return;

      const now = performance.now();
      if (now - lastHoverCheck < 35) return;
      lastHoverCheck = now;

      const hit = raycastAt(e.clientX, e.clientY);
      setCursorMode(hit ? 'pointer' : 'grab');

      if (focusedFrame && hit === focusedFrame && pillRef.current) {
        pillRef.current.style.left = `${e.clientX}px`;
        pillRef.current.style.top = `${e.clientY}px`;
        setPillVisible(true);
      } else {
        setPillVisible(false);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      try {
        domEl.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture already lost
      }
      setCursorMode('grab');

      if (!dragged && !callbacksRef.current.isOverlayOpen) {
        const hit = raycastAt(e.clientX, e.clientY);
        if (hit) {
          if (focusedFrame === hit) {
            activateFrame(hit);
          } else {
            focusFrame(hit);
          }
        } else if (focusedFrame) {
          stepBackToWalk();
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (callbacksRef.current.isOverlayOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        engineApiRef.current?.step(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        engineApiRef.current?.step(-1);
      } else if (e.key === 'Escape' && focusedFrame) {
        e.preventDefault();
        stepBackToWalk();
      } else if (e.key === 'Enter' && focusedFrame) {
        e.preventDefault();
        activateFrame(focusedFrame);
      }
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.fov = w >= h ? 56 : 70;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      requestRender();
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('webglcontextlost', onContextLost);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.clearTimeout(autoOpenDishTimer);
      window.clearTimeout(failsafeTimer);
      cancelAnimationFrame(frameHandle);
      window.clearTimeout(frameHandle);

      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);

      haloGeo.dispose();
      shadowGeo.dispose();
      frameGeo.dispose();
      artGeo.dispose();
      labelGeo.dispose();
      haloMat.dispose();
      shadowMat.dispose();
      frameSharedMat.dispose();
      haloTex.dispose();
      shadowTex.dispose();
      outerWall.geometry.dispose();
      outerWallMat.map?.dispose();
      outerWallMat.dispose();
      innerWall.geometry.dispose();
      innerWallMat.map?.dispose();
      innerWallMat.dispose();
      floor.geometry.dispose();
      floorMat.map?.dispose();
      floorMat.dispose();
      ceiling.geometry.dispose();
      ceilingMat.dispose();
      croppedTextureCache.forEach((t) => t.dispose());
      plaqueTextureCache.forEach((t) => t.dispose());
      Object.values(baseTextures).forEach((t) => t?.dispose());
      frames.forEach((f) => {
        (f.artMesh.material as THREE.Material).dispose();
        (f.labelMesh.material as THREE.Material).dispose();
      });
      renderer.dispose();
      engineApiRef.current = null;
    };
  }, []);

  // Synchronize WebGL room/hallway swap smoothly without recreating the canvas
  const firstSyncRef = useRef(true);
  useEffect(() => {
    if (firstSyncRef.current) {
      firstSyncRef.current = false;
      return;
    }
    setVeilVisible(true);
    const swapTimer = window.setTimeout(() => {
      engineApiRef.current?.syncModeAndRoom(mode, activeRoomId);
      setVeilVisible(false);
    }, 180);
    return () => window.clearTimeout(swapTimer);
  }, [mode, activeRoomId]);

  // Step camera back cleanly to the gallery aisle when the floating Dish Window closes
  const prevOverlayRef = useRef(isOverlayOpen);
  useEffect(() => {
    if (prevOverlayRef.current && !isOverlayOpen && mode === 'room') {
      engineApiRef.current?.stepBack();
    }
    prevOverlayRef.current = isOverlayOpen;
  }, [isOverlayOpen, mode]);

  const headlineText = mode === 'hallway' ? 'THE TASTING HALLWAY' : activeRoom.title.toUpperCase();
  const kickerText =
    mode === 'hallway'
      ? 'YOU ARE WALKING PAST · PICK A CULINARY WING'
      : `${activeRoom.gatewayName.toUpperCase()} · ${activeRoom.vibeTag.toUpperCase()}`;

  const actionCtaLabel = mode === 'hallway' ? 'ENTER THIS ROOM' : 'OPEN DISH CARD';

  // Adaptive HUD classes so both sunlit and dark rooms (Brick Oven & Velvet Roastery) stay ultra-legible
  const inkText = isDarkRoom ? 'text-[#FFF5E8]' : 'text-[var(--ink)]';
  const mutedText = isDarkRoom ? 'text-[#FFF5E8]/75' : 'text-[var(--ink-60)]';
  const surfacePill = isDarkRoom
    ? 'bg-[#1D120E]/82 border-[#FFF5E8]/30 text-[#FFF5E8]'
    : 'bg-[var(--page)]/92 border-[var(--ink-35)] text-[var(--ink)]';
  const primaryBtn = isDarkRoom
    ? 'bg-[#FFF5E8] text-[#241611] hover:bg-[#F3B47A]'
    : 'bg-[var(--ink)] text-[var(--wall)] hover:bg-[var(--terracotta)]';

  const handleActivateFocused = (e: React.MouseEvent) => {
    e.stopPropagation();
    engineApiRef.current?.activateFocused();
  };

  const handleStepBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    engineApiRef.current?.stepBack();
  };

  return (
    <main
      id="gallery"
      data-testid="gallery-3d-root"
      data-gallery-mode={mode}
      data-active-room={activeRoomId}
      data-dark-room={isDarkRoom ? 'true' : 'false'}
      className="fixed inset-0 w-full h-full touch-none select-none overflow-hidden"
      style={{
        backgroundColor: activeVeilColor,
        cursor:
          cursorMode === 'grabbing'
            ? 'grabbing'
            : cursorMode === 'pointer'
            ? 'pointer'
            : 'grab',
      }}
    >
      {/* Dedicated empty mount container for WebGLRenderer */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Graceful fallback if WebGL is unavailable */}
      {webglError && (
        <div className="fixed inset-0 z-10 flex flex-col items-center justify-center p-8 bg-[var(--wall)] text-center">
          <h1 className="font-display text-4xl uppercase mb-3">Hopin Patio Gallery</h1>
          <p className="text-[var(--ink-60)] max-w-md mb-6">
            Your browser does not have WebGL enabled. Explore our complete illustrated patio menu in
            List view instead.
          </p>
          <button
            type="button"
            onClick={onOpenList}
            className="px-6 py-3 bg-[var(--ink)] text-[var(--wall)] font-display uppercase tracking-[0.12em]"
          >
            Open Full Menu
          </button>
        </div>
      )}

      {/* Room-colored veil fade for smooth entrance & room architecture transitions */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-10 pointer-events-none transition-opacity duration-500 ${
          veilVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: activeVeilColor }}
      />

      {/* Desktop-only cursor-following Zestwell Action Pill (NEVER shown statically on mobile) */}
      <div
        ref={pillRef}
        aria-hidden="true"
        className={`hidden md:block fixed z-25 pointer-events-none -translate-x-1/2 -translate-y-1/2 px-3.5 py-2 rounded-full font-mono-meta text-[10px] uppercase tracking-[0.14em] whitespace-nowrap transition-opacity duration-150 ${
          isDarkRoom ? 'bg-[#FFF5E8] text-[#241611]' : 'bg-[#1E1A18] text-[#FBF6EE]'
        } ${pillVisible && !isOverlayOpen ? 'opacity-100' : 'opacity-0'}`}
      >
        {actionCtaLabel}
      </div>

      {/* Zestwell Gallery UI Overlay (.gui) — fades cleanly when List or Dish Card is open */}
      <div
        className={`fixed inset-0 z-15 pointer-events-none transition-opacity duration-300 ${
          isOverlayOpen ? 'opacity-0 invisible' : 'opacity-100 visible'
        }`}
      >
        {/* Top contextual breadcrumb + scrollable 6-Room Switcher (works on mobile & desktop) */}
        <div className="pointer-events-auto absolute top-[62px] md:top-[max(60px,calc(64*var(--u)))] left-4 md:left-[calc(27*var(--u))] right-4 md:right-[calc(27*var(--u))] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onGoGateways}
              className={`inline-flex items-center gap-1.5 min-h-[32px] px-3.5 rounded-full border font-mono-meta text-[10.5px] uppercase tracking-[0.11em] transition-colors whitespace-nowrap ${surfacePill} ${
                isDarkRoom
                  ? 'hover:bg-[#FFF5E8] hover:text-[#241611]'
                  : 'hover:bg-[var(--ink)] hover:text-[var(--wall)]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Gateways
            </button>

            {mode === 'room' && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onBackToHallway}
                className={`hidden sm:inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full border font-mono-meta text-[10.5px] uppercase tracking-[0.11em] transition-colors whitespace-nowrap ${surfacePill} opacity-85 hover:opacity-100`}
              >
                All Portals
              </button>
            )}
          </div>

          {/* Room Theme Switcher — horizontally scrollable on small screens, inline on desktop */}
          {mode === 'room' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full border p-1 max-w-[66vw] md:max-w-none ${
                isDarkRoom
                  ? 'bg-[#1D120E]/82 border-[#FFF5E8]/22'
                  : 'bg-[var(--page)]/90 border-[var(--ink-15)]'
              }`}
            >
              {SUBCATEGORY_ROOMS.map((room) => {
                const isActiveRoom = room.id === activeRoomId;
                return (
                  <button
                    key={room.id}
                    ref={isActiveRoom ? activeRoomPillRef : null}
                    type="button"
                    onClick={() => onEnterRoom(room.id)}
                    className={`min-h-[26px] px-3 rounded-full font-mono-meta text-[10px] uppercase tracking-[0.09em] transition-colors whitespace-nowrap shrink-0 ${
                      isActiveRoom
                        ? isDarkRoom
                          ? 'bg-[#FFF5E8] text-[#241611]'
                          : 'bg-[var(--ink)] text-[var(--wall)]'
                        : isDarkRoom
                        ? 'text-[#FFF5E8]/70 hover:text-[#FFF5E8]'
                        : 'text-[var(--ink-60)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {room.shortTitle}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Circular walk arrows: anchored neatly in the lower-left HUD band so curved-wall portraits stay 100% unobstructed */}
        <div
          className={`pointer-events-auto absolute left-4 bottom-5 md:left-[calc(27*var(--u))] md:bottom-[calc(154*var(--u))] flex-row gap-2.5 ${
            focusedItem ? 'hidden md:flex' : 'flex'
          }`}
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => engineApiRef.current?.step(-1)}
            aria-label="Walk backward to previous portrait"
            className={`${
              isDarkRoom ? 'gallery-arrow-btn-dark' : 'gallery-arrow-btn'
            } w-[44px] h-[44px] md:w-[max(44px,calc(50*var(--u)))] md:h-[max(44px,calc(50*var(--u)))] rounded-full flex items-center justify-center`}
          >
            <ArrowLeft className="w-5 h-5 stroke-[1.6]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => engineApiRef.current?.step(1)}
            aria-label="Walk forward to next portrait"
            className={`${
              isDarkRoom ? 'gallery-arrow-btn-dark' : 'gallery-arrow-btn'
            } w-[44px] h-[44px] md:w-[max(44px,calc(50*var(--u)))] md:h-[max(44px,calc(50*var(--u)))] rounded-full flex items-center justify-center`}
          >
            <ArrowRight className="w-5 h-5 stroke-[1.6]" aria-hidden="true" />
          </button>
        </div>

        {/* Focused portrait dock: only needed in Hallway mode to confirm stepping into a room;
            in Room mode clicking any dish portrait opens the floating Dish Description Window automatically! */}
        {focusedItem && mode === 'hallway' && (
          <div
            data-testid="focused-portrait-dock"
            onPointerDown={(e) => e.stopPropagation()}
            className={`pointer-events-auto absolute left-4 right-4 bottom-5 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-[max(146px,calc(172*var(--u)))] rounded-2xl md:rounded-full border px-4 py-3.5 md:py-2.5 md:px-4 shadow-xl backdrop-blur-sm ${
              isDarkRoom
                ? 'bg-[#1C120E]/94 border-[#FFF5E8]/30 text-[#FFF5E8]'
                : 'bg-[var(--page)]/96 border-[var(--ink-35)] text-[var(--ink)]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-3.5">
              <div className="flex items-start justify-between gap-3 md:block min-w-0">
                <div className="min-w-0">
                  <p className="font-serif-editorial font-medium text-[16px] md:text-[14.5px] leading-tight truncate">
                    {focusedItem.title}
                  </p>
                  <p
                    className={`font-mono-meta text-[10.5px] uppercase tracking-[0.11em] mt-0.5 truncate md:hidden ${mutedText}`}
                  >
                    {focusedItem.meta}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStepBack}
                  aria-label="Step back from portrait"
                  className={`md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0 ${
                    isDarkRoom
                      ? 'border-[#FFF5E8]/25 text-[#FFF5E8]/80'
                      : 'border-[var(--ink-35)] text-[var(--ink-60)]'
                  }`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="focused-action-cta"
                  onClick={handleActivateFocused}
                  className={`flex-1 md:flex-none min-h-[44px] md:min-h-[34px] px-5 rounded-full font-mono-meta text-[11px] font-medium uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${primaryBtn}`}
                >
                  {actionCtaLabel} →
                </button>
                <button
                  type="button"
                  onClick={handleStepBack}
                  className={`hidden md:inline-flex items-center min-h-[34px] px-3 rounded-full font-mono-meta text-[10.5px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap ${mutedText} hover:opacity-100`}
                >
                  Step Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right-aligned Zestwell Hint (desktop only) */}
        <div
          className={`hidden md:block absolute right-[calc(27*var(--u))] bottom-[calc(218*var(--u))] text-right font-mono-meta text-[max(11px,calc(10.5*var(--u)))] uppercase tracking-[0.12em] leading-[1.65] ${mutedText}`}
        >
          <div>
            {focusedItem
              ? mode === 'hallway'
                ? 'Click the portrait to enter this room'
                : 'Click the portrait to open dish card'
              : 'Scroll or drag to walk round'}
          </div>
          <div>
            {focusedItem
              ? 'Esc or click away to step back'
              : mode === 'hallway'
              ? 'Click a room portal to look closer'
              : 'Click any dish portrait to inspect & order'}
          </div>
        </div>

        {/* Zestwell GALLERY | LIST segmented pill toggle (yields on mobile while focused) */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`pointer-events-auto absolute right-4 bottom-5 md:right-[calc(27*var(--u))] md:bottom-[calc(160*var(--u))] items-center p-[3px] gap-[3px] rounded-full border ${
            focusedItem ? 'hidden md:inline-flex' : 'inline-flex'
          } ${
            isDarkRoom
              ? 'border-[#FFF5E8]/30 bg-[#1D120E]/82'
              : 'border-[var(--ink-35)] bg-[var(--page)]/92'
          }`}
        >
          <button
            type="button"
            aria-pressed={!isOverlayOpen}
            onClick={() => {
              if (focusedItem) engineApiRef.current?.stepBack();
            }}
            className={`min-h-[28px] px-3.5 rounded-full font-mono-meta text-[10.5px] uppercase tracking-[0.12em] whitespace-nowrap ${
              isDarkRoom ? 'bg-[#FFF5E8] text-[#241611]' : 'bg-[var(--ink)] text-[var(--wall)]'
            }`}
          >
            Gallery
          </button>
          <button
            type="button"
            aria-pressed={isOverlayOpen}
            onClick={onOpenList}
            className={`min-h-[28px] px-3.5 rounded-full font-mono-meta text-[10.5px] uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${
              isDarkRoom
                ? 'text-[#FFF5E8] hover:bg-[#FFF5E8]/12'
                : 'text-[var(--ink)] hover:bg-[var(--ink)]/10'
            }`}
          >
            List
          </button>
        </div>

        {/* Bottom Caption Bar: Left Condensed Headline + Right Action Links (yields on mobile when inspecting a portrait) */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`pointer-events-auto absolute left-4 right-4 bottom-[78px] md:left-[calc(25*var(--u))] md:right-[calc(27*var(--u))] md:bottom-[calc(24*var(--u))] flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4 ${
            focusedItem ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="min-w-0">
            <p
              className={`font-mono-meta text-[10.5px] md:text-[max(11px,calc(11*var(--u)))] uppercase tracking-[0.14em] mb-1.5 ml-0.5 truncate ${mutedText}`}
            >
              {kickerText}
            </p>
            <h1
              key={`${mode}-${activeRoomId}`}
              className={`gallery-headline text-[clamp(2.2rem,8.5vw,3.5rem)] md:text-[clamp(3.6rem,6.8vw,6.6rem)] whitespace-nowrap ${inkText}`}
            >
              {headlineText}
            </h1>
          </div>

          {mode === 'hallway' ? (
            <div className="flex items-center gap-5 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => onEnterRoom(SUBCATEGORY_ROOMS[0].id)}
                className={`font-mono-meta text-[11px] uppercase tracking-[0.12em] pb-0.5 border-b transition-colors whitespace-nowrap ${inkText} ${
                  isDarkRoom
                    ? 'border-[#FFF5E8] hover:text-[#F3B47A] hover:border-[#F3B47A]'
                    : 'border-[var(--ink)] hover:text-[var(--terracotta)] hover:border-[var(--terracotta)]'
                }`}
              >
                Enter Room 01 →
              </button>
              <button
                type="button"
                onClick={onOpenList}
                className={`font-mono-meta text-[11px] uppercase tracking-[0.12em] pb-0.5 border-b transition-colors whitespace-nowrap ${mutedText} ${
                  isDarkRoom
                    ? 'border-[#FFF5E8]/35 hover:text-[#FFF5E8]'
                    : 'border-[var(--ink-35)] hover:text-[var(--ink)]'
                }`}
              >
                All {DISHES.length} Dishes →
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap md:justify-end items-center gap-x-4 gap-y-1.5 pb-1 shrink-0 max-w-full md:max-w-[430px]">
              {currentItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    if (it.dish) onOpenDish(it.dish, null);
                  }}
                  className={`font-mono-meta text-[11px] uppercase tracking-[0.1em] pb-0.5 border-b transition-colors whitespace-nowrap ${inkText} ${
                    isDarkRoom
                      ? 'border-[#FFF5E8]/45 hover:text-[#F3B47A] hover:border-[#F3B47A]'
                      : 'border-[var(--ink-35)] hover:text-[var(--terracotta)] hover:border-[var(--terracotta)]'
                  }`}
                >
                  {it.title.split(' ').slice(0, 2).join(' ')} →
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
