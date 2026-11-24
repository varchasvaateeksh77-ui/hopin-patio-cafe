import * as THREE from 'three';
import { SHEETS, type SubcategoryRoom } from '../data/cafeData';
import { getSheetCellBox } from './galleryMath';
import {
  ARCH_RING_COUNT,
  computeTunnelArch,
  MONOLITH_Z,
  OCULUS_WORLD_X,
  OCULUS_WORLD_Y,
  SLICE_COUNT,
} from './heroPortalMath';

export interface Hero3DSceneHandles {
  scene: THREE.Scene;
  louverMeshes: THREE.Mesh[];
  monolithGroup: THREE.Group;
  oculusRingGroup: THREE.Group;
  dispose: () => void;
}

const FLOOR_Y = -3.4;

/**
 * Generates a crisp procedural geometric patio tile albedo texture (SRGB)
 * inspired by Hopin Patio Cafe's real indoor diamond-tile floor in New Palasia.
 */
function createPatioTileTexture(
  maxAnisotropy: number,
  baseDarkHex = '#091B1A',
  tileAHex = '#0E2423',
  tileBHex = '#132C2B'
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep matte patio-teal stone grout base
    ctx.fillStyle = baseDarkHex;
    ctx.fillRect(0, 0, size, size);

    const cells = 4;
    const step = size / cells;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const x = c * step;
        const y = r * step;
        const isAlt = (r + c) % 2 === 0;

        ctx.fillStyle = isAlt ? tileAHex : tileBHex;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

        // Signature Hopin geometric diamond inlay
        ctx.beginPath();
        ctx.moveTo(x + step / 2, y + 10);
        ctx.lineTo(x + step - 10, y + step / 2);
        ctx.lineTo(x + step / 2, y + step - 10);
        ctx.lineTo(x + 10, y + step / 2);
        ctx.closePath();
        ctx.fillStyle = isAlt ? 'rgba(217, 180, 114, 0.16)' : 'rgba(245, 239, 228, 0.08)';
        ctx.fill();

        // Crisp hairline brass tile border
        ctx.strokeStyle = 'rgba(217, 180, 114, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 22);
  texture.anisotropy = Math.min(8, maxAnisotropy);
  return texture;
}

/**
 * Creates a thick extruded 3D Roman-patio arch surround as a single continuous
 * hole-free polygon (guaranteed crisp triangulation with a wide open vaulted arch).
 */
function createArchSurroundShape(
  outerHalfW: number,
  topY: number,
  bottomY: number,
  innerHalfW: number,
  springY: number
): THREE.Shape {
  const s = new THREE.Shape();
  // Outer perimeter clockwise from bottom-left -> top-left -> top-right -> bottom-right
  s.moveTo(-outerHalfW, bottomY);
  s.lineTo(-outerHalfW, topY);
  s.lineTo(outerHalfW, topY);
  s.lineTo(outerHalfW, bottomY);
  // Step inward to right inner arch jamb, rise to spring line, sweep semicircle to left jamb
  s.lineTo(innerHalfW, bottomY);
  s.lineTo(innerHalfW, springY);
  s.absarc(0, springY, innerHalfW, 0, Math.PI, false);
  s.lineTo(-innerHalfW, bottomY);
  s.closePath();
  return s;
}

/**
 * Creates a slender extruded 3D brushed-brass arch molding rib following the vault opening.
 */
function createBrassArchRibShape(
  innerHalfW: number,
  ribThickness: number,
  bottomY: number,
  springY: number
): THREE.Shape {
  const outerR = innerHalfW + ribThickness;
  const shape = new THREE.Shape();
  shape.moveTo(-outerR, bottomY);
  shape.lineTo(-outerR, springY);
  shape.absarc(0, springY, outerR, Math.PI, 0, true);
  shape.lineTo(outerR, bottomY);
  shape.lineTo(innerHalfW, bottomY);
  shape.lineTo(innerHalfW, springY);
  shape.absarc(0, springY, innerHalfW, 0, Math.PI, false);
  shape.lineTo(-innerHalfW, bottomY);
  shape.closePath();
  return shape;
}

/**
 * Procedural 3D geometric letter shapes ("H", "P", "I", "N") for zero-404 extruded brass signage.
 * Centered vertically around y = 0, height ~ 2.45 units.
 */
