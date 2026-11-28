import * as THREE from 'three';

export interface WorldTextureSet {
  envMap: THREE.CubeTexture;
  glassTowerBlue: THREE.CanvasTexture;
  glassTowerDark: THREE.CanvasTexture;
  limestoneFacade: THREE.CanvasTexture;
  modernCondoFacade: THREE.CanvasTexture;
  brownstoneFacade: THREE.CanvasTexture;
  industrialFacade: THREE.CanvasTexture;
  asphaltRoad: THREE.CanvasTexture;
  runwaySurface: THREE.CanvasTexture;
  sidewalkConcrete: THREE.CanvasTexture;
  grassPark: THREE.CanvasTexture;
  carbonFiber: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function createEnvCubeTexture(): THREE.CubeTexture {
  const size = 256;
  const canvases: HTMLCanvasElement[] = [];

  for (let face = 0; face < 6; face++) {
    const [canvas, ctx] = makeCanvas(size, size);

    if (face === 2) {
      // +Y Top zenith sky
      const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
      grad.addColorStop(0, '#1e64b4');
      grad.addColorStop(1, '#3b82d6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    } else if (face === 3) {
      // -Y Bottom ground bounce
      ctx.fillStyle = '#20262e';
      ctx.fillRect(0, 0, size, size);
    } else {
      // Side horizon faces (+X, -X, +Z, -Z)
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#1e64b4');
      grad.addColorStop(0.42, '#5aa0e6');
      grad.addColorStop(0.53, '#b8d8f8');
      grad.addColorStop(0.56, '#dcebf7');
      grad.addColorStop(0.57, '#343d48');
      grad.addColorStop(1.0, '#181d24');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Add subtle city skyline silhouette on the horizon for realistic car body reflections
      ctx.fillStyle = '#26303d';
      for (let x = 0; x < size; x += 14) {
        const h = 12 + ((x * 37 + face * 53) % 38);
        ctx.fillRect(x, size * 0.56 - h, 12, h + 10);
      }
    }
    canvases.push(canvas);
  }

  const cubeTexture = new THREE.CubeTexture(canvases);
  cubeTexture.needsUpdate = true;
  return cubeTexture;
}

function createSkyscraperGlassTexture(
  baseColor: string,
  MullionColor: string,
  windowTint1: string,
  windowTint2: string,
  cols = 8,
  rows = 16
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 1024);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 1024);

  const cellW = 512 / cols;
  const cellH = 1024 / rows;

  for (let r = 0; r < rows; r++) {
    // Floor spandrel band
    ctx.fillStyle = MullionColor;
    ctx.fillRect(0, r * cellH, 512, cellH * 0.18);

    for (let c = 0; c < cols; c++) {
      const hash = ((r * 31 + c * 17) * 73) % 100;
      const grad = ctx.createLinearGradient(c * cellW, r * cellH, (c + 1) * cellW, (r + 1) * cellH);
      grad.addColorStop(0, hash > 45 ? windowTint1 : windowTint2);
      grad.addColorStop(1, baseColor);
      ctx.fillStyle = grad;
      ctx.fillRect(c * cellW + 3, r * cellH + cellH * 0.18 + 2, cellW - 6, cellH * 0.82 - 4);

      // Interior blinds / subtle daylight reflection highlight
      if (hash % 5 === 0) {
        ctx.fillStyle = 'rgba(210, 232, 255, 0.22)';
        ctx.fillRect(c * cellW + 5, r * cellH + cellH * 0.2, cellW - 10, cellH * 0.32);
      } else if (hash % 7 === 0) {
        ctx.fillStyle = 'rgba(15, 25, 38, 0.35)';
        ctx.fillRect(c * cellW + 5, r * cellH + cellH * 0.2, cellW - 10, cellH * 0.75);
      }
    }
  }

