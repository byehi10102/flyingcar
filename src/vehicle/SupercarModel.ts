import * as THREE from 'three';
import { ComponentDamage, WingStatus } from '../types/game';
import { WorldTextureSet } from '../world/ProceduralTextures';

export class SupercarModel {
  public root: THREE.Group;
  public chassisBody: THREE.Group;

  // Detachable / deformable sub-assemblies
  public frontBumperGroup: THREE.Group;
  public rearDiffuserGroup: THREE.Group;
  public leftDoorGroup: THREE.Group;
  public rightDoorGroup: THREE.Group;
  public windshieldMesh: THREE.Mesh;
  public windshieldCracks: THREE.Group;
  public activeSpoiler: THREE.Group;

  // 4 Wheels (steer pivot -> spin mesh)
  public wheelSteerPivots: THREE.Group[] = []; // FL, FR, RL, RR
  public wheelSpinGroups: THREE.Group[] = [];

  // Multi-stage Mechanical Wing Transformation Hierarchy
  public leftBayDoor: THREE.Group;
  public rightBayDoor: THREE.Group;
  public leftRootSpar: THREE.Group;
  public rightRootSpar: THREE.Group;
  public leftMainWingPivot: THREE.Group;
  public rightMainWingPivot: THREE.Group;
  public leftOuterWingPivot: THREE.Group;
  public rightOuterWingPivot: THREE.Group;
  public leftAileron: THREE.Mesh;
  public rightAileron: THREE.Mesh;
  public leftTailStabilizer: THREE.Group;
  public rightTailStabilizer: THREE.Group;

  // Glow indicators
  private wingLockLights: THREE.MeshStandardMaterial;
  private brakeLightMat: THREE.MeshStandardMaterial;
  private thrusterGlowMat: THREE.MeshStandardMaterial;

