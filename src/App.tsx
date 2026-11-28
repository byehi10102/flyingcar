import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SupercarAvionicsHud } from './components/SupercarAvionicsHud';
import { InputState, PhysicsEngine } from './physics/PhysicsEngine';
import { TelemetryData } from './types/game';
import { SupercarModel } from './vehicle/SupercarModel';
import { buildEntireCity } from './world/CityBuilder';
import { generateWorldTextures } from './world/ProceduralTextures';

const INITIAL_TELEMETRY: TelemetryData = {
  mode: 'DRIVING',
  wingStatus: 'STOWED',
  wingProgress: 0,
  wingTarget: 0,
  speedMph: 0,
  speedKts: 0,
  rpm: 1100,
  gear: 'N',
  throttle: 0,
  brake: 0,
  altitudeFeet: 0,
  altitudeAglFeet: 0,
  verticalSpeedFpm: 0,
  headingDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  liftRatio: 0,
  takeoffReady: false,
  stallWarning: false,
  landingAligned: true,
  surfaceType: 'ROAD',
  districtName: 'MIDTOWN MANHATTAN SKYSCRAPER CANYON',
  health: 100,
  damage: {
    frontBumper: 0,
    rearDiffuser: 0,
    leftDoor: 0,
    rightDoor: 0,
    windshield: 0,
    leftWing: 0,
    rightWing: 0,
    wheelFL: 0,
    wheelFR: 0,
    wheelRL: 0,
    wheelRR: 0,
    engine: 0,
  },
  statusBanner: 'VEHICLE & SYSTEMS READY — PRESS [F] TO UNFOLD WINGS AT ANY TIME',
  statusBannerSeverity: 'ready',
  fps: 60,
};

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);

  const handleToggleWings = useCallback(() => {
    physicsRef.current?.toggleWings();
  }, []);

  const handleResetVehicle = useCallback(() => {
    physicsRef.current?.resetToSpawn();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Initialize WebGL Renderer with ACES Filmic Tone Mapping & Soft Shadows
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene & Atmospheric Sunny Daylight Sky + Horizon Haze
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5fa2e2);
    scene.fog = new THREE.FogExp2(0xbad6f2, 0.00038);

    const camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.4,
      3600
    );

    // 3. Sunny Daylight Lighting (Hemisphere Sky Bounce + Shadow-Casting Sun)
    const hemiLight = new THREE.HemisphereLight(0xdbeeff, 0x3b424c, 0.88);
    hemiLight.position.set(0, 500, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 2.25);
    sunLight.position.set(160, 280, 140);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 650;
    const shadowBound = 135;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // High-altitude fair-weather cumulus cloud layer
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
    });
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, 65);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 65; i++) {
      const angle = (i / 65) * Math.PI * 2;
      const radius = 350 + ((i * 173) % 1650);
      dummy.position.set(
        Math.cos(angle) * radius,
        520 + (i % 5) * 35,
        Math.sin(angle) * radius
      );
      dummy.scale.set(140 + (i % 4) * 55, 14 + (i % 3) * 6, 95 + (i % 5) * 40);
      dummy.updateMatrix();
      cloudInst.setMatrixAt(i, dummy.matrix);
    }
    cloudGroup.add(cloudInst);
    scene.add(cloudGroup);

    // 4. Generate Procedural Textures, City World & Black Lamborghini Supercar
    const textures = generateWorldTextures();
    scene.environment = textures.envMap;

    const cityWorld = buildEntireCity(textures);
    scene.add(cityWorld.group);

    const supercar = new SupercarModel(textures);
    scene.add(supercar.root);

    // 5. Initialize Physics Engine
    const physics = new PhysicsEngine(supercar, cityWorld, scene, camera);
    physicsRef.current = physics;

    // 6. Keyboard Input Listeners
    const input: InputState = {
      w: false,
      s: false,
      a: false,
      d: false,
      space: false,
      arrowUp: false,
      arrowDown: false,
      arrowLeft: false,
      arrowRight: false,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          input.w = true;
          break;
        case 'KeyS':
          input.s = true;
          break;
        case 'KeyA':
          input.a = true;
          break;
        case 'KeyD':
          input.d = true;
          break;
        case 'Space':
          e.preventDefault();
          input.space = true;
          break;
        case 'ArrowUp':
          e.preventDefault();
          input.arrowUp = true;
          break;
        case 'ArrowDown':
          e.preventDefault();
          input.arrowDown = true;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          input.arrowLeft = true;
          break;
        case 'ArrowRight':
          e.preventDefault();
          input.arrowRight = true;
          break;
        case 'KeyF':
          if (!e.repeat) {
            physics.toggleWings();
          }
          break;
        case 'KeyR':
          if (!e.repeat) {
            physics.resetToSpawn();
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          input.w = false;
          break;
        case 'KeyS':
          input.s = false;
          break;
        case 'KeyA':
          input.a = false;
          break;
        case 'KeyD':
          input.d = false;
          break;
        case 'Space':
          input.space = false;
          break;
        case 'ArrowUp':
          input.arrowUp = false;
          break;
        case 'ArrowDown':
          input.arrowDown = false;
          break;
        case 'ArrowLeft':
          input.arrowLeft = false;
          break;
        case 'ArrowRight':
          input.arrowRight = false;
          break;
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    // 7. Real-Time Delta-Time Game Loop
    let animationFrameId = 0;
    let lastTime = performance.now();
    let hudUpdateTimer = 0;

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const latestTelemetry = physics.update(rawDt, input);

      // Update sun shadow frustum target to follow the player car seamlessly across the city
      sunLight.position.set(
        physics.position.x + 150,
        physics.position.y + 260,
        physics.position.z + 130
      );
      sunLight.target.position.copy(physics.position);
      sunLight.target.updateMatrixWorld();

      renderer.render(scene, camera);

      // Throttle React HUD state updates to ~25 Hz for ultra-smooth 60fps rendering
      hudUpdateTimer += rawDt;
      if (hudUpdateTimer >= 0.04) {
        hudUpdateTimer = 0;
        setTelemetry(latestTelemetry);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      {/* Full-Viewport 3D WebGL Canvas Container */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Hybrid Supercar & Avionics Telemetry HUD */}
      <SupercarAvionicsHud
        telemetry={telemetry}
        onToggleWings={handleToggleWings}
        onResetVehicle={handleResetVehicle}
      />
    </div>
  );
}

export default App;