function buildLetterHShape(): THREE.Shape {
  const w = 1.48;
  const h = 2.42;
  const t = 0.32;
  const hw = w / 2;
  const hh = h / 2;
  const barY = 0.14;
  const barH = 0.28;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(-hw + t, -hh);
  s.lineTo(-hw + t, barY - barH / 2);
  s.lineTo(hw - t, barY - barH / 2);
  s.lineTo(hw - t, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.lineTo(hw - t, hh);
  s.lineTo(hw - t, barY + barH / 2);
  s.lineTo(-hw + t, barY + barH / 2);
  s.lineTo(-hw + t, hh);
  s.lineTo(-hw, hh);
  s.closePath();
  return s;
}

function buildLetterPShape(): THREE.Shape {
  const w = 1.42;
  const h = 2.42;
  const t = 0.32;
  const hw = w / 2;
  const hh = h / 2;
  const bowlBottom = -0.06;
  const bowlMidY = (hh + bowlBottom) / 2;
  const outerR = (hh - bowlBottom) / 2;
  const straightRight = hw - outerR;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(-hw + t, -hh);
  s.lineTo(-hw + t, bowlBottom);
  s.lineTo(straightRight, bowlBottom);
  s.absarc(straightRight, bowlMidY, outerR, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hw, hh);
  s.closePath();

  const innerR = outerR - t;
  const hole = new THREE.Path();
  // Clockwise inner cutout matching CCW outer contour
  hole.moveTo(-hw + t, hh - t);
  hole.lineTo(straightRight, hh - t);
  hole.absarc(straightRight, bowlMidY, innerR, Math.PI / 2, -Math.PI / 2, true);
  hole.lineTo(-hw + t, bowlBottom + t);
  hole.closePath();
  s.holes.push(hole);

  return s;
}

function buildLetterIShape(): THREE.Shape {
  const w = 0.36;
  const h = 2.42;
  const hw = w / 2;
  const hh = h / 2;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.closePath();
  return s;
}

function buildLetterNShape(): THREE.Shape {
  const w = 1.56;
  const h = 2.42;
  const t = 0.3;
  const hw = w / 2;
  const hh = h / 2;

  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(-hw + t, -hh);
  s.lineTo(-hw + t, hh - 0.62);
  s.lineTo(hw - t, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, hh);
  s.lineTo(hw - t, hh);
  s.lineTo(hw - t, -hh + 0.62);
  s.lineTo(-hw + t, hh);
  s.lineTo(-hw, hh);
  s.closePath();
  return s;
}

/**
 * Builds the entire composite 3D Hopin Architectural Colonnade & Brass "H [◯] P I N" Oculus World.
 */
export function buildHero3DScene(
  photoUrl: string,
  maxAnisotropy: number,
  onPhotoLoaded: () => void
): Hero3DSceneHandles {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071514);
  scene.fog = new THREE.FogExp2(0x071514, 0.036);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- Shared Architectural PBR Materials (varied roughness >= 0.25 across adjacent surfaces) ---
  const plasterTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0a1e1d,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.16,
    })
  );

  const portalFacadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x061312,
      roughness: 0.88,
      metalness: 0.03,
      envMapIntensity: 0.14,
    })
  );

  const terracottaPlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6e3320,
      roughness: 0.88,
      metalness: 0.03,
      envMapIntensity: 0.2,
    })
  );

  const pergolaTimberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x261912,
      roughness: 0.74,
      metalness: 0.05,
      envMapIntensity: 0.18,
    })
  );

  const brushedBrassFaceMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe2be7d,
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      envMapIntensity: 1.3,
    })
  );

  const burnishedBronzeSideMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8e6b37,
      metalness: 0.84,
      roughness: 0.38,
      envMapIntensity: 1.15,
    })
  );

  const brassTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9b472,
      metalness: 0.9,
      roughness: 0.26,
      envMapIntensity: 1.25,
    })
  );

  // --- 3-Point Architectural Twilight Lighting Rig + Warm Colonnade Cove Rhythm ---
  const hemiLight = new THREE.HemisphereLight(0x7fb0aa, 0x24150d, 0.48);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe1b0, 2.0);
  keyLight.position.set(7, 12, 18);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x5fa69f, 0.7);
  rimLight.position.set(-9, 6, 10);
  scene.add(rimLight);

  // Warm tungsten courtyard glow spilling forward through the open "O" oculus onto the brass bevels
  const courtyardBacklight = new THREE.PointLight(0xffbd72, 22, 22, 1.4);
  courtyardBacklight.position.set(OCULUS_WORLD_X, OCULUS_WORLD_Y + 0.4, MONOLITH_Z + 2.2);
  scene.add(courtyardBacklight);

  // Subtle architectural cove lights giving warm brass specular glints down the receding colonnade
  const coveLightA = new THREE.PointLight(0xffd79e, 14, 18, 1.5);
  coveLightA.position.set(0, 3.6, 15.5);
  scene.add(coveLightA);

  const coveLightB = new THREE.PointLight(0xffd094, 14, 16, 1.5);
  coveLightB.position.set(0, 3.2, 8.5);
  scene.add(coveLightB);

  // --- 1. Geometric Patterned Patio Courtyard Floor ---
  const floorTex = createPatioTileTexture(maxAnisotropy);
  textures.push(floorTex);
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.52,
      metalness: 0.14,
      envMapIntensity: 0.28,
    })
  );
  const floorGeo = trackGeo(new THREE.PlaneGeometry(34, 46));
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, FLOOR_Y, 12);
  scene.add(floorMesh);

  // Brushed brass floor runner guide rails leading the eye straight toward the O portal
  const railGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.03, 30));
  const leftRail = new THREE.Mesh(railGeo, brassTrimMat);
  leftRail.position.set(-4.15, FLOOR_Y + 0.02, 13.5);
  scene.add(leftRail);
  const rightRail = new THREE.Mesh(railGeo, brassTrimMat);
  rightRail.position.set(4.15, FLOOR_Y + 0.02, 13.5);
  scene.add(rightRail);

  // --- 2. Nine Composite 3D Vaulted Patio Colonnade Archways ---
  const archShape = createArchSurroundShape(9.5, 6.2, FLOOR_Y, 4.2, 1.45);
  const archGeo = trackGeo(
    new THREE.ExtrudeGeometry(archShape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.045,
      bevelSegments: 2,
      curveSegments: 28,
    })
  );
  archGeo.translate(0, 0, -0.25);

  const ribShape = createBrassArchRibShape(4.16, 0.11, FLOOR_Y, 1.45);
  const ribGeo = trackGeo(
    new THREE.ExtrudeGeometry(ribShape, {
      depth: 0.58,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 28,
    })
  );
  ribGeo.translate(0, 0, -0.29);

  const plinthGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.85, 0.92));
  const rafterGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.24, 2.52));

  for (let i = 0; i < ARCH_RING_COUNT; i++) {
    const bayPose = computeTunnelArch(i, 0, ARCH_RING_COUNT);
    const bayGroup = new THREE.Group();
    bayGroup.position.set(0, 0, bayPose.z);

    // Primary silhouette: extruded patio-teal masonry arch
    const archMesh = new THREE.Mesh(archGeo, plasterTealMat);
    bayGroup.add(archMesh);

    // Secondary read: inset brushed brass arch molding
    const ribMesh = new THREE.Mesh(ribGeo, brassTrimMat);
    bayGroup.add(ribMesh);

    // Grounded terracotta base plinths flush on FLOOR_Y
    const leftPlinth = new THREE.Mesh(plinthGeo, terracottaPlinthMat);
    leftPlinth.position.set(-4.62, FLOOR_Y + 0.425, 0);
    bayGroup.add(leftPlinth);

    const rightPlinth = new THREE.Mesh(plinthGeo, terracottaPlinthMat);
    rightPlinth.position.set(4.62, FLOOR_Y + 0.425, 0);
    bayGroup.add(rightPlinth);

    // Overhead heritage timber pergola rafters connecting bays
    if (i < ARCH_RING_COUNT - 1) {
      for (let r = -2; r <= 2; r++) {
        const rafter = new THREE.Mesh(rafterGeo, pergolaTimberMat);
        rafter.position.set(r * 1.45, 5.45 - Math.abs(r) * 0.25, -1.25);
        bayGroup.add(rafter);
      }
    }

    scene.add(bayGroup);
  }

  // --- 3. Monumental 3D Architectural Wall + Extruded Beveled Brass "H [◯] P I N" Monolith ---
  const monolithGroup = new THREE.Group();
  monolithGroup.position.set(0, 0, MONOLITH_Z);
  scene.add(monolithGroup);

  // Solid matte patio-teal architectural wall with a precision oval aperture cut for the "O"
  const oculusRx = 1.04;
  const oculusRy = 1.32;
  const facadeShape = new THREE.Shape();
  facadeShape.moveTo(-16, -10);
  facadeShape.lineTo(16, -10);
  facadeShape.lineTo(16, 10);
  facadeShape.lineTo(-16, 10);
  facadeShape.closePath();

  const oculusHole = new THREE.Path();
  oculusHole.absellipse(OCULUS_WORLD_X, OCULUS_WORLD_Y, oculusRx, oculusRy, 0, Math.PI * 2, true, 0);
  facadeShape.holes.push(oculusHole);

  const facadeGeo = trackGeo(
    new THREE.ExtrudeGeometry(facadeShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 48,
    })
  );
  facadeGeo.translate(0, 0, -0.44);
  const facadeMesh = new THREE.Mesh(facadeGeo, portalFacadeMat);
  monolithGroup.add(facadeMesh);

  // Sculptural 3-part 3D Brushed-Brass "O" Oculus Ring (camera flies physically through this ring!)
  const oculusRingGroup = new THREE.Group();
  oculusRingGroup.position.set(OCULUS_WORLD_X, OCULUS_WORLD_Y, 0.08);
  monolithGroup.add(oculusRingGroup);

  // Outer sculpted brass torus stretched into architectural oval matching the cutout
  const mainTorusGeo = trackGeo(new THREE.TorusGeometry(1.13, 0.145, 22, 64));
  const mainTorus = new THREE.Mesh(mainTorusGeo, brushedBrassFaceMat);
  mainTorus.scale.set(oculusRx / 1.0, oculusRy / 1.0, 1.85);
  oculusRingGroup.add(mainTorus);

  // Stepped inner bronze collar ring for multi-plane relief
  const innerCollarGeo = trackGeo(new THREE.TorusGeometry(1.01, 0.042, 16, 64));
  const innerCollar = new THREE.Mesh(innerCollarGeo, burnishedBronzeSideMat);
  innerCollar.scale.set(oculusRx / 1.0, oculusRy / 1.0, 1.3);
  innerCollar.position.z = 0.18;
  oculusRingGroup.add(innerCollar);

  // Four brass architectural drafting fins around 12/3/6/9 o'clock of the Oculus
  const vFinGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.34, 0.18));
  const hFinGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.045, 0.18));
  const topFin = new THREE.Mesh(vFinGeo, brassTrimMat);
  topFin.position.set(0, oculusRy + 0.32, 0.06);
  oculusRingGroup.add(topFin);
  const bottomFin = new THREE.Mesh(vFinGeo, brassTrimMat);
  bottomFin.position.set(0, -(oculusRy + 0.32), 0.06);
  oculusRingGroup.add(bottomFin);
  const leftFin = new THREE.Mesh(hFinGeo, brassTrimMat);
  leftFin.position.set(-(oculusRx + 0.28), 0, 0.06);
  oculusRingGroup.add(leftFin);
  const rightFin = new THREE.Mesh(hFinGeo, brassTrimMat);
  rightFin.position.set(oculusRx + 0.28, 0, 0.06);
  oculusRingGroup.add(rightFin);

  // Real extruded 3D beveled brass letters: H [◯] P I N
  const letterExtrude: THREE.ExtrudeGeometryOptions = {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.036,
    bevelSegments: 3,
    curveSegments: 24,
  };
  const letterMaterials = [brushedBrassFaceMat, burnishedBronzeSideMat];

  const lettersSpec: Array<{ shape: THREE.Shape; x: number }> = [
    { shape: buildLetterHShape(), x: -3.55 },
    { shape: buildLetterPShape(), x: 0.58 },
    { shape: buildLetterIShape(), x: 1.88 },
    { shape: buildLetterNShape(), x: 3.3 },
  ];

  for (const spec of lettersSpec) {
    const geo = trackGeo(new THREE.ExtrudeGeometry(spec.shape, letterExtrude));
    geo.translate(0, 0, -0.08);
    const mesh = new THREE.Mesh(geo, letterMaterials);
    mesh.position.set(spec.x, OCULUS_WORLD_Y, 0);
    monolithGroup.add(mesh);
  }

  // Subtle horizontal brass architectural datum line below the monolith
  const datumGeo = trackGeo(new THREE.BoxGeometry(8.2, 0.03, 0.12));
  const datumBar = new THREE.Mesh(datumGeo, brassTrimMat);
  datumBar.position.set(-0.08, -1.78, 0.06);
  monolithGroup.add(datumBar);

  // --- 4. Physical 3D Rotating Photographic Venetian Louvers inside the O Portal ---
  // Positioned behind the solid monolith wall so you gaze through the 3D O directly onto
  // the twilight Hopin courtyard assembling in real 3D louver space!
  const louverW = 7.4;
  const louverH = 5.4;
  const stripW = louverW / SLICE_COUNT;
  const louverMeshes: THREE.Mesh[] = [];

  const loader = new THREE.TextureLoader();
  const courtyardTex = loader.load(photoUrl, () => {
    onPhotoLoaded();
  });
  courtyardTex.colorSpace = THREE.SRGBColorSpace;
  courtyardTex.anisotropy = Math.min(8, maxAnisotropy);
  textures.push(courtyardTex);

  // Warm dark backing wall behind the louvers
  const backGeo = trackGeo(new THREE.PlaneGeometry(14, 10));
  const backMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x061211,
    })
  );
  const backPlane = new THREE.Mesh(backGeo, backMat);
  backPlane.position.set(OCULUS_WORLD_X, OCULUS_WORLD_Y, MONOLITH_Z - 3.6);
  scene.add(backPlane);

  for (let i = 0; i < SLICE_COUNT; i++) {
    const slatGeo = trackGeo(new THREE.BoxGeometry(stripW + 0.008, louverH, 0.06));
    // Remap front face (+Z, material index 4) UVs cleanly to slice i of the Hopin bungalow photo
    const uvAttr = slatGeo.attributes.uv;
    const u0 = i / SLICE_COUNT;
    const u1 = (i + 1) / SLICE_COUNT;
    // BoxGeometry face 4 (+Z front) uses vertices 16..19
    uvAttr.setXY(16, u0, 1);
    uvAttr.setXY(17, u1, 1);
    uvAttr.setXY(18, u0, 0);
    uvAttr.setXY(19, u1, 0);
    uvAttr.needsUpdate = true;

    const photoFaceMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: courtyardTex,
      })
    );

    // Brass-edged Venetian slat sides + real photographic front face
    const slatMats = [
      brassTrimMat,
      brassTrimMat,
      brassTrimMat,
      brassTrimMat,
      photoFaceMat,
      plasterTealMat,
    ];

    const mesh = new THREE.Mesh(slatGeo, slatMats);
    const xPos = OCULUS_WORLD_X - louverW / 2 + stripW * (i + 0.5);
    mesh.position.set(xPos, OCULUS_WORLD_Y, MONOLITH_Z - 3.0);
    scene.add(mesh);
    louverMeshes.push(mesh);
  }

  return {
    scene,
    louverMeshes,
    monolithGroup,
    oculusRingGroup,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

/**
 * Crops the exact bespoke vegetarian culinary cell from the room's sprite sheet onto a
 * crisp offscreen CanvasTexture so the 8 physical 3D Venetian louvers inside any Gate Oculus
 * display that gate's authentic artwork with zero sprite-sheet bleeding.
 */
function createCroppedRoomTexture(
  room: SubcategoryRoom,
  maxAnisotropy: number,
  onLoaded: () => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = room.gatewaySurface || '#0D2221';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy);

  const sheet = SHEETS[room.sheetId];
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (ctx) {
      const crop = getSheetCellBox(sheet, room.cellIndex);
      const scaleX = img.naturalWidth / sheet.width;
      const scaleY = img.naturalHeight / sheet.height;
      const sx = crop.x * scaleX;
      const sy = crop.y * scaleY;
      const sw = crop.w * scaleX;
      const sh = crop.h * scaleY;

      // Center-crop square cover fit so the oval 3D gate oculus frames the dish richly
      const srcAspect = sw / sh;
      let drawW = canvas.width;
      let drawH = canvas.height;
      let drawX = 0;
      let drawY = 0;
      if (srcAspect > 1) {
        drawW = canvas.height * srcAspect;
        drawX = -(drawW - canvas.width) / 2;
      } else {
        drawH = canvas.width / srcAspect;
        drawY = -(drawH - canvas.height) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, drawW, drawH);

      // Subtle architectural warm vignette at outer edges
      const grad = ctx.createRadialGradient(384, 384, 180, 384, 384, 460);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(6,16,15,0.34)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
    }
    onLoaded();
  };
  img.src = sheet.url;
  return texture;
}