  constructor(textures: WorldTextureSet) {
    this.root = new THREE.Group();
    this.chassisBody = new THREE.Group();
    this.root.add(this.chassisBody);

    // Core Materials — Glossy Obsidian Black Lamborghini finish
    const obsidianPaint = new THREE.MeshPhysicalMaterial({
      color: 0x0a0c10,
      roughness: 0.14,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMap: textures.envMap,
      envMapIntensity: 1.6,
    });

    const satinCarbon = new THREE.MeshStandardMaterial({
      map: textures.carbonFiber,
      color: 0x181c22,
      roughness: 0.35,
      metalness: 0.55,
      envMap: textures.envMap,
    });

    const titaniumMech = new THREE.MeshStandardMaterial({
      color: 0x7a8490,
      roughness: 0.28,
      metalness: 0.88,
      envMap: textures.envMap,
    });

    const canopyGlass = new THREE.MeshPhysicalMaterial({
      color: 0x111922,
      roughness: 0.06,
      metalness: 0.2,
      transmission: 0.45,
      transparent: true,
      opacity: 0.86,
      envMap: textures.envMap,
      envMapIntensity: 1.5,
    });

    const headlightLed = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd8f0ff,
      emissiveIntensity: 2.2,
    });

    this.brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xff1a1a,
      emissive: 0xff1122,
      emissiveIntensity: 1.6,
    });

    this.wingLockLights = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d8ff,
      emissiveIntensity: 0.0,
    });

    this.thrusterGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.2,
    });

    // ========================================================================
    // 1. CENTRAL MONOCOQUE TUB & SCULPTED ROOF CANOPY
    // Car dimensions: Width ~2.12m, Height ~1.16m, Length ~4.76m (-Z is forward)
    // ========================================================================
    const lowerTub = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.42, 4.1), obsidianPaint);
    lowerTub.position.set(0, 0.46, 0);
    lowerTub.castShadow = true;
    lowerTub.receiveShadow = true;
    this.chassisBody.add(lowerTub);

    // Sculpted front hood deck sloping aggressively downward
    const frontHood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.22, 1.45), obsidianPaint);
    frontHood.position.set(0, 0.64, -1.35);
    frontHood.rotation.x = 0.14;
    frontHood.castShadow = true;
    this.chassisBody.add(frontHood);

    // Front fenders over wheel arches
    for (const side of [-1, 1]) {
      const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 1.52), obsidianPaint);
      frontFender.position.set(side * 0.92, 0.62, -1.32);
      frontFender.castShadow = true;
      this.chassisBody.add(frontFender);

      const rearHaunch = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 1.75), obsidianPaint);
      rearHaunch.position.set(side * 0.95, 0.68, 1.18);
      rearHaunch.castShadow = true;
      this.chassisBody.add(rearHaunch);
    }

    // Cockpit interior (2 sport bucket seats + dashboard + steering wheel)
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.55), interiorMat);
      seat.position.set(side * 0.38, 0.65, 0.08);
      seat.rotation.x = -0.22;
      this.chassisBody.add(seat);
    }

    // Angled Windshield & Canopy Roof
    this.windshieldMesh = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 1.38), canopyGlass);
    this.windshieldMesh.position.set(0, 0.94, -0.52);
    this.windshieldMesh.rotation.x = 0.46;
    this.chassisBody.add(this.windshieldMesh);

    // Windshield crack overlay lines (hidden when undamaged)
    this.windshieldCracks = new THREE.Group();
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.65), crackMat);
      line.position.set((i - 2.5) * 0.14, 0.96, -0.52);
      line.rotation.set(0.46, (i % 2 === 0 ? 1 : -1) * 0.38, 0);
      this.windshieldCracks.add(line);
    }
    this.windshieldCracks.visible = false;
    this.chassisBody.add(this.windshieldCracks);

    const roofCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.08, 0.95), obsidianPaint);
    roofCanopy.position.set(0, 1.16, 0.22);
    roofCanopy.castShadow = true;
    this.chassisBody.add(roofCanopy);

    // Hexagonal Louvered V12 Engine Deck
    const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.12, 1.35), satinCarbon);
    engineDeck.position.set(0, 0.96, 1.25);
    engineDeck.rotation.x = -0.24;
    this.chassisBody.add(engineDeck);

    // ========================================================================
    // 2. FRONT BUMPER, SPLITTER & Y-SHAPED LED HEADLIGHTS (Deformable/Detachable)
    // ========================================================================
    this.frontBumperGroup = new THREE.Group();
    this.frontBumperGroup.position.set(0, 0.42, -2.12);
    this.chassisBody.add(this.frontBumperGroup);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.1, 0.56), satinCarbon);
    splitter.position.set(0, -0.12, -0.06);
    this.frontBumperGroup.add(splitter);

    const noseCone = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.26, 0.48), obsidianPaint);
    noseCone.position.set(0, 0.06, 0.02);
    noseCone.rotation.x = 0.22;
    this.frontBumperGroup.add(noseCone);

    // Iconic Lamborghini Y-shaped LED Headlights
    for (const side of [-1, 1]) {
      const ledMain = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.22), headlightLed);
      ledMain.position.set(side * 0.74, 0.16, -0.08);
      ledMain.rotation.y = side * -0.25;
      this.frontBumperGroup.add(ledMain);

      const ledBranch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.12), headlightLed);
      ledBranch.position.set(side * 0.66, 0.17, -0.14);
      ledBranch.rotation.y = side * 0.45;
      this.frontBumperGroup.add(ledBranch);
    }

    // ========================================================================
    // 3. REAR DIFFUSER, QUAD EXHAUSTS, TAILLIGHTS & ACTIVE SPOILER
    // ========================================================================
    this.rearDiffuserGroup = new THREE.Group();
    this.rearDiffuserGroup.position.set(0, 0.48, 2.15);
    this.chassisBody.add(this.rearDiffuserGroup);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.28, 0.42), satinCarbon);
    diffuser.position.set(0, -0.08, 0);
    this.rearDiffuserGroup.add(diffuser);

    // Diffuser vertical aerodynamic strakes
    for (let i = -3; i <= 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.46), satinCarbon);
      fin.position.set(i * 0.24, -0.1, 0.02);
      this.rearDiffuserGroup.add(fin);
    }

    // Center Hex Exhaust / Aero-Thruster Nozzle
    const exhaustCluster = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.2), this.thrusterGlowMat);
    exhaustCluster.position.set(0, 0.12, 0.12);
    this.rearDiffuserGroup.add(exhaustCluster);

    // Y-shaped Crimson LED Taillights
    for (const side of [-1, 1]) {
      const tailLed = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.1), this.brakeLightMat);
      tailLed.position.set(side * 0.68, 0.26, 0.12);
      this.rearDiffuserGroup.add(tailLed);
    }

    // Active Rear Spoiler
    this.activeSpoiler = new THREE.Group();
    this.activeSpoiler.position.set(0, 0.88, 2.06);
    this.chassisBody.add(this.activeSpoiler);

    const spoilerBlade = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.06, 0.34), satinCarbon);
    this.activeSpoiler.add(spoilerBlade);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.22), titaniumMech);
      pylon.position.set(side * 0.56, -0.1, 0);
      this.activeSpoiler.add(pylon);
    }

    // Deployable Rear Tailplane Horizontal Stabilizers (extend during flight transformation)
    this.leftTailStabilizer = new THREE.Group();
    this.leftTailStabilizer.position.set(-0.5, 0.78, 2.02);
    this.chassisBody.add(this.leftTailStabilizer);
    const leftTailFoil = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.44), satinCarbon);
    leftTailFoil.position.set(-0.45, 0, 0);
    this.leftTailStabilizer.add(leftTailFoil);

    this.rightTailStabilizer = new THREE.Group();
    this.rightTailStabilizer.position.set(0.5, 0.78, 2.02);
    this.chassisBody.add(this.rightTailStabilizer);
    const rightTailFoil = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.44), satinCarbon);
    rightTailFoil.position.set(0.45, 0, 0);
    this.rightTailStabilizer.add(rightTailFoil);

    // ========================================================================
    // 4. SCISSOR DOORS & SIDE AIR INTAKES (Deformable/Detachable)
    // ========================================================================
    this.leftDoorGroup = new THREE.Group();
    this.leftDoorGroup.position.set(-0.98, 0.58, -0.05);
    this.chassisBody.add(this.leftDoorGroup);
    const leftDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 1.38), obsidianPaint);
    this.leftDoorGroup.add(leftDoorMesh);

    this.rightDoorGroup = new THREE.Group();
    this.rightDoorGroup.position.set(0.98, 0.58, -0.05);
    this.chassisBody.add(this.rightDoorGroup);
    const rightDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 1.38), obsidianPaint);
    this.rightDoorGroup.add(rightDoorMesh);

    // ========================================================================
    // 5. FOUR INDEPENDENT WHEELS & SUSPENSION ASSEMBLIES
    // ========================================================================
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x8e96a0,
      roughness: 0.25,
      metalness: 0.88,
      envMap: textures.envMap,
    });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.5 });

    const wheelPositions: [number, number, number, boolean][] = [
      [-0.96, 0.36, -1.42, true], // FL
      [0.96, 0.36, -1.42, true], // FR
      [-0.99, 0.38, 1.36, false], // RL
      [0.99, 0.38, 1.36, false], // RR
    ];

    for (const [wx, wy, wz, isFront] of wheelPositions) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, wy, wz);
      this.root.add(steerPivot);
      this.wheelSteerPivots.push(steerPivot);

      // Brake caliper fixed to steering knuckle
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.16), caliperMat);
      caliper.position.set(wx < 0 ? 0.06 : -0.06, 0.05, isFront ? 0.12 : -0.12);
      steerPivot.add(caliper);

      const spinGroup = new THREE.Group();
      steerPivot.add(spinGroup);
      this.wheelSpinGroups.push(spinGroup);

      const radius = isFront ? 0.35 : 0.38;
      const width = isFront ? 0.3 : 0.36;
      const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      spinGroup.add(tireMesh);

      // Forged multi-spoke rim hub & spokes
      const rimGeo = new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width + 0.02, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      spinGroup.add(rimMesh);

      for (let sp = 0; sp < 5; sp++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, radius * 1.38, 0.045), obsidianPaint);
        spoke.rotation.x = (sp * Math.PI) / 5;
        spinGroup.add(spoke);
      }
    }

    // ========================================================================
    // 6. SIGNATURE MULTI-STAGE UNFOLDING AIRPLANE WINGS
    // Integrated into both flanks of the supercar!
    // ========================================================================
    const buildWingSide = (side: -1 | 1) => {
      // A. Side Compartment Bay Door (hinged along top dorsal edge)
      const bayDoor = new THREE.Group();
      bayDoor.position.set(side * 0.92, 0.84, 0.18);
      this.chassisBody.add(bayDoor);

      const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 1.68), obsidianPaint);
      doorPanel.position.set(side * 0.04, -0.1, 0);
      bayDoor.add(doorPanel);

      const lockLightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 1.5), this.wingLockLights);
      lockLightStrip.position.set(side * 0.045, -0.02, 0);
      bayDoor.add(lockLightStrip);

      // B. Telescoping Titanium Wing Root Spar (slides outward from fuselage bay)
      const rootSpar = new THREE.Group();
      rootSpar.position.set(side * 0.35, 0.72, 0.15);
      this.chassisBody.add(rootSpar);

      // Twin heavy hydraulic structural I-beams
      const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.09, 0.12), titaniumMech);
      frontBeam.position.set(side * 0.25, 0, -0.35);
      rootSpar.add(frontBeam);

      const rearBeam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.09, 0.12), titaniumMech);
      rearBeam.position.set(side * 0.25, 0, 0.35);
      rootSpar.add(rearBeam);

      const rotaryGearedJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 16), titaniumMech);
      rotaryGearedJoint.position.set(side * 0.62, 0, -0.25);
      rootSpar.add(rotaryGearedJoint);

      // C. Main Inner Airfoil Wing Section (pivots outward from stowed parallel position to 90-deg flight span)
      const mainWingPivot = new THREE.Group();
      mainWingPivot.position.set(side * 0.62, 0, -0.25);
      rootSpar.add(mainWingPivot);

      // Main Wing Airfoil Box (Span = 2.45m per side, Chord = 1.32m)
      const mainSpan = 2.45;
      const mainFoil = new THREE.Mesh(new THREE.BoxGeometry(mainSpan, 0.09, 1.28), satinCarbon);
      mainFoil.position.set(side * (mainSpan / 2), 0, 0.35);
      mainFoil.castShadow = true;
      mainFoil.receiveShadow = true;
      mainWingPivot.add(mainFoil);

      // Titanium Leading Edge Slats on Main Wing
      const leadingEdge = new THREE.Mesh(new THREE.BoxGeometry(mainSpan, 0.07, 0.18), titaniumMech);
      leadingEdge.position.set(side * (mainSpan / 2), 0, -0.28);
      mainWingPivot.add(leadingEdge);

      // Under-wing diagonal hydraulic brace strut
      const braceStrut = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.08), titaniumMech);
      braceStrut.position.set(side * 0.68, -0.14, 0.25);
      braceStrut.rotation.z = side * 0.16;
      mainWingPivot.add(braceStrut);

      // Outer Hinge Knuckle at tip of Main Wing
      const outerHingeJoint = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.95), titaniumMech);
      outerHingeJoint.position.set(side * mainSpan, 0.02, 0.32);
      mainWingPivot.add(outerHingeJoint);

      // D. Outer Folding Wing Panel (unfolds 180 deg from folded-on-top to full 11.4m wingspan!)
      const outerWingPivot = new THREE.Group();
      outerWingPivot.position.set(side * mainSpan, 0.05, 0.32);
      mainWingPivot.add(outerWingPivot);

      const outerSpan = 2.15;
      const outerFoil = new THREE.Mesh(new THREE.BoxGeometry(outerSpan, 0.065, 0.98), obsidianPaint);
      outerFoil.position.set(side * (outerSpan / 2), 0, 0);
      outerFoil.castShadow = true;
      outerWingPivot.add(outerFoil);

      // Cyan aerodynamic structural lock trim stripe
      const aeroStripe = new THREE.Mesh(new THREE.BoxGeometry(outerSpan * 0.92, 0.072, 0.06), this.wingLockLights);
      aeroStripe.position.set(side * (outerSpan / 2), 0, -0.32);
      outerWingPivot.add(aeroStripe);

      // Articulating Trailing-Edge Aileron Control Surface
      const aileron = new THREE.Mesh(new THREE.BoxGeometry(outerSpan * 0.85, 0.045, 0.24), titaniumMech);
      aileron.position.set(side * (outerSpan * 0.48), 0, 0.58);
      outerWingPivot.add(aileron);

      // Raked Sharklet Wingtip & Aviation Strobe Light
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.56), satinCarbon);
      winglet.position.set(side * outerSpan, 0.22, 0.08);
      winglet.rotation.z = side * -0.22;
      outerWingPivot.add(winglet);

      const navLightMat = new THREE.MeshStandardMaterial({
        color: side === -1 ? 0xff2222 : 0x22ff55,
        emissive: side === -1 ? 0xff0000 : 0x00ff44,
        emissiveIntensity: 2.0,
      });
      const navLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.18), navLightMat);
      navLight.position.set(side * outerSpan, 0.48, 0.08);
      outerWingPivot.add(navLight);

      return { bayDoor, rootSpar, mainWingPivot, outerWingPivot, aileron };
    };

    const leftWing = buildWingSide(-1);
    this.leftBayDoor = leftWing.bayDoor;
    this.leftRootSpar = leftWing.rootSpar;
    this.leftMainWingPivot = leftWing.mainWingPivot;
    this.leftOuterWingPivot = leftWing.outerWingPivot;
    this.leftAileron = leftWing.aileron;

    const rightWing = buildWingSide(1);
    this.rightBayDoor = rightWing.bayDoor;
    this.rightRootSpar = rightWing.rootSpar;
    this.rightMainWingPivot = rightWing.mainWingPivot;
    this.rightOuterWingPivot = rightWing.outerWingPivot;
    this.rightAileron = rightWing.aileron;

    // Initialize wings in stowed state
    this.updateWingAnimation(0, 0, 0, 0, false);
  }

  private smoothStep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /**
   * Drives the multi-stage coordinated mechanical wing transformation (0.0 = stowed inside car, 1.0 = locked aircraft span)
   */
  public updateWingAnimation(
    progress: number,
    pitchInput: number,
    rollInput: number,
    brakeInput: number,
    isAirborne: boolean,
    damage?: ComponentDamage
  ): WingStatus {
    const p = Math.max(0, Math.min(1, progress));

    // 4-Stage Mechanical Choreography:
    // Stage 1 (0.00 -> 0.20): Bay doors unlock and hinge open; rear tail stabilizers begin emerging
    const s1 = this.smoothStep(0.0, 0.2, p);
    // Stage 2 (0.16 -> 0.45): Telescoping titanium wing roots extend horizontally out of side pods
    const s2 = this.smoothStep(0.16, 0.45, p);
    // Stage 3 (0.40 -> 0.76): Main swept airfoil sections rotate from stowed longitudinal position out to flight sweep
    const s3 = this.smoothStep(0.4, 0.76, p);
    // Stage 4 (0.70 -> 1.00): Outer wing sections unfold 180 deg to full 11.4m span & lock; bay doors streamline
    const s4 = this.smoothStep(0.7, 1.0, p);

    // Bay door angle: opens up to 0.65 rad during stages 1-3, then settles to 0.28 rad once wings lock
    const bayAngle = s1 * 0.65 - s4 * 0.32;
    this.leftBayDoor.rotation.z = -bayAngle;
    this.rightBayDoor.rotation.z = bayAngle;

    // Root spar lateral extension: stowed inside chassis at x = +-0.12, extends out to +-0.48
    const rootOut = 0.08 + s2 * 0.42;
    this.leftRootSpar.position.x = -rootOut;
    this.rightRootSpar.position.x = rootOut;
    // Hide wing meshes completely when deeply stowed inside the car body (p < 0.03) so nothing clips
    this.leftRootSpar.visible = p > 0.02 && (!damage || damage.leftWing < 1);
    this.rightRootSpar.visible = p > 0.02 && (!damage || damage.rightWing < 1);

    // Main Wing Sweep Rotation:
    // When stowed (s3 = 0), rotated 88 deg backward so it lies tucked inside the side pod along +Z.
    // As s3 -> 1, rotates smoothly out to slight 6-deg swept-back aircraft angle!
    const sweepAngle = (1 - s3) * 1.48 + 0.08;
    const leftDmgTilt = damage ? damage.leftWing * 0.28 : 0;
    const rightDmgTilt = damage ? damage.rightWing * 0.28 : 0;

    this.leftMainWingPivot.rotation.y = sweepAngle;
    this.leftMainWingPivot.rotation.z = -leftDmgTilt;
    this.rightMainWingPivot.rotation.y = -sweepAngle;
    this.rightMainWingPivot.rotation.z = rightDmgTilt;

    // Scale main wing chord/span subtly during initial emergence so it fits inside the 2.2m bay when stowed
    const emergeScale = 0.45 + 0.55 * this.smoothStep(0.15, 0.55, p);
    this.leftMainWingPivot.scale.set(emergeScale, 1, emergeScale);
    this.rightMainWingPivot.scale.set(emergeScale, 1, emergeScale);

    // Outer Wing Unfold (Stage 4): folds 176 deg over the main wing when stowed, unfolds flat to 0 deg dihedral
    const foldAngle = (1 - s4) * 3.05;
    this.leftOuterWingPivot.rotation.z = -foldAngle + 0.04; // slight positive dihedral when locked
    this.rightOuterWingPivot.rotation.z = foldAngle - 0.04;

    // Rear Horizontal Tail Stabilizers extend outward during Stages 2-4
    const tailExt = this.smoothStep(0.25, 0.85, p);
    this.leftTailStabilizer.visible = p > 0.1;
    this.rightTailStabilizer.visible = p > 0.1;
    this.leftTailStabilizer.position.x = -0.35 - tailExt * 0.52;
    this.rightTailStabilizer.position.x = 0.35 + tailExt * 0.52;
    this.leftTailStabilizer.rotation.x = -pitchInput * 0.28;
    this.rightTailStabilizer.rotation.x = -pitchInput * 0.28;

    // Active Aileron & Spoiler deflections
    this.leftAileron.rotation.x = rollInput * 0.35 - brakeInput * 0.25;
    this.rightAileron.rotation.x = -rollInput * 0.35 - brakeInput * 0.25;

    this.activeSpoiler.position.y = 0.88 + (p * 0.08 + brakeInput * 0.06);
    this.activeSpoiler.rotation.x = -0.08 - brakeInput * 0.38 - (isAirborne ? pitchInput * 0.2 : 0);

    // Glow intensity on wing lock strips and brake lights
    this.wingLockLights.emissiveIntensity = p > 0.96 ? 2.4 : p > 0.02 ? 0.9 : 0.0;
    this.brakeLightMat.emissiveIntensity = brakeInput > 0.1 ? 3.5 : 1.4;
    this.thrusterGlowMat.emissiveIntensity = isAirborne ? 2.8 : 0.4;

    if (damage && (damage.leftWing >= 0.85 || damage.rightWing >= 0.85)) {
      return 'JAMMED_DAMAGED';
    }
    if (p <= 0.005) return 'STOWED';
    if (p >= 0.995) return 'DEPLOYED_LOCKED';
    if (p < 0.22) return 'STAGE_1_BAYS_UNLOCKING';
    if (p < 0.46) return 'STAGE_2_ROOT_SPARS_EXTENDING';
    if (p < 0.76) return 'STAGE_3_MAIN_FOIL_SWEEPING';
    return 'STAGE_4_OUTER_WINGS_LOCKING';
  }

  /**
   * Applies visual deformation & hides detached parts according to ComponentDamage state
   */
  public applyDamageVisuals(dmg: ComponentDamage) {
    // Front Bumper
    this.frontBumperGroup.visible = dmg.frontBumper < 1;
    this.frontBumperGroup.rotation.z = dmg.frontBumper * 0.22;
    this.frontBumperGroup.rotation.x = dmg.frontBumper * 0.18;
    this.frontBumperGroup.position.y = 0.42 - dmg.frontBumper * 0.08;

    // Rear Diffuser
    this.rearDiffuserGroup.visible = dmg.rearDiffuser < 1;
    this.rearDiffuserGroup.rotation.z = -dmg.rearDiffuser * 0.2;

    // Doors
    this.leftDoorGroup.visible = dmg.leftDoor < 1;
    this.leftDoorGroup.rotation.y = -dmg.leftDoor * 0.35;
    this.leftDoorGroup.rotation.z = dmg.leftDoor * 0.18;

    this.rightDoorGroup.visible = dmg.rightDoor < 1;
    this.rightDoorGroup.rotation.y = dmg.rightDoor * 0.35;
    this.rightDoorGroup.rotation.z = -dmg.rightDoor * 0.18;

    // Cracked windshield
    this.windshieldCracks.visible = dmg.windshield > 0.15;

    // Wheels
    const wheelDmgs = [dmg.wheelFL, dmg.wheelFR, dmg.wheelRL, dmg.wheelRR];
    for (let i = 0; i < 4; i++) {
      this.wheelSteerPivots[i].visible = wheelDmgs[i] < 1;
      this.wheelSpinGroups[i].rotation.z = wheelDmgs[i] * 0.28; // bent axle camber when damaged
    }
  }
}
