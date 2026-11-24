import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS } from '../data/cafeData';
import { buildHero3DScene, type Hero3DSceneHandles } from '../utils/hero3DBuilder';
import {
  computeHero3DCameraState,
  computeSlicePose,
  ENTRY_DURATION_MS,
  MONOLITH_Z,
  OCULUS_WORLD_Y,
} from '../utils/heroPortalMath';

interface HeroIntro3DOverlayProps {
  /** Optional deterministic freeze timestamp in ms for inspection (?heroEntryAt=ms) */
  freezeAtMs?: number | null;
  onNavHiddenChange: (hidden: boolean) => void;
  onComplete: () => void;
}

const _heroLookTarget = new THREE.Vector3();

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
 * Full-screen Three.js WebGL 3D Architectural Colonnade & Extruded Brushed-Brass
 * "H [◯] P I N" Oculus Fly-Through.
 *
 * Hides the top navigation bar throughout the continuous zero-pause 3D flight,
 * flies cleanly through the sculpted brass "O" revealing Hopin's illuminated
 * twilight bungalow louvers, and dissolves seamlessly straight into the
 * Gates of Heaven rotating culinary ring underneath.
 */
export const HeroIntro3DOverlay: React.FC<HeroIntro3DOverlayProps> = ({
  freezeAtMs = null,
  onNavHiddenChange,
  onComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);

  const onNavHiddenChangeRef = useRef(onNavHiddenChange);
  const onCompleteRef = useRef(onComplete);
  onNavHiddenChangeRef.current = onNavHiddenChange;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced && freezeAtMs === null) {
      onNavHiddenChangeRef.current(false);
      onCompleteRef.current();
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const initW = Math.max(1, window.innerWidth);
    const initH = Math.max(1, window.innerHeight);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallbackActive(true);
      onNavHiddenChangeRef.current(false);
      const t = window.setTimeout(() => onCompleteRef.current(), 600);
      return () => window.clearTimeout(t);
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();

    let disposed = false;
    let frameHandle = 0;
    let currentElapsed = freezeAtMs !== null ? Math.max(0, Math.min(ENTRY_DURATION_MS, freezeAtMs)) : 0;
    let handles: Hero3DSceneHandles | null = null;

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.15, 90);

    const applyFrameAt = (elapsedMs: number) => {
      if (disposed || !handles) return null;
      currentElapsed = elapsedMs;
      const state = computeHero3DCameraState(elapsedMs);

      // Keep "H [◯] P I N" monolith framed cleanly on narrow or portrait viewports
      const aspect = Math.max(0.35, camera.aspect);
      const baseHalfTan = Math.tan(THREE.MathUtils.degToRad(state.fovDeg * 0.5));
      const distToMonolith = Math.max(2.2, state.camZ - MONOLITH_Z);
      const portraitBoostFactor = 1 - Math.min(1, state.diveProgress * 1.25);
      const requiredHalfTan =
        aspect < 1.15 ? (4.6 / aspect / distToMonolith) * portraitBoostFactor : 0;
      const effectiveHalfTan = Math.min(
        Math.tan(THREE.MathUtils.degToRad(58)),
        Math.max(baseHalfTan, requiredHalfTan)
      );
      const nextFov = THREE.MathUtils.radToDeg(2 * Math.atan(effectiveHalfTan));
      if (Math.abs(camera.fov - nextFov) > 0.05) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      camera.position.set(state.camX, state.camY, state.camZ);
      _heroLookTarget.set(state.lookX, state.lookY, state.lookZ);
      camera.lookAt(_heroLookTarget);
      camera.rotation.z += state.rollRad;

      for (let i = 0; i < handles.louverMeshes.length; i++) {
        const pose = computeSlicePose(i, elapsedMs, handles.louverMeshes.length, 1);
        const mesh = handles.louverMeshes[i];
        mesh.rotation.y = pose.rotateYRad;
        mesh.position.y = OCULUS_WORLD_Y + pose.translateYWorld;
      }

      if (rootRef.current) {
        rootRef.current.style.opacity = state.overlayOpacity.toFixed(4);
      }

      onNavHiddenChangeRef.current(state.hideNavbar);
      renderer.render(handles.scene, camera);
      return state;
    };

    handles = buildHero3DScene(
      ASSETS.realGate,
      isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy(),
      () => {
        if (!disposed) {
          applyFrameAt(currentElapsed);
        }
      }
    );
    handles.scene.environment = envRT.texture;

    if (!isSoftwareGl) {
      renderer.compile(handles.scene, camera);
    }

    const onResize = () => {
      if (disposed) return;
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      applyFrameAt(currentElapsed);
    };
    window.addEventListener('resize', onResize);

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameHandle = window.setTimeout(poll, 8);
          } else {
            if (sync) gl.deleteSync(sync);
            frameHandle = window.setTimeout(cb, 45);
          }
        };
        frameHandle = window.setTimeout(poll, 8);
      } else {
        frameHandle = window.setTimeout(cb, 55);
      }
    };

    // Deterministic frozen inspection mode (?heroEntryAt=<ms>)
    if (freezeAtMs !== null) {
      const frozenElapsed = Math.max(0, Math.min(ENTRY_DURATION_MS, freezeAtMs));
      applyFrameAt(frozenElapsed);
      const r1 = window.setTimeout(() => applyFrameAt(frozenElapsed), 180);
      const r2 = window.setTimeout(() => applyFrameAt(frozenElapsed), 650);

      return () => {
        disposed = true;
        window.clearTimeout(r1);
        window.clearTimeout(r2);
        window.removeEventListener('resize', onResize);
        handles?.dispose();
        envRT.dispose();
        renderer.dispose();
      };
    }

    // Live zero-pause 3D colonnade fly-through
    onNavHiddenChangeRef.current(true);
    let startTs: number | null = null;

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      if (startTs === null) startTs = now;
      const elapsed = now - startTs;
      const state = applyFrameAt(elapsed);

      if (!state || !state.overlayActive || elapsed >= 3020) {
        onNavHiddenChangeRef.current(false);
        onCompleteRef.current();
        return;
      }

      if (isSoftwareGl) {
        afterDraw(() => {
          if (!disposed) tick();
        });
      } else {
        frameHandle = window.requestAnimationFrame(tick);
      }
    };

    frameHandle = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameHandle);
      window.clearTimeout(frameHandle);
      window.removeEventListener('resize', onResize);
      handles?.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, [freezeAtMs]);

  return (
    <div
      ref={rootRef}
      data-testid="hero-3d-intro-overlay"
      className="fixed inset-0 z-[45] bg-[#071514] overflow-hidden select-none"
    >
      <div ref={mountRef} className="w-full h-full" />

      {fallbackActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#071514] text-[#E2BE7D] font-serif-editorial text-3xl">
          Hopin
        </div>
      )}

      {/* Quiet bottom-center location datum */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center"
      >
        <p className="font-mono-meta text-[10px] uppercase tracking-[0.34em] text-[#E2BE7D]/70">
          PATIO CAFE · 17/2 NEW PALASIA · INDORE
        </p>
      </div>

      {/* Subtle Skip button for returning guests */}
      {freezeAtMs === null && (
        <button
          type="button"
          data-testid="skip-hero-intro"
          onClick={() => {
            onNavHiddenChange(false);
            onComplete();
          }}
          className="absolute right-5 bottom-6 z-10 px-3.5 py-1.5 rounded-full border border-[#E2BE7D]/30 bg-[#071514]/65 text-[#F5EFE4]/80 hover:text-[#F5EFE4] hover:border-[#E2BE7D] font-mono-meta text-[10px] uppercase tracking-[0.22em] transition-colors"
        >
          Skip →
        </button>
      )}
    </div>
  );
};