/**
 * Builds a custom-themed Three.js WebGL 3D Architectural Colonnade & Centered Sculpted Brass
 * Gate Oculus Fly-Through tailored to any of Hopin's 12 Culinary Gates.
 */
export function buildGate3DScene(
  room: SubcategoryRoom,
  maxAnisotropy: number,
  onPhotoLoaded: () => void
): Hero3DSceneHandles {
  // Derive rich architectural twilight palette preserving each gate's unique hue & warmth
  // while keeping stone luminance deep enough that brushed brass & ivory inscriptions pop cleanly
  const rawHue = new THREE.Color(room.plaqueAccent || room.gatewaySurface || '#0E2423');
  const surfaceColor = new THREE.Color(room.gatewaySurface || '#0E2423');
  const hsl = { h: 0, s: 0, l: 0 };
  surfaceColor.getHSL(hsl);
  if (hsl.s < 0.14) {
    // Pale ivory rooms inherit their architectural hue from plaqueAccent / frameColor
    const accentHsl = { h: 0, s: 0, l: 0 };
    rawHue.getHSL(accentHsl);
    hsl.h = accentHsl.h;
    hsl.s = Math.min(0.42, Math.max(0.18, accentHsl.s * 0.72));
  }
  const nightStone = new THREE.Color().setHSL(hsl.h, Math.min(0.45, hsl.s * 0.85), 0.075);
  const archStone = new THREE.Color().setHSL(hsl.h, Math.min(0.48, hsl.s * 0.9), 0.135);
  const plinthTint = new THREE.Color(room.frameColor || '#6E3320').lerp(
    new THREE.Color(0x5c2b1a),
    0.45
  );
  const accentWarm = new THREE.Color(room.plaqueAccent || '#D9B472').lerp(
    new THREE.Color(0xe2be7d),
    0.58
  );

  const scene = new THREE.Scene();
  scene.background = nightStone.clone();
  scene.fog = new THREE.FogExp2(nightStone.getHex(), 0.036);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const plasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: archStone,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.16,
    })
  );

  const facadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: nightStone.clone().multiplyScalar(0.82),
      roughness: 0.88,
      metalness: 0.03,
      envMapIntensity: 0.14,
    })
  );

  const plinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: plinthTint,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.2,
    })
  );

  const pergolaTimberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x241710,
      roughness: 0.74,
      metalness: 0.05,
      envMapIntensity: 0.18,
    })
  );

  const brushedBrassFaceMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: accentWarm,
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
      envMapIntensity: 1.32,
    })
  );

  const burnishedBronzeSideMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentWarm.clone().multiplyScalar(0.62),
      metalness: 0.84,
      roughness: 0.38,
      envMapIntensity: 1.15,
    })
  );

  const brassTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentWarm.clone().lerp(new THREE.Color(0xd9b472), 0.35),
      metalness: 0.9,
      roughness: 0.26,
      envMapIntensity: 1.25,
    })
  );

  // 3-Point Twilight Lighting Rig + Warm Oculus Spill
  const hemiLight = new THREE.HemisphereLight(0x88bab4, 0x26160e, 0.5);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe1b0, 2.05);
  keyLight.position.set(7, 12, 18);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(accentWarm.getHex(), 0.75);
  rimLight.position.set(-9, 6, 10);
  scene.add(rimLight);

  const oculusBacklight = new THREE.PointLight(0xffc37a, 24, 22, 1.4);
  oculusBacklight.position.set(0, OCULUS_WORLD_Y + 0.4, MONOLITH_Z + 2.2);
  scene.add(oculusBacklight);

  const coveLightA = new THREE.PointLight(0xffd79e, 14, 18, 1.5);
  coveLightA.position.set(0, 3.6, 14.5);
  scene.add(coveLightA);

  const coveLightB = new THREE.PointLight(0xffd094, 14, 16, 1.5);
  coveLightB.position.set(0, 3.2, 8.0);
  scene.add(coveLightB);

  // 1. Geometric Patterned Floor tinted subtly to match this Gate
  const darkHex = `#${nightStone.getHexString()}`;
  const tileAHex = `#${archStone.getHexString()}`;
  const tileBHex = `#${archStone.clone().offsetHSL(0, 0, 0.04).getHexString()}`;
  const floorTex = createPatioTileTexture(maxAnisotropy, darkHex, tileAHex, tileBHex);
  textures.push(floorTex);
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.52,
      metalness: 0.14,
      envMapIntensity: 0.28,
    })
  );
  const floorGeo = trackGeo(new THREE.PlaneGeometry(34, 46));
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, FLOOR_Y, 12);
  scene.add(floorMesh);

  // Floor brass runner guide rails
  const railGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.03, 30));
  const leftRail = new THREE.Mesh(railGeo, brassTrimMat);
  leftRail.position.set(-4.15, FLOOR_Y + 0.02, 13.5);
  scene.add(leftRail);
  const rightRail = new THREE.Mesh(railGeo, brassTrimMat);
  rightRail.position.set(4.15, FLOOR_Y + 0.02, 13.5);
  scene.add(rightRail);

  // 2. Nine Vaulted Colonnade Bays
  const archShape = createArchSurroundShape(9.5, 6.2, FLOOR_Y, 4.2, 1.45);
  const archGeo = trackGeo(
    new THREE.ExtrudeGeometry(archShape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.045,
      bevelSegments: 2,
      curveSegments: 28,
    })
  );
  archGeo.translate(0, 0, -0.25);

  const ribShape = createBrassArchRibShape(4.16, 0.11, FLOOR_Y, 1.45);
  const ribGeo = trackGeo(
    new THREE.ExtrudeGeometry(ribShape, {
      depth: 0.58,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 28,
    })
  );
  ribGeo.translate(0, 0, -0.29);

  const plinthGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.85, 0.92));
  const rafterGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.24, 2.52));

  for (let i = 0; i < ARCH_RING_COUNT; i++) {
    const bayPose = computeTunnelArch(i, 0, ARCH_RING_COUNT);
    const bayGroup = new THREE.Group();
    bayGroup.position.set(0, 0, bayPose.z);

    bayGroup.add(new THREE.Mesh(archGeo, plasterMat));
    bayGroup.add(new THREE.Mesh(ribGeo, brassTrimMat));

    const leftPlinth = new THREE.Mesh(plinthGeo, plinthMat);
    leftPlinth.position.set(-4.62, FLOOR_Y + 0.425, 0);
    bayGroup.add(leftPlinth);

    const rightPlinth = new THREE.Mesh(plinthGeo, plinthMat);
    rightPlinth.position.set(4.62, FLOOR_Y + 0.425, 0);
    bayGroup.add(rightPlinth);

    if (i < ARCH_RING_COUNT - 1) {
      for (let r = -2; r <= 2; r++) {
        const rafter = new THREE.Mesh(rafterGeo, pergolaTimberMat);
        rafter.position.set(r * 1.45, 5.45 - Math.abs(r) * 0.25, -1.25);
        bayGroup.add(rafter);
      }
    }

    scene.add(bayGroup);
  }

  // 3. Symmetrical Monumental Gate Facade + Centered 3D Brass Oculus Ring (x = 0)
  const monolithGroup = new THREE.Group();
  monolithGroup.position.set(0, 0, MONOLITH_Z);
  scene.add(monolithGroup);

  const oculusRx = 1.24;
  const oculusRy = 1.56;
  const facadeShape = new THREE.Shape();
  facadeShape.moveTo(-16, -10);
  facadeShape.lineTo(16, -10);
  facadeShape.lineTo(16, 10);
  facadeShape.lineTo(-16, 10);
  facadeShape.closePath();

  const oculusHole = new THREE.Path();
  oculusHole.absellipse(0, OCULUS_WORLD_Y, oculusRx, oculusRy, 0, Math.PI * 2, true, 0);
  facadeShape.holes.push(oculusHole);

  const facadeGeo = trackGeo(
    new THREE.ExtrudeGeometry(facadeShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 48,
    })
  );
  facadeGeo.translate(0, 0, -0.44);
  monolithGroup.add(new THREE.Mesh(facadeGeo, facadeMat));

  // Centered Sculptural 3D Brushed-Brass Gate Oculus
  const oculusRingGroup = new THREE.Group();
  oculusRingGroup.position.set(0, OCULUS_WORLD_Y, 0.08);
  monolithGroup.add(oculusRingGroup);

  const mainTorusGeo = trackGeo(new THREE.TorusGeometry(1.13, 0.145, 22, 64));
  const mainTorus = new THREE.Mesh(mainTorusGeo, brushedBrassFaceMat);
  mainTorus.scale.set(oculusRx / 1.0, oculusRy / 1.0, 1.85);
  oculusRingGroup.add(mainTorus);

  const innerCollarGeo = trackGeo(new THREE.TorusGeometry(1.01, 0.045, 16, 64));
  const innerCollar = new THREE.Mesh(innerCollarGeo, burnishedBronzeSideMat);
  innerCollar.scale.set(oculusRx / 1.0, oculusRy / 1.0, 1.35);
  innerCollar.position.z = 0.18;
  oculusRingGroup.add(innerCollar);

  // Outer architectural brass halo ring + 4 cardinal compass fins
  const outerTrimGeo = trackGeo(new THREE.TorusGeometry(1.33, 0.028, 12, 64));
  const outerTrim = new THREE.Mesh(outerTrimGeo, brassTrimMat);
  outerTrim.scale.set(oculusRx / 1.0, oculusRy / 1.0, 1.1);
  outerTrim.position.z = 0.04;
  oculusRingGroup.add(outerTrim);

  const vFinGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.42, 0.18));
  const hFinGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.05, 0.18));
  const topFin = new THREE.Mesh(vFinGeo, brassTrimMat);
  topFin.position.set(0, oculusRy + 0.42, 0.06);
  oculusRingGroup.add(topFin);
  const bottomFin = new THREE.Mesh(vFinGeo, brassTrimMat);
  bottomFin.position.set(0, -(oculusRy + 0.42), 0.06);
  oculusRingGroup.add(bottomFin);
  const leftFin = new THREE.Mesh(hFinGeo, brassTrimMat);
  leftFin.position.set(-(oculusRx + 0.36), 0, 0.06);
  oculusRingGroup.add(leftFin);
  const rightFin = new THREE.Mesh(hFinGeo, brassTrimMat);
  rightFin.position.set(oculusRx + 0.36, 0, 0.06);
  oculusRingGroup.add(rightFin);

  // Flanking sculptural 3D extruded brass gate pilasters + horizontal datum lintels
  const pilasterGeo = trackGeo(new THREE.BoxGeometry(0.24, 3.6, 0.34));
  const pilasterInnerGeo = trackGeo(new THREE.BoxGeometry(0.07, 3.2, 0.42));
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pilasterGeo, burnishedBronzeSideMat);
    p.position.set(side * 2.75, OCULUS_WORLD_Y, 0.04);
    monolithGroup.add(p);

    const flute = new THREE.Mesh(pilasterInnerGeo, brushedBrassFaceMat);
    flute.position.set(side * 2.56, OCULUS_WORLD_Y, 0.08);
    monolithGroup.add(flute);
  }

  const lintelGeo = trackGeo(new THREE.BoxGeometry(5.8, 0.055, 0.18));
  const topLintel = new THREE.Mesh(lintelGeo, brassTrimMat);
  topLintel.position.set(0, OCULUS_WORLD_Y + 2.15, 0.08);
  monolithGroup.add(topLintel);
  const bottomLintel = new THREE.Mesh(lintelGeo, brassTrimMat);
  bottomLintel.position.set(0, OCULUS_WORLD_Y - 2.15, 0.08);
  monolithGroup.add(bottomLintel);

  // 4. Physical 3D Rotating Photographic Louver Slats showing this Gate's bespoke dish portrait
  const louverW = 6.4;
  const louverH = 5.8;
  const stripW = louverW / SLICE_COUNT;
  const louverMeshes: THREE.Mesh[] = [];

  const dishTex = createCroppedRoomTexture(room, maxAnisotropy, onPhotoLoaded);
  textures.push(dishTex);

  const backGeo = trackGeo(new THREE.PlaneGeometry(14, 10));
  const backMat = trackMat(new THREE.MeshBasicMaterial({ color: nightStone.getHex() }));
  const backPlane = new THREE.Mesh(backGeo, backMat);
  backPlane.position.set(0, OCULUS_WORLD_Y, MONOLITH_Z - 3.6);
  scene.add(backPlane);

  for (let i = 0; i < SLICE_COUNT; i++) {
    const slatGeo = trackGeo(new THREE.BoxGeometry(stripW + 0.008, louverH, 0.06));
    const uvAttr = slatGeo.attributes.uv;
    const u0 = i / SLICE_COUNT;
    const u1 = (i + 1) / SLICE_COUNT;
    uvAttr.setXY(16, u0, 1);
    uvAttr.setXY(17, u1, 1);
    uvAttr.setXY(18, u0, 0);
    uvAttr.setXY(19, u1, 0);
    uvAttr.needsUpdate = true;

    const photoFaceMat = trackMat(new THREE.MeshBasicMaterial({ map: dishTex }));
    const slatMats = [
      brassTrimMat,
      brassTrimMat,
      brassTrimMat,
      brassTrimMat,
      photoFaceMat,
      plasterMat,
    ];

    const mesh = new THREE.Mesh(slatGeo, slatMats);
    const xPos = -louverW / 2 + stripW * (i + 0.5);
    mesh.position.set(xPos, OCULUS_WORLD_Y, MONOLITH_Z - 2.8);
    scene.add(mesh);
    louverMeshes.push(mesh);
  }

  return {
    scene,
    louverMeshes,
    monolithGroup,
    oculusRingGroup,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
