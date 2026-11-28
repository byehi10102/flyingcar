import * as THREE from 'three';
import { BuildingCollider, ElevatedSurface } from '../types/game';
import { WorldTextureSet } from './ProceduralTextures';

export class CityWorld {
  public group: THREE.Group;
  public colliders: BuildingCollider[] = [];
  public elevatedSurfaces: ElevatedSurface[] = [];
  private spatialGrid: Map<string, BuildingCollider[]> = new Map();
  private readonly cellSize = 80;

  constructor() {
    this.group = new THREE.Group();
  }

  public addCollider(c: BuildingCollider) {
    this.colliders.push(c);
    const minGX = Math.floor(c.minX / this.cellSize);
    const maxGX = Math.floor(c.maxX / this.cellSize);
    const minGZ = Math.floor(c.minZ / this.cellSize);
    const maxGZ = Math.floor(c.maxZ / this.cellSize);

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const key = `${gx},${gz}`;
        let list = this.spatialGrid.get(key);
        if (!list) {
          list = [];
          this.spatialGrid.set(key, list);
        }
        list.push(c);
      }
    }
  }

  public queryCollidersNear(x: number, z: number, radius: number): BuildingCollider[] {
    const minGX = Math.floor((x - radius) / this.cellSize);
    const maxGX = Math.floor((x + radius) / this.cellSize);
    const minGZ = Math.floor((z - radius) / this.cellSize);
    const maxGZ = Math.floor((z + radius) / this.cellSize);

    const seen = new Set<number>();
    const results: BuildingCollider[] = [];

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const list = this.spatialGrid.get(`${gx},${gz}`);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      }
    }
    return results;
  }

  public isWaterAt(x: number, z: number): boolean {
    if (x > 225 && x < 575) return true;
    if (x < -980) return true;
    if (z > 1550) return true;
    if (x > -310 && x < -150 && z > -290 && z < -110) return true;
    return false;
  }

  public getDistrictName(x: number, z: number): string {
    if (x > 220 && x < 580) {
      if (Math.abs(z) < 45) return 'BROOKLYN SUSPENSION BRIDGE';
      if (Math.abs(z + 560) < 45) return 'QUEENSBORO CANTILEVER BRIDGE';
      return 'EAST RIVER WATERWAY';
    }
    if (x >= 580) {
      if (x > 1020 && z > -850 && z < 650) return 'JFK BAYSIDE INTERNATIONAL AIRPORT';
      if (z > 420) return 'RED HOOK INDUSTRIAL & FREIGHT PORT';
      if (z < -420) return 'LONG ISLAND CITY MODERN CONDOS & RAIL';
      if (x < 720) return 'DUMBO WATERFRONT & MARINA PIERS';
      return 'BROOKLYN HEIGHTS BROWNSTONE DISTRICT';
    }
    if (x < -980) return 'HUDSON RIVER WATERFRONT';
    if (x > -375 && x < -95 && z > -550 && z < 50) return 'CENTRAL PARK CONSERVANCY';
    if (z > 620) return 'LOWER MANHATTAN FINANCIAL DISTRICT';
    if (z < -650) return 'UPPER MANHATTAN & METROPOLITAN STADIUM';
    if (Math.abs(x - 165) < 22 && z > -1100 && z < 1100) return 'FDR ELEVATED EXPRESSWAY';
    if (Math.abs(z - 380) < 22 && x > -480 && x < -120) return 'MIDTOWN CROSS-TOWN TUNNEL';
    return 'MIDTOWN MANHATTAN SKYSCRAPER CANYON';
  }
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface InstanceTransform {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry?: number;
}