  // Vertical mullions
  ctx.fillStyle = MullionColor;
  for (let c = 0; c <= cols; c++) {
    ctx.fillRect(c * cellW - 2, 0, 4, 1024);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createLimestoneFacadeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#c8bfae';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 6;
  const rows = 8;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  // Stone courses and recessed windows
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = '#b4aa97';
    ctx.fillRect(0, r * cellH, 512, 5);
    for (let c = 0; c < cols; c++) {
      // Window recess shadow
      ctx.fillStyle = '#8b8170';
      ctx.fillRect(c * cellW + 12, r * cellH + 10, cellW - 24, cellH - 18);
      // Window glass
      const bright = (r * 13 + c * 29) % 3 === 0;
      ctx.fillStyle = bright ? '#4a6b88' : '#2a3d52';
      ctx.fillRect(c * cellW + 15, r * cellH + 13, cellW - 30, cellH - 24);
      // Window muntin bar
      ctx.fillStyle = '#d4ccb9';
      ctx.fillRect(c * cellW + 15, r * cellH + cellH * 0.5, cellW - 30, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBrownstoneFacadeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#7c4736';
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal masonry courses
  ctx.fillStyle = 'rgba(40, 18, 12, 0.25)';
  for (let y = 0; y < 512; y += 16) {
    ctx.fillRect(0, y, 512, 2);
  }

  const cols = 4;
  const rows = 5;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  // Top decorative cornice
  ctx.fillStyle = '#48281e';
  ctx.fillRect(0, 0, 512, 18);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 24;
      const wy = r * cellH + 18;
      const ww = cellW - 48;
      const wh = cellH - 32;

      // Sandstone lintel and sill
      ctx.fillStyle = '#9c6753';
      ctx.fillRect(wx - 4, wy - 6, ww + 8, 7);
      ctx.fillRect(wx - 5, wy + wh, ww + 10, 6);

      // Dark window frame & glass
      ctx.fillStyle = '#1e262e';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#364d63';
      ctx.fillRect(wx + 4, wy + 4, ww - 8, wh / 2 - 5);
      ctx.fillRect(wx + 4, wy + wh / 2 + 2, ww - 8, wh / 2 - 6);
    }

    // Iron fire-escape balcony lines on center columns
    ctx.strokeStyle = '#1a1d20';
    ctx.lineWidth = 3;
    ctx.strokeRect(cellW * 1.15, r * cellH + cellH * 0.68, cellW * 1.7, cellH * 0.22);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createModernCondoTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#dce2e8';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    // White architectural balcony slab
    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(0, r * cellH, 512, 10);

    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = '#2d4b68';
      ctx.fillRect(c * cellW + 8, r * cellH + 12, cellW - 16, cellH - 16);
      // Glass balcony railing
      ctx.fillStyle = 'rgba(165, 215, 245, 0.42)';
      ctx.fillRect(c * cellW + 6, r * cellH + cellH - 22, cellW - 12, 18);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createIndustrialFacadeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#5c646d';
  ctx.fillRect(0, 0, 512, 256);

  // Corrugated vertical ribs
  ctx.fillStyle = '#4a525a';
  for (let x = 0; x < 512; x += 8) {
    ctx.fillRect(x, 0, 3, 256);
  }

  // Clerestory factory windows
  ctx.fillStyle = '#293845';
  for (let x = 24; x < 512; x += 120) {
    ctx.fillRect(x, 36, 84, 48);
    // Loading bay doors at bottom
    ctx.fillStyle = '#383e44';
    ctx.fillRect(x + 6, 130, 72, 126);
    ctx.fillStyle = '#293845';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createAsphaltRoadTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#25282e';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt aggregate noise
  for (let i = 0; i < 4500; i++) {
    const x = (i * 97) % 512;
    const y = (i * 53 + (i % 7) * 19) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Double yellow center line
  ctx.fillStyle = '#e0a82e';
  ctx.fillRect(250, 0, 4, 512);
  ctx.fillRect(258, 0, 4, 512);

  // Dashed white lane dividers
  ctx.fillStyle = 'rgba(235, 240, 248, 0.78)';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(128, y, 4, 34);
    ctx.fillRect(380, y, 4, 34);
  }

  // Edge shoulder lines
  ctx.fillStyle = 'rgba(220, 226, 234, 0.45)';
  ctx.fillRect(10, 0, 3, 512);
  ctx.fillRect(499, 0, 3, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createRunwayTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 1024);
  ctx.fillStyle = '#22262b';
  ctx.fillRect(0, 0, 512, 1024);

  // Tire rubber touchdown skid marks along centerline
  ctx.fillStyle = 'rgba(10, 12, 15, 0.38)';
  ctx.fillRect(175, 0, 162, 1024);

  // White edge lines
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(22, 0, 8, 1024);
  ctx.fillRect(482, 0, 8, 1024);

  // Centerline dashed white stripes
  for (let y = 30; y < 1024; y += 110) {
    ctx.fillRect(249, y, 14, 62);
  }

  // Threshold piano keys at ends
  for (let x = 52; x < 460; x += 28) {
    if (x > 220 && x < 290) continue;
    ctx.fillRect(x, 18, 16, 75);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createSidewalkTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#8b929a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#6f767e';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createGrassTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#3d6e38';
  ctx.fillRect(0, 0, 256, 256);

  // Mower stripes & organic variation
  ctx.fillStyle = 'rgba(78, 132, 68, 0.35)';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 16, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createCarbonFiberTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#1e242b';
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      if ((x + y) % 16 === 0) {
        ctx.fillRect(x, y, 4, 4);
        ctx.fillRect(x + 4, y + 4, 4, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

export function generateWorldTextures(): WorldTextureSet {
  return {
    envMap: createEnvCubeTexture(),
    glassTowerBlue: createSkyscraperGlassTexture('#1b3b5c', '#102133', '#4682b4', '#26537d', 8, 18),
    glassTowerDark: createSkyscraperGlassTexture('#141c24', '#0b0f14', '#2a3b4c', '#1c2836', 10, 20),
    limestoneFacade: createLimestoneFacadeTexture(),
    modernCondoFacade: createModernCondoTexture(),
    brownstoneFacade: createBrownstoneFacadeTexture(),
    industrialFacade: createIndustrialFacadeTexture(),
    asphaltRoad: createAsphaltRoadTexture(),
    runwaySurface: createRunwayTexture(),
    sidewalkConcrete: createSidewalkTexture(),
    grassPark: createGrassTexture(),
    carbonFiber: createCarbonFiberTexture(),
  };
}
