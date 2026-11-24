import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { SubcategoryRoom } from '../data/cafeData';
import { buildGate3DScene, type Hero3DSceneHandles } from '../utils/hero3DBuilder';
import {
  computeGate3DCameraState,
  computeSlicePose,
  GATE_ENTRY_DURATION_MS,
  MONOLITH_Z,
  OCULUS_WORLD_Y,
  SLICE_COUNT,
} from '../utils/heroPortalMath';

interface GatePortal3DOverlayProps {
  room: SubcategoryRoom;
  freezeAtMs?: number | null;
  onSwapRoom: (roomId: string) => void;
  onNavHiddenChange: (hidden: boolean) => void;
  onComplete: () => void;
}

const _lookTarget = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const GatePortal3DOverlay: React.FC<GatePortal3DOverlayProps> = ({
  room,
  freezeAtMs = null,
  onSwapRoom,
  onNavHiddenChange,
  onComplete,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({ onSwapRoom, onNavHiddenChange, onComplete });
  callbacksRef.current = { onSwapRoom, onNavHiddenChange, onComplete };

  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      freezeAtMs === null;

    if (prefersReduced) {
      callbacksRef.current.onSwapRoom(room.id);
      callbacksRef.current.onNavHiddenChange(false);
      callbacksRef.current.onComplete();
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(43, width / height, 0.15, 90);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    pmremGenerator.dispose();

    let currentElapsed = 0;
    let swapped = false;
    let lastNavHidden: boolean | null = null;
    let disposed = false;
    let timerId = 0;
    let handles: Hero3DSceneHandles | null = null;

    const renderFrame = (elapsedMs: number) => {
      if (disposed || !handles) return;
      currentElapsed = elapsedMs;
      const state = computeGate3DCameraState(elapsedMs);

      if (lastNavHidden !== state.hideNavbar) {
        lastNavHidden = state.hideNavbar;
        callbacksRef.current.onNavHiddenChange(state.hideNavbar);
      }

      if (state.shouldSwapRoom && !swapped && freezeAtMs === null) {
        swapped = true;
        callbacksRef.current.onSwapRoom(room.id);
      }

      if (overlayRef.current) {
        overlayRef.current.style.opacity = state.overlayOpacity.toFixed(4);
      }

      if (labelRef.current) {
        labelRef.current.style.opacity = state.labelOpacity.toFixed(3);
        labelRef.current.style.transform = `translate3d(0, ${((1 - state.labelOpacity) * 10).toFixed(2)}px, 0)`;
      }

      // Animate 8 physical 3D rotating Venetian photographic louver slats
      for (let i = 0; i < SLICE_COUNT; i++) {
        const mesh = handles.louverMeshes[i];
        if (!mesh) continue;
        const pose = computeSlicePose(i, elapsedMs, SLICE_COUNT, 0.72);
        mesh.rotation.y = pose.rotateYRad;
        mesh.position.y = OCULUS_WORLD_Y + pose.translateYWorld;
      }

      // Responsive portrait FOV boost so pilasters + centered oculus stay framed cleanly on mobile
      const aspect = Math.max(0.35, camera.aspect);
      const baseHalfTan = Math.tan(THREE.MathUtils.degToRad(state.fovDeg * 0.5));
      const distToMonolith = Math.max(2.4, state.camZ - MONOLITH_Z);
      const portraitBoostFactor = 1 - Math.min(1, state.diveProgress * 1.25);
      const requiredHalfTan =
        aspect < 1.1 ? (3.5 / aspect / distToMonolith) * portraitBoostFactor : 0;
      const effectiveHalfTan = Math.min(
        Math.tan(THREE.MathUtils.degToRad(46)),
        Math.max(baseHalfTan, requiredHalfTan)
      );
      const nextFov = THREE.MathUtils.radToDeg(2 * Math.atan(effectiveHalfTan));
      if (Math.abs(camera.fov - nextFov) > 0.05) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      camera.position.set(state.camX, state.camY, state.camZ);
      _lookTarget.set(state.lookX, state.lookY, state.lookZ);
      camera.lookAt(_lookTarget);
      camera.rotation.z += state.rollRad;

      renderer.render(handles.scene, camera);
    };

    handles = buildGate3DScene(room, renderer.capabilities.getMaxAnisotropy(), () => {
      if (!disposed) {
        renderFrame(currentElapsed);
      }
    });
    handles.scene.environment = envRT.texture;

    if (!isSoftwareGl) {
      renderer.compile(handles.scene, camera);
    }

    const handleResize = () => {
      if (disposed) return;
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderFrame(currentElapsed);
    };
    window.addEventListener('resize', handleResize);

    const scheduleAfterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        timerId = window.setTimeout(cb, 65);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          timerId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          timerId = window.setTimeout(cb, 65);
        }
      };
      timerId = window.setTimeout(poll, 5);
    };

    skipRef.current = () => {
      if (disposed) return;
      window.cancelAnimationFrame(timerId);
      window.clearTimeout(timerId);
      if (!swapped) {
        swapped = true;
        callbacksRef.current.onSwapRoom(room.id);
      }
      callbacksRef.current.onNavHiddenChange(false);
      callbacksRef.current.onComplete();
    };

    if (freezeAtMs !== null) {
      const clamped = Math.max(0, Math.min(GATE_ENTRY_DURATION_MS, freezeAtMs));
      renderFrame(clamped);
    } else {
      renderFrame(0);
      const startTs = performance.now();

      const tick = () => {
        if (disposed) return;
        const elapsed = Math.min(GATE_ENTRY_DURATION_MS, performance.now() - startTs);
        renderFrame(elapsed);

        if (elapsed < GATE_ENTRY_DURATION_MS) {
          if (isSoftwareGl) {
            scheduleAfterDraw(tick);
          } else {
            timerId = window.requestAnimationFrame(tick);
          }
        } else {
          if (!swapped) {
            swapped = true;
            callbacksRef.current.onSwapRoom(room.id);
          }
          callbacksRef.current.onNavHiddenChange(false);
          callbacksRef.current.onComplete();
        }
      };

      if (isSoftwareGl) {
        scheduleAfterDraw(tick);
      } else {
        timerId = window.requestAnimationFrame(tick);
      }
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(timerId);
      window.clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
      handles?.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      if (freezeAtMs === null) {
        callbacksRef.current.onNavHiddenChange(false);
      }
    };
  }, [room, freezeAtMs]);

  return (
    <div
      ref={overlayRef}
      data-testid="gate-3d-portal-overlay"
      data-gate-room={room.id}
      role="status"
      aria-label={`Entering Gate ${room.roman}: ${room.title}`}
      className="fixed inset-0 z-[50] bg-[#071413] overflow-hidden"
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Quiet matte architectural gate inscription along the lower horizon */}
      <div
        ref={labelRef}
        className="pointer-events-none absolute inset-x-0 bottom-10 sm:bottom-12 px-6 flex flex-col items-center text-center"
      >
        <p className="font-mono-meta text-[10.5px] uppercase tracking-[0.26em] text-[#E2BE7D]/90">
          Gate {room.roman} · {room.gatewayName}
        </p>
        <p className="mt-1 font-serif-editorial font-light text-[clamp(24px,3.2vw,38px)] leading-[1.08] tracking-[-0.015em] text-[#F5EFE4]">
          {room.title}
        </p>
      </div>

      {/* Subtle corner skip control for repeat visitors */}
      <button
        type="button"
        onClick={() => skipRef.current()}
        className="absolute right-5 bottom-5 sm:right-7 sm:bottom-6 font-mono-meta text-[10px] uppercase tracking-[0.2em] text-[#F5EFE4]/55 hover:text-[#E2BE7D] transition-colors"
      >
        Skip →
      </button>
    </div>
  );
};