function buildInstancedBoxes(
  items: InstanceTransform[],
  material: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, items.length));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(0, it.ry || 0, 0);
    dummy.scale.set(it.sx, it.sy, it.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  if (items.length === 0) {
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(0, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildInstancedCylinders(
  items: InstanceTransform[],
  material: THREE.Material,
  castShadow = true
): THREE.InstancedMesh {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, items.length));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(0, it.ry || 0, 0);
    dummy.scale.set(it.sx, it.sy, it.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  if (items.length === 0) {
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(0, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildEntireCity(textures: WorldTextureSet): CityWorld {
  const world = new CityWorld();
  const rand = seededRandom(4202026);
  let nextColliderId = 1;

  // Materials
  const matGlassBlue = new THREE.MeshStandardMaterial({
    map: textures.glassTowerBlue,
    roughness: 0.16,
    metalness: 0.72,
    envMap: textures.envMap,
    envMapIntensity: 1.15,
  });

  const matGlassDark = new THREE.MeshStandardMaterial({
    map: textures.glassTowerDark,
    roughness: 0.14,
    metalness: 0.8,
    envMap: textures.envMap,
    envMapIntensity: 1.25,
  });

  const matLimestone = new THREE.MeshStandardMaterial({
    map: textures.limestoneFacade,
    roughness: 0.58,
    metalness: 0.15,
    envMap: textures.envMap,
    envMapIntensity: 0.4,
  });

  const matModernCondo = new THREE.MeshStandardMaterial({
    map: textures.modernCondoFacade,
    roughness: 0.3,
    metalness: 0.45,
    envMap: textures.envMap,
    envMapIntensity: 0.75,
  });

  const matBrownstone = new THREE.MeshStandardMaterial({
    map: textures.brownstoneFacade,
    roughness: 0.75,
    metalness: 0.08,
  });

  const matIndustrial = new THREE.MeshStandardMaterial({
    map: textures.industrialFacade,
    roughness: 0.65,
    metalness: 0.35,
  });

  const matRoofConcrete = new THREE.MeshStandardMaterial({
    color: 0x454b52,
    roughness: 0.85,
    metalness: 0.1,
  });

  const matSteelDark = new THREE.MeshStandardMaterial({
    color: 0x2b323b,
    roughness: 0.42,
    metalness: 0.75,
    envMap: textures.envMap,
  });

  const matBridgeStone = new THREE.MeshStandardMaterial({
    color: 0x8d8478,
    roughness: 0.8,
    metalness: 0.1,
  });

  const matWhitePaint = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const matCraneYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5, metalness: 0.4 });
  const matWaterTowerWood = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.85 });
  const matIndustrialTank = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4, metalness: 0.5 });
  const matSignalGreen = new THREE.MeshBasicMaterial({ color: 0x10b981 });

  // 1. BASE OCEAN / EAST RIVER WATER PLANE & LANDMASS PLATES
  const waterGeo = new THREE.PlaneGeometry(7600, 7600);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x12466e,
    roughness: 0.18,
    metalness: 0.65,
    envMap: textures.envMap,
    envMapIntensity: 1.1,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = -1.6;
  waterMesh.receiveShadow = true;
  world.group.add(waterMesh);

  const roadRepeatMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltRoad,
    roughness: 0.82,
    metalness: 0.08,
  });
  textures.asphaltRoad.repeat.set(90, 180);

  const manhattanGround = new THREE.Mesh(new THREE.BoxGeometry(1205, 2.0, 3400), roadRepeatMat);
  manhattanGround.position.set(-377.5, -1.0, -150);
  manhattanGround.receiveShadow = true;
  world.group.add(manhattanGround);

  const seawallMat = new THREE.MeshStandardMaterial({ color: 0x6c737a, roughness: 0.85 });
  const manhattanSeawall = new THREE.Mesh(new THREE.BoxGeometry(1215, 2.3, 3410), seawallMat);
  manhattanSeawall.position.set(-377.5, -1.25, -150);
  world.group.add(manhattanSeawall);

  const brooklynGround = new THREE.Mesh(new THREE.BoxGeometry(1625, 2.0, 3400), roadRepeatMat);
  brooklynGround.position.set(1387.5, -1.0, -150);
  brooklynGround.receiveShadow = true;
  world.group.add(brooklynGround);

  const brooklynSeawall = new THREE.Mesh(new THREE.BoxGeometry(1635, 2.3, 3410), seawallMat);
  brooklynSeawall.position.set(1387.5, -1.25, -150);
  world.group.add(brooklynSeawall);

  // Instance buckets for batched high-speed rendering
  const glassBlueBoxes: InstanceTransform[] = [];
  const glassDarkBoxes: InstanceTransform[] = [];
  const limestoneBoxes: InstanceTransform[] = [];
  const modernCondoBoxes: InstanceTransform[] = [];
  const brownstoneBoxes: InstanceTransform[] = [];
  const industrialBoxes: InstanceTransform[] = [];
  const roofCapBoxes: InstanceTransform[] = [];
  const sidewalkBoxes: InstanceTransform[] = [];
  const steelDetailBoxes: InstanceTransform[] = [];
  const crosswalkStripes: InstanceTransform[] = [];
  const craneYellowBoxes: InstanceTransform[] = [];
  const waterTowerCylinders: InstanceTransform[] = [];
  const industrialTankCylinders: InstanceTransform[] = [];
  const signalLightBoxes: InstanceTransform[] = [];
  const treeTrunks: InstanceTransform[] = [];
  const treeCanopies: InstanceTransform[] = [];
  const streetLights: InstanceTransform[] = [];

  const addBuilding = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    style: 'glassBlue' | 'glassDark' | 'limestone' | 'condo' | 'brownstone' | 'industrial',
    district: string,
    withSetbacks = true
  ) => {
    const pickBucket = () => {
      switch (style) {
        case 'glassBlue':
          return glassBlueBoxes;
        case 'glassDark':
          return glassDarkBoxes;
        case 'limestone':
          return limestoneBoxes;
        case 'condo':
          return modernCondoBoxes;
        case 'brownstone':
          return brownstoneBoxes;
        case 'industrial':
          return industrialBoxes;
      }
    };
    const bucket = pickBucket();

    if (withSetbacks && h > 95) {
      const h1 = h * 0.55;
      const h2 = h * 0.3;
      const h3 = h * 0.15;
      bucket.push({ x: cx, y: h1 / 2, z: cz, sx: w, sy: h1, sz: d });
      bucket.push({ x: cx, y: h1 + h2 / 2, z: cz, sx: w * 0.82, sy: h2, sz: d * 0.82 });
      bucket.push({ x: cx, y: h1 + h2 + h3 / 2, z: cz, sx: w * 0.64, sy: h3, sz: d * 0.64 });

      const topW = w * 0.64;
      const topD = d * 0.64;
      roofCapBoxes.push({ x: cx, y: h + 0.6, z: cz, sx: topW + 0.8, sy: 1.2, sz: topD + 0.8 });

      if (rand() > 0.42) {
        const spireH = 18 + rand() * 38;
        steelDetailBoxes.push({ x: cx, y: h + spireH / 2, z: cz, sx: 0.9, sy: spireH, sz: 0.9 });
      }

      world.addCollider({
        id: nextColliderId++,
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
        baseY: 0,
        topY: h,
        isLandableRoof: true,
        district,
      });
    } else {
      bucket.push({ x: cx, y: h / 2, z: cz, sx: w, sy: h, sz: d });
      roofCapBoxes.push({ x: cx, y: h + 0.4, z: cz, sx: w + 0.6, sy: 0.8, sz: d + 0.6 });

      if (h > 14 && h < 75 && rand() > 0.45) {
        // Classic NYC wooden rooftop water tower!
        const wx = cx + (rand() - 0.5) * (w * 0.45);
        const wz = cz + (rand() - 0.5) * (d * 0.45);
        steelDetailBoxes.push({ x: wx, y: h + 1.2, z: wz, sx: 2.2, sy: 2.4, sz: 2.2 });
        waterTowerCylinders.push({ x: wx, y: h + 3.8, z: wz, sx: 3.2, sy: 3.4, sz: 3.2 });
      } else if (h > 16 && rand() > 0.35) {
        const eqW = Math.min(5, w * 0.25);
        const eqH = 2.8 + rand() * 2.5;
        roofCapBoxes.push({
          x: cx + (rand() - 0.5) * (w * 0.4),
          y: h + eqH / 2,
          z: cz + (rand() - 0.5) * (d * 0.4),
          sx: eqW,
          sy: eqH,
          sz: eqW,
        });
      }

      world.addCollider({
        id: nextColliderId++,
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
        baseY: 0,
        topY: h + 0.8,
        isLandableRoof: true,
        district,
      });
    }
  };

  // ============================================================================
  // 2. CENTRAL PARK (x: -375 to -95, z: -550 to +50)
  // ============================================================================
  const parkMat = new THREE.MeshStandardMaterial({
    map: textures.grassPark,
    roughness: 0.9,
  });
  textures.grassPark.repeat.set(16, 32);

  const centralParkLawn = new THREE.Mesh(new THREE.BoxGeometry(276, 0.35, 596), parkMat);
  centralParkLawn.position.set(-235, 0.15, -250);
  centralParkLawn.receiveShadow = true;
  world.group.add(centralParkLawn);

  const lakeWater = new THREE.Mesh(
    new THREE.BoxGeometry(140, 0.42, 160),
    new THREE.MeshStandardMaterial({
      color: 0x16537e,
      roughness: 0.12,
      metalness: 0.75,
      envMap: textures.envMap,
    })
  );
  lakeWater.position.set(-230, 0.22, -200);
  world.group.add(lakeWater);

  // Walking paths through Central Park
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 });
  const parkPathNS = new THREE.Mesh(new THREE.BoxGeometry(8, 0.38, 580), pathMat);
  parkPathNS.position.set(-130, 0.18, -250);
  world.group.add(parkPathNS);

  const infieldMat = new THREE.MeshStandardMaterial({ color: 0xb5895b, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const diamond = new THREE.Mesh(new THREE.BoxGeometry(28, 0.45, 28), infieldMat);
    diamond.position.set(-280 + i * 52, 0.22, -430);
    diamond.rotation.y = Math.PI / 4;
    world.group.add(diamond);
  }

  for (let i = 0; i < 280; i++) {
    const tx = -365 + rand() * 260;
    const tz = -540 + rand() * 580;
    if (tx > -308 && tx < -152 && tz > -288 && tz < -112) continue;
    const th = 7 + rand() * 6;
    treeTrunks.push({ x: tx, y: th * 0.3, z: tz, sx: 0.9, sy: th * 0.6, sz: 0.9 });
    treeCanopies.push({ x: tx, y: th * 0.78, z: tz, sx: 5.5 + rand() * 3, sy: th * 0.65, sz: 5.5 + rand() * 3 });
  }

  // ============================================================================
  // 3. MANHATTAN GRID & STREETSCAPE DETAILS (CROSSWALKS, TRAFFIC SIGNALS, LAMPS)
  // ============================================================================
  const manhattanBlockXs = [-900, -780, -660, -540, -430, -320, -200, -42, 42, 112];
  const manhattanBlockZs: number[] = [];
  for (let z = -1500; z <= 1350; z += 95) {
    manhattanBlockZs.push(z);
  }

  // Add Zebra Crosswalk Stripes & Traffic Signals along Grand 5th Avenue (x = 0) & adjacent avenues
  for (const bz of manhattanBlockZs) {
    const interZ = bz + 47.5;
    for (let s = -11; s <= 11; s += 2.6) {
      crosswalkStripes.push({ x: s, y: 0.04, z: interZ - 11, sx: 1.3, sy: 0.05, sz: 4.2 });
      crosswalkStripes.push({ x: s, y: 0.04, z: interZ + 11, sx: 1.3, sy: 0.05, sz: 4.2 });
    }
    // Traffic signal mast arm at avenue intersection
    steelDetailBoxes.push({ x: 14.5, y: 3.6, z: interZ - 13, sx: 0.38, sy: 7.2, sz: 0.38 });
    steelDetailBoxes.push({ x: 10.5, y: 6.8, z: interZ - 13, sx: 8.2, sy: 0.28, sz: 0.28 });
    signalLightBoxes.push({ x: 8.2, y: 6.4, z: interZ - 13, sx: 0.45, sy: 0.95, sz: 0.45 });
  }

  for (const bx of manhattanBlockXs) {
    for (const bz of manhattanBlockZs) {
      if (bx > -380 && bx < -90 && bz > -560 && bz < 60) continue;
      if (Math.abs(bz - 380) < 48 && bx > -520 && bx < -90) continue;
      if (bx > -800 && bx < -420 && bz > -1200 && bz < -800) continue;
      if ((Math.abs(bz) < 55 || Math.abs(bz + 560) < 55) && bx > 55) continue;

      // Dedicated Midtown Construction Zone at (bx = 42, bz = 95) with Tower Crane & Steel Girder Frame!
      if (bx === 42 && bz === 95) {
        sidewalkBoxes.push({ x: bx, y: 0.2, z: bz, sx: 56, sy: 0.4, sz: 72 });
        // Open steel girder skeleton under construction
        for (let lvl = 10; lvl <= 70; lvl += 15) {
          craneYellowBoxes.push({ x: bx, y: lvl, z: bz, sx: 38, sy: 0.9, sz: 44 });
        }
        // Yellow Tower Crane rising 145m above the construction site
        craneYellowBoxes.push({ x: bx, y: 72, z: bz, sx: 2.8, sy: 144, sz: 2.8 });
        craneYellowBoxes.push({ x: bx + 16, y: 142, z: bz, sx: 54, sy: 2.2, sz: 2.2 });
        world.addCollider({
          id: nextColliderId++,
          minX: bx - 19,
          maxX: bx + 19,
          minZ: bz - 22,
          maxZ: bz + 22,
          baseY: 0,
          topY: 72,
          isLandableRoof: true,
          district: 'MIDTOWN CONSTRUCTION ZONE',
        });
        continue;
      }

      const blockW = bx === -42 || bx === 42 ? 48 : 66;
      const blockD = 64;

      sidewalkBoxes.push({ x: bx, y: 0.2, z: bz, sx: blockW + 8, sy: 0.4, sz: blockD + 8 });

      streetLights.push({ x: bx - blockW / 2 - 2.5, y: 4.5, z: bz - blockD / 2 - 2.5, sx: 0.35, sy: 9, sz: 0.35 });
      streetLights.push({ x: bx + blockW / 2 + 2.5, y: 4.5, z: bz + blockD / 2 + 2.5, sx: 0.35, sy: 9, sz: 0.35 });

      const distFromMidtown = Math.hypot(bx * 0.7, bz + 80);
      const distFromFinancial = Math.hypot(bx * 0.8, bz - 880);

      let maxH = 65;
      let districtLabel = 'MIDTOWN MANHATTAN';
      if (distFromMidtown < 420) {
        maxH = 290 - distFromMidtown * 0.38;
        districtLabel = 'MIDTOWN MANHATTAN SKYSCRAPER CANYON';
      } else if (distFromFinancial < 380) {
        maxH = 310 - distFromFinancial * 0.45;
        districtLabel = 'LOWER MANHATTAN FINANCIAL DISTRICT';
      } else if (bz < -650) {
        maxH = 95;
        districtLabel = 'UPPER MANHATTAN';
      } else {
        maxH = 120;
      }

      const subCount = maxH > 160 && rand() > 0.45 ? 2 : 4;
      if (subCount === 2) {
        for (let s = -1; s <= 1; s += 2) {
          const w = blockW * 0.84;
          const d = blockD * 0.42;
          const h = Math.max(28, maxH * (0.55 + rand() * 0.65));
          const stylePick = rand();
          const style =
            stylePick < 0.38
              ? 'glassBlue'
              : stylePick < 0.72
              ? 'glassDark'
              : stylePick < 0.9
              ? 'limestone'
              : 'condo';
          addBuilding(bx, bz + s * (blockD * 0.25), w, d, h, style, districtLabel, true);
        }
      } else {
        for (let sx = -1; sx <= 1; sx += 2) {
          for (let sz = -1; sz <= 1; sz += 2) {
            const w = blockW * 0.42;
            const d = blockD * 0.42;
            const h = Math.max(22, maxH * (0.35 + rand() * 0.75));
            const stylePick = rand();
            const style =
              stylePick < 0.32
                ? 'glassBlue'
                : stylePick < 0.6
                ? 'glassDark'
                : stylePick < 0.82
                ? 'limestone'
                : 'condo';
            addBuilding(
              bx + sx * (blockW * 0.25),
              bz + sz * (blockD * 0.25),
              w,
              d,
              h,
              style,
              districtLabel,
              h > 110
            );
          }
        }
      }
    }
  }

  // ============================================================================
  // 4. ICONIC LANDMARK SUPERTALL SKYSCRAPERS IN MANHATTAN
  // ============================================================================
  addBuilding(-52, -185, 46, 46, 385, 'limestone', 'MIDTOWN EMPIRE TOWER', true);
  steelDetailBoxes.push({ x: -52, y: 385 + 38, z: -185, sx: 2.2, sy: 76, sz: 2.2 });

  addBuilding(52, -340, 48, 48, 415, 'glassBlue', 'MIDTOWN WORLD PLAZA', true);
  steelDetailBoxes.push({ x: 52, y: 415 + 42, z: -340, sx: 1.8, sy: 84, sz: 1.8 });

  addBuilding(-48, 820, 50, 50, 395, 'glassDark', 'LOWER MANHATTAN FINANCIAL DISTRICT', true);

  // ============================================================================
  // 5. GRAND BROOKLYN SUSPENSION BRIDGE (z = 0) & QUEENSBORO BRIDGE (z = -560)
  // ============================================================================
  const buildBridge = (bridgeZ: number, isSuspension: boolean, bridgeId: string) => {
    const startX = 75;
    const endX = 725;
    const length = endX - startX;
    const deckWidth = 28;
    const peakHeight = 22;

    const getBridgeY = (x: number): number => {
      if (x < startX || x > endX) return 0;
      if (x < 215) {
        const t = (x - startX) / (215 - startX);
        return peakHeight * (t * t * (3 - 2 * t));
      }
      if (x > 585) {
        const t = (endX - x) / (endX - 585);
        return peakHeight * (t * t * (3 - 2 * t));
      }
      return peakHeight;
    };

    world.elevatedSurfaces.push({
      id: bridgeId,
      minX: startX,
      maxX: endX,
      minZ: bridgeZ - deckWidth / 2,
      maxZ: bridgeZ + deckWidth / 2,
      surfaceType: 'BRIDGE',
      getHeightAt: (x: number, z: number) => {
        if (x < startX || x > endX || Math.abs(z - bridgeZ) > deckWidth / 2) return null;
        return getBridgeY(x);
      },
      getNormalAt: (x: number) => {
        const dx = 1.0;
        const y1 = getBridgeY(Math.max(startX, x - dx));
        const y2 = getBridgeY(Math.min(endX, x + dx));
        const slope = (y2 - y1) / (2 * dx);
        return new THREE.Vector3(-slope, 1, 0).normalize();
      },
    });

    const segments = 36;
    const segLen = length / segments;
    for (let i = 0; i < segments; i++) {
      const x1 = startX + i * segLen;
      const x2 = x1 + segLen;
      const xm = (x1 + x2) / 2;
      const y1 = getBridgeY(x1);
      const y2 = getBridgeY(x2);
      const ym = (y1 + y2) / 2;
      const angleZ = Math.atan2(y2 - y1, segLen);

      const segMesh = new THREE.Mesh(
        new THREE.BoxGeometry(segLen + 0.6, 1.4, deckWidth),
        roadRepeatMat
      );
      segMesh.position.set(xm, ym - 0.7, bridgeZ);
      segMesh.rotation.z = angleZ;
      segMesh.receiveShadow = true;
      segMesh.castShadow = true;
      world.group.add(segMesh);

      steelDetailBoxes.push({
        x: xm,
        y: ym + 0.8,
        z: bridgeZ - deckWidth / 2 + 0.6,
        sx: segLen,
        sy: 1.4,
        sz: 0.8,
      });
      steelDetailBoxes.push({
        x: xm,
        y: ym + 0.8,
        z: bridgeZ + deckWidth / 2 - 0.6,
        sx: segLen,
        sy: 1.4,
        sz: 0.8,
      });
    }

    const towerXs = [285, 515];
    const towerH = isSuspension ? 112 : 88;
    for (const tx of towerXs) {
      const legOffsetZ = deckWidth / 2 + 3.2;
      const legMat = isSuspension ? matBridgeStone : matSteelDark;

      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(10, towerH, 6.5), legMat);
      leftLeg.position.set(tx, towerH / 2 - 2, bridgeZ - legOffsetZ);
      leftLeg.castShadow = true;
      world.group.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(10, towerH, 6.5), legMat);
      rightLeg.position.set(tx, towerH / 2 - 2, bridgeZ + legOffsetZ);
      rightLeg.castShadow = true;
      world.group.add(rightLeg);

      world.addCollider({
        id: nextColliderId++,
        minX: tx - 5,
        maxX: tx + 5,
        minZ: bridgeZ - legOffsetZ - 3.25,
        maxZ: bridgeZ - legOffsetZ + 3.25,
        baseY: -2,
        topY: towerH,
        isLandableRoof: true,
        district: 'EAST RIVER BRIDGE TOWER',
      });
      world.addCollider({
        id: nextColliderId++,
        minX: tx - 5,
        maxX: tx + 5,
        minZ: bridgeZ + legOffsetZ - 3.25,
        maxZ: bridgeZ + legOffsetZ + 3.25,
        baseY: -2,
        topY: towerH,
        isLandableRoof: true,
        district: 'EAST RIVER BRIDGE TOWER',
      });

      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 8, deckWidth + 13), legMat);
      topBeam.position.set(tx, towerH - 6, bridgeZ);
      world.group.add(topBeam);

      const midBeam = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6, deckWidth + 13), legMat);
      midBeam.position.set(tx, 58, bridgeZ);
      world.group.add(midBeam);
    }

    for (let x = 180; x <= 620; x += 14) {
      let cableY = towerH - 6;
      if (x < 285) {
        const t = (x - 180) / (285 - 180);
        cableY = 24 + (towerH - 30) * (t * t);
      } else if (x <= 515) {
        const u = (x - 400) / 115;
        cableY = 32 + (towerH - 38) * (u * u);
      } else {
        const t = (620 - x) / (620 - 515);
        cableY = 24 + (towerH - 30) * (t * t);
      }

      const suspH = Math.max(2, cableY - peakHeight);
      for (const side of [-1, 1]) {
        const cz = bridgeZ + side * (deckWidth / 2 + 1.2);
        steelDetailBoxes.push({
          x,
          y: peakHeight + suspH / 2,
          z: cz,
          sx: 0.35,
          sy: suspH,
          sz: 0.35,
        });
        steelDetailBoxes.push({
          x,
          y: cableY,
          z: cz,
          sx: 14.5,
          sy: 1.1,
          sz: 1.1,
        });
      }
    }
  };

  buildBridge(0, true, 'BROOKLYN_SUSPENSION_BRIDGE');
  buildBridge(-560, false, 'QUEENSBORO_TRUSS_BRIDGE');

  // ============================================================================
  // 6. FDR ELEVATED EXPRESSWAY (x = 165, z = -1100 to +1100) WITH ON/OFF RAMPS
  // ============================================================================
  const fdrX = 165;
  const fdrW = 20;
  const fdrElev = 13.5;
  const fdrStartZ = -1100;
  const fdrEndZ = 1100;

  const getFdrHeight = (z: number): number => {
    if (z < fdrStartZ || z > fdrEndZ) return 0;
    if (z > 920) {
      const t = (fdrEndZ - z) / (fdrEndZ - 920);
      return fdrElev * t;
    }
    if (z < -920) {
      const t = (z - fdrStartZ) / (-920 - fdrStartZ);
      return fdrElev * t;
    }
    return fdrElev;
  };

  world.elevatedSurfaces.push({
    id: 'FDR_ELEVATED_HIGHWAY',
    minX: fdrX - fdrW / 2,
    maxX: fdrX + fdrW / 2,
    minZ: fdrStartZ,
    maxZ: fdrEndZ,
    surfaceType: 'HIGHWAY',
    getHeightAt: (x: number, z: number) => {
      if (Math.abs(x - fdrX) > fdrW / 2 || z < fdrStartZ || z > fdrEndZ) return null;
      return getFdrHeight(z);
    },
  });

  const fdrDeck = new THREE.Mesh(new THREE.BoxGeometry(fdrW, 1.2, 1840), roadRepeatMat);
  fdrDeck.position.set(fdrX, fdrElev - 0.6, 0);
  fdrDeck.receiveShadow = true;
  fdrDeck.castShadow = true;
  world.group.add(fdrDeck);

  for (const dir of [-1, 1]) {
    const rampLen = 180;
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(fdrW, 1.2, rampLen + 2), roadRepeatMat);
    const rz = dir * 1010;
    rampMesh.position.set(fdrX, fdrElev / 2 - 0.6, rz);
    rampMesh.rotation.x = dir * Math.atan2(fdrElev, rampLen);
    world.group.add(rampMesh);
  }

  for (let z = -900; z <= 900; z += 45) {
    if (Math.abs(z) < 30 || Math.abs(z + 560) < 30) continue;
    steelDetailBoxes.push({ x: fdrX - 7.5, y: fdrElev / 2, z, sx: 1.6, sy: fdrElev, sz: 1.6 });
    steelDetailBoxes.push({ x: fdrX + 7.5, y: fdrElev / 2, z, sx: 1.6, sy: fdrElev, sz: 1.6 });
  }

  // ============================================================================
  // 7. MIDTOWN CROSS-TOWN ENCLOSED 3D TUNNEL (z = 380, x = -480 to -120)
  // ============================================================================
  const tunnelZ = 380;
  const tunnelMinX = -480;
  const tunnelMaxX = -120;
  const tunnelLen = tunnelMaxX - tunnelMinX;
  const tunnelW = 26;
  const tunnelH = 14;

  const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen, 2.5, tunnelW + 6), matRoofConcrete);
  tunnelRoof.position.set((tunnelMinX + tunnelMaxX) / 2, tunnelH + 1.25, tunnelZ);
  tunnelRoof.receiveShadow = true;
  tunnelRoof.castShadow = true;
  world.group.add(tunnelRoof);

  for (const side of [-1, 1]) {
    const wallZ = tunnelZ + side * (tunnelW / 2 + 1.5);
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen, tunnelH, 3), matRoofConcrete);
    wallMesh.position.set((tunnelMinX + tunnelMaxX) / 2, tunnelH / 2, wallZ);
    world.group.add(wallMesh);

    world.addCollider({
      id: nextColliderId++,
      minX: tunnelMinX,
      maxX: tunnelMaxX,
      minZ: wallZ - 1.5,
      maxZ: wallZ + 1.5,
      baseY: 0,
      topY: tunnelH + 2.5,
      isLandableRoof: true,
      district: 'MIDTOWN CROSS-TUNNEL',
    });
  }

  world.elevatedSurfaces.push({
    id: 'MIDTOWN_TUNNEL_ROOF',
    minX: tunnelMinX,
    maxX: tunnelMaxX,
    minZ: tunnelZ - tunnelW / 2,
    maxZ: tunnelZ + tunnelW / 2,
    surfaceType: 'TUNNEL',
    ceilingY: tunnelH,
    getHeightAt: (x: number, z: number) => {
      if (x < tunnelMinX || x > tunnelMaxX || Math.abs(z - tunnelZ) > tunnelW / 2) return null;
      return tunnelH + 2.5;
    },
  });

  // ============================================================================
  // 8. METROPOLITAN SPORTS STADIUM (x = -610, z = -1000)
  // ============================================================================
  const stadX = -610;
  const stadZ = -1000;
  const stadField = new THREE.Mesh(new THREE.BoxGeometry(130, 0.5, 170), parkMat);
  stadField.position.set(stadX, 0.25, stadZ);
  world.group.add(stadField);

  addBuilding(stadX, stadZ - 102, 160, 32, 34, 'condo', 'METROPOLITAN STADIUM', false);
  addBuilding(stadX, stadZ + 102, 160, 32, 34, 'condo', 'METROPOLITAN STADIUM', false);
  addBuilding(stadX - 82, stadZ, 32, 170, 34, 'condo', 'METROPOLITAN STADIUM', false);
  addBuilding(stadX + 82, stadZ, 32, 170, 34, 'condo', 'METROPOLITAN STADIUM', false);

  // ============================================================================
  // 9. BROOKLYN DISTRICTS: DUMBO PIERS, BROWNSTONES, INDUSTRIAL PORT & TANKS
  // ============================================================================
  for (let pz = -750; pz <= 750; pz += 150) {
    if (Math.abs(pz) < 60 || Math.abs(pz + 560) < 60) continue;
    sidewalkBoxes.push({ x: 255, y: 0.4, z: pz, sx: 65, sy: 1.2, sz: 24 });
    sidewalkBoxes.push({ x: 540, y: 0.4, z: pz, sx: 75, sy: 1.2, sz: 28 });
    addBuilding(542, pz, 52, 18, 12, 'industrial', 'DUMBO WATERFRONT PIERS', false);
  }

  const brooklynXs = [640, 740, 840, 940];
  for (const bx of brooklynXs) {
    for (let bz = -1350; bz <= 1250; bz += 88) {
      if (Math.abs(bz) < 52 || Math.abs(bz + 560) < 52) continue;

      const blockW = 58;
      const blockD = 56;
      sidewalkBoxes.push({ x: bx, y: 0.2, z: bz, sx: blockW + 6, sy: 0.4, sz: blockD + 6 });

      if (bz > 420) {
        // RED HOOK INDUSTRIAL PORT: Warehouses, cylindrical tanks, smokestacks
        addBuilding(
          bx,
          bz,
          blockW * 0.78,
          blockD * 0.68,
          14 + rand() * 14,
          'industrial',
          'RED HOOK INDUSTRIAL DISTRICT',
          false
        );
        // Cylindrical Refinery / Fuel Storage Tanks
        if (rand() > 0.4) {
          industrialTankCylinders.push({
            x: bx + 18,
            y: 9,
            z: bz + 18,
            sx: 14,
            sy: 18,
            sz: 14,
          });
        }
      } else if (bz < -420) {
        const h = 45 + rand() * 85;
        addBuilding(
          bx,
          bz,
          blockW * 0.72,
          blockD * 0.72,
          h,
          rand() > 0.4 ? 'condo' : 'glassBlue',
          'BROOKLYN MODERN CONDOS',
          h > 95
        );
      } else {
        for (let row = -1; row <= 1; row += 2) {
          const rowZ = bz + row * (blockD * 0.28);
          const h = 15 + rand() * 9;
          addBuilding(
            bx,
            rowZ,
            blockW * 0.86,
            blockD * 0.34,
            h,
            'brownstone',
            'BROOKLYN HEIGHTS BROWNSTONES',
            false
          );
          for (let st = -22; st <= 22; st += 11) {
            roofCapBoxes.push({
              x: bx + st,
              y: 1.6,
              z: rowZ + row * (blockD * 0.19),
              sx: 3.2,
              sy: 3.2,
              sz: 4.2,
            });
          }
        }
        treeTrunks.push({ x: bx - 26, y: 2.5, z: bz - 28, sx: 0.7, sy: 5, sz: 0.7 });
        treeCanopies.push({ x: bx - 26, y: 6.2, z: bz - 28, sx: 5.2, sy: 5.2, sz: 5.2 });
        treeTrunks.push({ x: bx + 26, y: 2.5, z: bz + 28, sx: 0.7, sy: 5, sz: 0.7 });
        treeCanopies.push({ x: bx + 26, y: 6.2, z: bz + 28, sx: 5.2, sy: 5.2, sz: 5.2 });
      }
    }
  }

  // Elevated Rail Viaduct running along x = 790 in Brooklyn
  for (let rz = -1200; rz <= 1000; rz += 40) {
    steelDetailBoxes.push({ x: 790, y: 9.5, z: rz, sx: 9, sy: 1.2, sz: 40.5 });
    steelDetailBoxes.push({ x: 786.5, y: 4.5, z: rz, sx: 1.1, sy: 9, sz: 1.1 });
    steelDetailBoxes.push({ x: 793.5, y: 4.5, z: rz, sx: 1.1, sy: 9, sz: 1.1 });
  }

  // ============================================================================
  // 10. JFK / BAYSIDE INTERNATIONAL AIRPORT & RUNWAYS (x = 1060 to 1650)
  // ============================================================================
  const runwayMat = new THREE.MeshStandardMaterial({
    map: textures.runwaySurface,
    roughness: 0.75,
    metalness: 0.1,
  });
  textures.runwaySurface.repeat.set(1, 10);

  const mainRunway = new THREE.Mesh(new THREE.BoxGeometry(58, 0.3, 1500), runwayMat);
  mainRunway.position.set(1320, 0.12, -100);
  mainRunway.receiveShadow = true;
  world.group.add(mainRunway);

  world.elevatedSurfaces.push({
    id: 'JFK_MAIN_RUNWAY',
    minX: 1291,
    maxX: 1349,
    minZ: -850,
    maxZ: 650,
    surfaceType: 'RUNWAY',
    getHeightAt: (x: number, z: number) => {
      if (x >= 1291 && x <= 1349 && z >= -850 && z <= 650) return 0.25;
      return null;
    },
  });

  const crossRunway = new THREE.Mesh(new THREE.BoxGeometry(52, 0.28, 520), runwayMat);
  crossRunway.rotation.y = Math.PI / 2;
  crossRunway.position.set(1380, 0.11, 320);
  crossRunway.receiveShadow = true;
  world.group.add(crossRunway);

  addBuilding(1135, -180, 68, 220, 22, 'glassBlue', 'JFK AIRPORT TERMINAL', false);
  addBuilding(1135, 110, 64, 95, 24, 'industrial', 'JFK AIRCRAFT HANGAR 1', false);
  addBuilding(1135, 240, 64, 95, 24, 'industrial', 'JFK AIRCRAFT HANGAR 2', false);
  addBuilding(1145, -340, 18, 18, 118, 'condo', 'JFK AIR TRAFFIC CONTROL TOWER', true);

  // ============================================================================
  // 11. DISTANT PERIMETER SKYLINE TOWERS FOR MASSIVE HORIZON CONTINUITY
  // ============================================================================
  for (let i = 0; i < 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    const dist = 1750 + (i % 3) * 220;
    const dx = Math.cos(angle) * dist;
    const dz = Math.sin(angle) * dist;
    if (dx > 200 && dx < 600) continue;
    const h = 45 + (i % 7) * 28;
    glassDarkBoxes.push({ x: dx, y: h / 2, z: dz, sx: 55, sy: h, sz: 55 });
  }

  // Assemble all batched InstancedMeshes into the scene
  world.group.add(buildInstancedBoxes(glassBlueBoxes, matGlassBlue));
  world.group.add(buildInstancedBoxes(glassDarkBoxes, matGlassDark));
  world.group.add(buildInstancedBoxes(limestoneBoxes, matLimestone));
  world.group.add(buildInstancedBoxes(modernCondoBoxes, matModernCondo));
  world.group.add(buildInstancedBoxes(brownstoneBoxes, matBrownstone));
  world.group.add(buildInstancedBoxes(industrialBoxes, matIndustrial));
  world.group.add(buildInstancedBoxes(roofCapBoxes, matRoofConcrete));
  world.group.add(
    buildInstancedBoxes(
      sidewalkBoxes,
      new THREE.MeshStandardMaterial({ map: textures.sidewalkConcrete, roughness: 0.85 }),
      false,
      true
    )
  );
  world.group.add(buildInstancedBoxes(steelDetailBoxes, matSteelDark));
  world.group.add(buildInstancedBoxes(crosswalkStripes, matWhitePaint, false, true));
  world.group.add(buildInstancedBoxes(craneYellowBoxes, matCraneYellow));
  world.group.add(buildInstancedCylinders(waterTowerCylinders, matWaterTowerWood));
  world.group.add(buildInstancedCylinders(industrialTankCylinders, matIndustrialTank));
  world.group.add(buildInstancedBoxes(signalLightBoxes, matSignalGreen, false, false));

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2e6f2e, roughness: 0.82 });
  world.group.add(buildInstancedBoxes(treeTrunks, trunkMat, false, false));
  world.group.add(buildInstancedBoxes(treeCanopies, canopyMat, true, true));
  world.group.add(buildInstancedBoxes(streetLights, matSteelDark, false, false));

  return world;
}
