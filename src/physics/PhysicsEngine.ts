import * as THREE from 'three';
import {
  ComponentDamage,
  DetachedDebris,
  ParticleItem,
  TelemetryData,
  VehicleMode,
  WingStatus,
} from '../types/game';
import { SupercarModel } from '../vehicle/SupercarModel';
import { CityWorld } from '../world/CityBuilder';

export interface InputState {
  w: boolean;
  s: boolean;
  a: boolean;
  d: boolean;
  space: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
  arrowLeft: boolean;
  arrowRight: boolean;
}

const SPAWN_POS = new THREE.Vector3(0, 0.0, 240);
const SPAWN_HEADING = 0; // Facing North (-Z) down Midtown 5th Avenue Skyscraper Canyon
const MPS_TO_MPH = 2.23694;
const MPS_TO_KTS = 1.94384;
const METERS_TO_FEET = 3.28084;

export class PhysicsEngine {
  private car: SupercarModel;
  private world: CityWorld;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Spatial & kinematic state
  public position = new THREE.Vector3().copy(SPAWN_POS);
  public velocity = new THREE.Vector3();
  public heading = SPAWN_HEADING; // radians, 0 = -Z, +PI/2 = -X (Three.js Y rotation)
  public pitch = 0; // radians, positive = nose up
  public roll = 0; // radians, positive = right bank

  // Angular velocities
  private yawRate = 0;
  private pitchRate = 0;
  private rollRate = 0;

  // Driving state
  private forwardSpeed = 0; // m/s along vehicle forward axis
  private steerAngle = 0;
  private wheelRotation = 0;
  private suspensionOffset = 0;
  private isGrounded = true;
  private currentSurfaceHeight = 0;
  private currentSurfaceType: TelemetryData['surfaceType'] = 'ROAD';

  // Wing transformation state (5.2 seconds full cycle)
  public wingProgress = 0; // 0.0 = stowed, 1.0 = deployed
  public wingTarget = 0; // 0 or 1
  private readonly wingSpeed = 1 / 5.2; // 5.2 seconds duration
  private wingCameraHighlightTimer = 0;

  // Mode & Damage state
  public mode: VehicleMode = 'DRIVING';
  public wingStatus: WingStatus = 'STOWED';
  public health = 100;
  public damage: ComponentDamage = this.createCleanDamage();

  // Particles & Detached 3D Debris
  private particles: ParticleItem[] = [];
  private debrisList: DetachedDebris[] = [];
  private smokeTimer = 0;

  // Camera state
  private camPosition = new THREE.Vector3(0, 3.2, 247.5);
  private camLookTarget = new THREE.Vector3(0, 1.2, 230);
  private camRoll = 0;
  private cameraShake = 0;

  // Status banner notification
  private statusBanner: string | null = null;
  private statusBannerSeverity: TelemetryData['statusBannerSeverity'] = 'info';
  private statusBannerTimer = 0;

  // FPS tracking
  private frameCount = 0;
  private fpsAccum = 0;
  private currentFps = 60;

  constructor(
    car: SupercarModel,
    world: CityWorld,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.car = car;
    this.world = world;
    this.scene = scene;
    this.camera = camera;
    this.resetToSpawn();
  }

  private createCleanDamage(): ComponentDamage {
    return {
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
    };
  }

  public triggerBanner(
    text: string,
    severity: TelemetryData['statusBannerSeverity'] = 'info',
    duration = 3.0
  ) {
    this.statusBanner = text;
    this.statusBannerSeverity = severity;
    this.statusBannerTimer = duration;
  }

  /**
   * Toggle Wing Deployment / Retraction ('F' key)
   */
  public toggleWings() {
    if (this.mode === 'EXPLODED') return;

    if (this.damage.leftWing >= 0.85 || this.damage.rightWing >= 0.85) {
      this.triggerBanner('WING ACTUATORS JAMMED — PRESS [R] TO REPAIR', 'danger', 3.2);
      return;
    }

    if (this.wingTarget === 0) {
      this.wingTarget = 1;
      this.wingCameraHighlightTimer = 4.8;
      this.triggerBanner('DEPLOYING AERO-V12 FLIGHT WINGS', 'info', 3.5);
    } else {
      // If on the ground and moving very fast (> 115 MPH), warn or allow smooth retraction
      this.wingTarget = 0;
      this.wingCameraHighlightTimer = 3.2;
      this.triggerBanner('RETRACTING WINGS TO ROAD CONFIGURATION', 'info', 3.0);
    }
  }

  /**
   * Instant Reset ('R' key) — restores vehicle, health, detached parts, wings, physics, and camera immediately
   */
  public resetToSpawn() {
    this.position.copy(SPAWN_POS);
    this.velocity.set(0, 0, 0);
    this.heading = SPAWN_HEADING;
    this.pitch = 0;
    this.roll = 0;
    this.yawRate = 0;
    this.pitchRate = 0;
    this.rollRate = 0;

    this.forwardSpeed = 0;
    this.steerAngle = 0;
    this.wheelRotation = 0;
    this.suspensionOffset = 0;
    this.isGrounded = true;
    this.currentSurfaceHeight = 0;
    this.currentSurfaceType = 'ROAD';

    this.wingProgress = 0;
    this.wingTarget = 0;
    this.wingCameraHighlightTimer = 0;

    this.mode = 'DRIVING';
    this.wingStatus = 'STOWED';
    this.health = 100;
    this.damage = this.createCleanDamage();
    this.car.applyDamageVisuals(this.damage);
    this.car.updateWingAnimation(0, 0, 0, 0, false, this.damage);

    // Clear all detached debris & particles
    for (const d of this.debrisList) {
      this.scene.remove(d.mesh);
    }
    this.debrisList = [];

    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];

    this.cameraShake = 0;
    this.camRoll = 0;
    this.camPosition.set(SPAWN_POS.x, SPAWN_POS.y + 2.6, SPAWN_POS.z + 7.2);
    this.camLookTarget.set(SPAWN_POS.x, SPAWN_POS.y + 1.0, SPAWN_POS.z - 12);
    this.syncCarTransform();
    this.updateCamera(0.016, true);

    this.triggerBanner('VEHICLE & SYSTEMS RESTORED — READY FOR FREE ROAM', 'ready', 2.8);
  }

  /**
   * Evaluates the ground/elevated/rooftop surface height beneath (x, y, z)
   */
  private evaluateSurfaceBeneath(x: number, y: number, z: number): {
    height: number;
    type: TelemetryData['surfaceType'];
    ceilingY: number | null;
  } {
    let bestHeight = 0.0;
    let bestType: TelemetryData['surfaceType'] = 'ROAD';
    let ceilingY: number | null = null;

    // Check water channel if not on a bridge
    if (this.world.isWaterAt(x, z)) {
      bestHeight = -1.6;
      bestType = 'WATER';
    } else if (x > -375 && x < -95 && z > -550 && z < 50) {
      bestHeight = 0.15;
      bestType = 'PARK';
    }

    // Check elevated surfaces (Bridges, FDR Expressway, Tunnel Roof, Airport Runways)
    for (let i = 0; i < this.world.elevatedSurfaces.length; i++) {
      const surf = this.world.elevatedSurfaces[i];
      if (x >= surf.minX && x <= surf.maxX && z >= surf.minZ && z <= surf.maxZ) {
        const h = surf.getHeightAt(x, z);
        if (h !== null) {
          // If it's a tunnel, check if the car is inside the tunnel vs on top of the tunnel roof!
          if (surf.surfaceType === 'TUNNEL' && surf.ceilingY !== undefined) {
            if (y < surf.ceilingY - 1.2) {
              ceilingY = surf.ceilingY;
              bestType = 'TUNNEL';
            } else if (y >= h - 2.5 && h > bestHeight) {
              bestHeight = h;
              bestType = 'ROOFTOP';
            }
          } else {
            // Bridge, highway, or runway: if the car is near or above the deck (or ascending its ramp), snap to it
            if (y >= h - 3.8 && h >= bestHeight) {
              bestHeight = h;
              bestType = surf.surfaceType;
            }
          }
        }
      }
    }

    // Check building rooftops! If the car is above or landing onto a building's topY, the rooftop is a physical surface!
    const nearby = this.world.queryCollidersNear(x, z, 6);
    for (let i = 0; i < nearby.length; i++) {
      const b = nearby[i];
      if (b.isLandableRoof && x >= b.minX + 0.4 && x <= b.maxX - 0.4 && z >= b.minZ + 0.4 && z <= b.maxZ - 0.4) {
        // Vehicle is within the horizontal footprint of the building
        if (y >= b.topY - 2.2 && b.topY > bestHeight) {
          bestHeight = b.topY;
          bestType = 'ROOFTOP';
        }
      }
    }

    return { height: bestHeight, type: bestType, ceilingY };
  }

  /**
   * Main Delta-Time Physics Step
   */
  public update(rawDt: number, input: InputState): TelemetryData {
    const dt = Math.min(rawDt, 0.05); // Clamp dt to prevent huge jumps on tab switch

    // FPS counter
    this.frameCount++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) {
        this.statusBanner = null;
      }
    }

    if (this.wingCameraHighlightTimer > 0) {
      this.wingCameraHighlightTimer = Math.max(0, this.wingCameraHighlightTimer - dt);
    }

    // 1. Update Mechanical Wing Transformation (continues smoothly while driving or flying!)
    if (this.mode !== 'EXPLODED') {
      const canMoveWings = this.damage.leftWing < 0.85 && this.damage.rightWing < 0.85;
      if (canMoveWings) {
        if (this.wingProgress < this.wingTarget) {
          this.wingProgress = Math.min(1, this.wingProgress + this.wingSpeed * dt);
          if (this.wingProgress >= 1) {
            this.triggerBanner('WINGS LOCKED — ACCELERATE & HOLD [DOWN ARROW] FOR TAKEOFF', 'ready', 3.5);
          }
        } else if (this.wingProgress > this.wingTarget) {
          // Only retract on the ground if stable, or allow mid-air retraction if pilot commands it
          this.wingProgress = Math.max(0, this.wingProgress - this.wingSpeed * dt);
        }
      }
    }

    // Positive roll = left bank (rotation.z), so LEFT arrow must add and RIGHT arrow subtract
    const pitchControl = (input.arrowDown ? 1 : 0) - (input.arrowUp ? 1 : 0);
    const rollControl = (input.arrowLeft ? 1 : 0) - (input.arrowRight ? 1 : 0);

    this.wingStatus = this.car.updateWingAnimation(
      this.wingProgress,
      pitchControl,
      rollControl,
      input.space ? 1 : 0,
      !this.isGrounded,
      this.damage
    );

    // 2. Evaluate Surface Beneath Vehicle
    const surf = this.evaluateSurfaceBeneath(this.position.x, this.position.y, this.position.z);
    this.currentSurfaceHeight = surf.height;
    this.currentSurfaceType = this.isGrounded ? surf.type : 'AIR';

    // 3. Branch between Ground Driving Physics & Airborne / Flight Physics
    if (this.mode === 'EXPLODED') {
      this.updateExplodedState(dt);
    } else if (this.isGrounded) {
      this.updateGroundDrivingPhysics(dt, input, pitchControl);
    } else {
      this.updateAirborneFlightPhysics(dt, input, pitchControl, rollControl, surf.ceilingY);
    }

    // 4. Check 3D Building Wall Collisions
    if (this.mode !== 'EXPLODED') {
      this.resolveBuildingCollisions();
    }

    // 5. Continuous Smoke if Damaged
    if (this.health < 65 && this.mode !== 'EXPLODED') {
      this.smokeTimer += dt;
      const interval = this.health < 30 ? 0.04 : 0.09;
      if (this.smokeTimer >= interval) {
        this.smokeTimer = 0;
        this.spawnSmokeAndFire(this.health < 25);
      }
    }

    // 6. Update Detached 3D Debris & Particles
    this.updateDebrisAndParticles(dt);

    // 7. Sync 3D Supercar Transform & Chase Camera
    this.syncCarTransform();
    this.updateCamera(dt, false);

    return this.buildTelemetry(input);
  }

  /**
   * Ground Driving & Takeoff Transition Physics
   */
  private updateGroundDrivingPhysics(dt: number, input: InputState, pitchControl: number) {
    // Check if we drove off the edge of a rooftop, bridge, or elevated highway!
    const heightAboveSurface = this.position.y - this.currentSurfaceHeight;
    if (heightAboveSurface > 1.35) {
      this.isGrounded = false;
      this.mode = 'AIRBORNE';
      return;
    }

    // Check if car fell into water
    if (this.currentSurfaceType === 'WATER' && this.position.y <= -0.4) {
      this.applyCrashDamage(48, 'FRONT', 'WATER IMPACT — PRESS [R] TO RESET');
      this.forwardSpeed *= 0.2;
    }

    // Performance penalties from damage
    const engineHealthFactor = Math.max(0.35, 1.0 - this.damage.engine * 0.6);
    const wheelDmgPull =
      (this.damage.wheelFR + this.damage.wheelRR - (this.damage.wheelFL + this.damage.wheelRL)) * 0.22;

    // Longitudinal acceleration, reverse, and braking
    const maxSpeedMps = (this.wingProgress > 0.8 ? 98 : 92) * engineHealthFactor; // ~205-220 MPH top speed
    const maxReverseMps = 22;

    // Handbrake drift: SPACE + A/D breaks rear traction instead of braking hard
    const drifting = input.space && (input.a || input.d) && Math.abs(this.forwardSpeed) > 6;

    if (input.space) {
      // Plain SPACE = carbon-ceramic braking; with a steering key it becomes a drift
      const brakeDecel = drifting ? 7 : 38;
      if (Math.abs(this.forwardSpeed) < brakeDecel * dt) {
        this.forwardSpeed = 0;
      } else {
        this.forwardSpeed -= Math.sign(this.forwardSpeed) * brakeDecel * dt;
      }
      // Subtle pitch nose-dive under heavy braking
      this.pitch = THREE.MathUtils.lerp(this.pitch, -0.025 * Math.sign(this.forwardSpeed), 10 * dt);
    } else if (input.w) {
      if (this.forwardSpeed < 0) {
        // Braking from reverse
        this.forwardSpeed += 34 * dt;
      } else {
        // V12 Acceleration curve
        const speedRatio = Math.min(1, this.forwardSpeed / maxSpeedMps);
        const accel = (26.5 * (1 - speedRatio * 0.62) + (this.wingProgress > 0.9 ? 6.0 : 0)) * engineHealthFactor;
        this.forwardSpeed = Math.min(maxSpeedMps, this.forwardSpeed + accel * dt);
      }
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0.015, 6 * dt);
    } else if (input.s) {
      if (this.forwardSpeed > 1.5) {
        // Service brake / decelerate while moving forward
        this.forwardSpeed = Math.max(0, this.forwardSpeed - 28 * dt);
      } else {
        // Engage Reverse gear
        this.forwardSpeed = Math.max(-maxReverseMps, this.forwardSpeed - 14 * dt);
      }
    } else {
      // Natural rolling resistance + aerodynamic drag
      const drag = 0.25 + 0.0045 * this.forwardSpeed * Math.abs(this.forwardSpeed);
      if (Math.abs(this.forwardSpeed) < 0.4) {
        this.forwardSpeed = 0;
      } else {
        this.forwardSpeed -= Math.sign(this.forwardSpeed) * drag * dt;
      }
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0, 6 * dt);
    }

    // Steering with speed-sensitive response (A / D keys)
    const steerInput = (input.a ? 1 : 0) - (input.d ? 1 : 0);
    const speedAbs = Math.abs(this.forwardSpeed);
    const highSpeedAtten = 1 / (1 + speedAbs * (drifting ? 0.012 : 0.032));
    const targetSteer = steerInput * (drifting ? 0.62 : 0.48) * highSpeedAtten - wheelDmgPull * 0.15;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, 11 * dt);

    // Turning yaw rate (only turns when wheels are rolling)
    const turnFactor = Math.min(1, speedAbs / 3.5);
    const moveDir = this.forwardSpeed >= 0 ? 1 : -1;
    this.yawRate = this.steerAngle * 2.55 * turnFactor * moveDir * (drifting ? 1.7 : 1);
    this.heading += this.yawRate * dt;

    // Body roll during high-speed cornering
    const lateralG = this.yawRate * this.forwardSpeed;
    const targetBodyRoll = THREE.MathUtils.clamp(lateralG * 0.0035, -0.08, 0.08);
    this.roll = THREE.MathUtils.lerp(this.roll, targetBodyRoll, 9 * dt);

    // Compute world velocity with slight high-speed lateral tire slip
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    // Low lateral grip while drifting lets the momentum run wider than the nose
    const grip = drifting ? 1.6 : 10;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, forwardX * this.forwardSpeed, grip * dt);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, forwardZ * this.forwardSpeed, grip * dt);
    this.velocity.y = 0;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Suspension spring-damper following road/bridge elevation
    const targetY = this.currentSurfaceHeight;
    const yDiff = targetY - this.position.y;
    this.position.y += yDiff * Math.min(1, 18 * dt);
    this.suspensionOffset = THREE.MathUtils.clamp(-yDiff * 0.35, -0.09, 0.09);

    // Update mode indicator on ground
    const speedMph = this.forwardSpeed * MPS_TO_MPH;
    const wingEfficiency =
      Math.pow(this.wingProgress, 1.5) *
      (1 - 0.45 * (this.damage.leftWing + this.damage.rightWing));
    const liftRatio = wingEfficiency * Math.pow(Math.max(0, speedMph) / 80, 2);

    if (this.wingProgress > 0.02 && this.wingProgress < 0.98) {
      this.mode = 'TRANSFORMING_TO_FLIGHT';
    } else if (this.wingProgress >= 0.98 && liftRatio >= 0.95) {
      this.mode = 'READY_FOR_TAKEOFF';
    } else {
      this.mode = 'DRIVING';
    }

    // TAKEOFF MECHANIC:
    // Requires deployed wings (wingProgress >= 0.88), sufficient lift speed (>= 76 MPH), and holding DOWN ARROW to pitch up!
    if (this.wingProgress >= 0.88 && pitchControl > 0.1 && speedMph >= 74 && liftRatio >= 0.88) {
      // Smoothly pitch nose upward on the runway/avenue and unload suspension
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0.24, 4.5 * dt);
      if (this.pitch > 0.09) {
        this.isGrounded = false;
        this.mode = 'AIRBORNE';
        const climbRate = Math.max(4.5, this.forwardSpeed * Math.sin(this.pitch) * 1.15);
        this.velocity.y = climbRate;
        this.position.y += 0.35;
        this.triggerBanner('AIRBORNE — ARROW KEYS CONTROL PITCH & BANKED FLIGHT', 'ready', 3.5);
      }
    }
  }

  /**
   * Semi-Realistic Airborne & Aircraft Flight Physics
   */
  private updateAirborneFlightPhysics(
    dt: number,
    input: InputState,
    pitchControl: number,
    rollControl: number,
    ceilingY: number | null
  ) {
    this.mode = 'AIRBORNE';

    // Effective wing lift capability (if wings are stowed or unfolding mid-air, lift is limited!)
    const wingDamagePenalty = 1 - 0.45 * (this.damage.leftWing + this.damage.rightWing);
    const wingAreaFactor = Math.pow(this.wingProgress, 1.6) * Math.max(0.15, wingDamagePenalty);

    // Wing damage asymmetry creates a slight roll tendency
    const wingAsymmetryRoll = (this.damage.rightWing - this.damage.leftWing) * 0.45;

    // 1. Thrust & Airspeed Management (W = Thrust, S = Reduce Thrust, SPACE = Airbrake)
    const maxAirspeedMps = 118; // ~264 MPH max flight speed
    if (input.space) {
      // Airbrake deceleration
      this.forwardSpeed = Math.max(18, this.forwardSpeed - 24 * dt);
    } else if (input.w) {
      const thrust = (22 + 12 * wingAreaFactor) * (1 - 0.4 * this.damage.engine);
      this.forwardSpeed = Math.min(maxAirspeedMps, this.forwardSpeed + thrust * dt);
    } else if (input.s) {
      this.forwardSpeed = Math.max(20, this.forwardSpeed - 15 * dt);
    } else {
      // Parasitic + gravity pitch drag
      const pitchGravityEffect = -Math.sin(this.pitch) * 9.81 * 0.55;
      const aeroDrag = 0.0022 * this.forwardSpeed * this.forwardSpeed;
      this.forwardSpeed = THREE.MathUtils.clamp(
        this.forwardSpeed + (pitchGravityEffect - aeroDrag) * dt,
        15,
        maxAirspeedMps
      );
    }

    // 2. Pitch, Roll & Banked Turning with Smart Flight Stability Assist
    const controlAuthority = THREE.MathUtils.clamp(this.forwardSpeed / 32, 0.35, 1.25);

    // Pitch dynamics (DOWN ARROW = Pitch Up +, UP ARROW = Pitch Down -)
    const targetPitchRate = pitchControl * 1.35 * controlAuthority;
    this.pitchRate = THREE.MathUtils.lerp(this.pitchRate, targetPitchRate, 7.5 * dt);
    this.pitch += this.pitchRate * dt;

    // Stall nose-drop if flying too slowly or if wings are not deployed
    const speedMph = this.forwardSpeed * MPS_TO_MPH;
    const stallThresholdMph = 58;
    const isStalling = speedMph < stallThresholdMph || this.wingProgress < 0.55;

    if (isStalling && this.pitch > -0.35) {
      // Gravity naturally pulls nose downward when stalled or gliding without full wings
      this.pitch -= (0.45 * (1 - wingAreaFactor * 0.6)) * dt;
    } else if (pitchControl === 0) {
      // Smart Flight Stability Assist: gently damp pitch toward stable trim without snapping
      this.pitch = THREE.MathUtils.lerp(this.pitch, 0.015, 1.35 * dt);
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.05, 0.95);

    // Roll dynamics (LEFT/RIGHT ARROW)
    const targetRollRate = rollControl * 2.15 * controlAuthority + wingAsymmetryRoll;
    this.rollRate = THREE.MathUtils.lerp(this.rollRate, targetRollRate, 8.0 * dt);
    this.roll += this.rollRate * dt;

    if (rollControl === 0) {
      // Smart Flight Stability Assist: smoothly level wings when roll keys are released
      this.roll = THREE.MathUtils.lerp(this.roll, 0, 2.1 * dt);
    }
    this.roll = THREE.MathUtils.clamp(this.roll, -1.28, 1.28);

    // A / D yaw the nose directly; the arrow keys only bank.
    const yawControl = (input.a ? 1 : 0) - (input.d ? 1 : 0);

    // Coordinated Banked Turning: a left bank (roll > 0) tilts lift left and turns left
    const bankTurnRate =
      Math.sin(this.roll) * 1.18 * (0.4 + 0.6 * wingAreaFactor) +
      yawControl * 1.25 * controlAuthority;
    this.yawRate = THREE.MathUtils.lerp(this.yawRate, bankTurnRate, 6 * dt);
    this.heading += this.yawRate * dt;

    // 3. Lift, Gravity & 3D Velocity Vector
    // Lift scales with dynamic pressure (v^2), wing deployment progress, and cosine of roll bank angle
    const speedNormalized = Math.min(1.35, Math.max(0, this.forwardSpeed / 35.5)); // 35.5 m/s = ~80 MPH
    const liftAccel =
      9.81 *
      wingAreaFactor *
      (speedNormalized * speedNormalized) *
      Math.cos(this.roll * 0.75) *
      (1 + Math.sin(this.pitch) * 0.45);

    // Vertical velocity combines forward climb vector + aerodynamic lift - gravity
    const targetVerticalSpeed =
      this.forwardSpeed * Math.sin(this.pitch) * (0.25 + 0.75 * wingAreaFactor) +
      (liftAccel - 9.81) * 1.65;

    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVerticalSpeed, 3.8 * dt);

    const horizontalSpeed = this.forwardSpeed * Math.cos(this.pitch);
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    this.velocity.x = forwardX * horizontalSpeed;
    this.velocity.z = forwardZ * horizontalSpeed;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Check tunnel ceiling collision if flying through tunnel
    if (ceilingY !== null && this.position.y + 1.2 > ceilingY) {
      this.position.y = ceilingY - 1.2;
      this.velocity.y = -Math.abs(this.velocity.y) * 0.4;
      this.applyCrashDamage(25, 'TOP', 'ROOF / TUNNEL CEILING IMPACT');
    }

    // 4. Ground / Rooftop / Bridge / Runway Touchdown Detection
    if (this.position.y <= this.currentSurfaceHeight + 0.08) {
      this.handleTouchdown();
    }
  }

  /**
   * Evaluates landing safety vs crash severity on touchdown
   */
  private handleTouchdown() {
    this.position.y = this.currentSurfaceHeight;
    const descentSpeed = -this.velocity.y; // m/s downward
    const rollDeg = Math.abs(THREE.MathUtils.radToDeg(this.roll));
    const pitchDeg = THREE.MathUtils.radToDeg(this.pitch);
    const speedMph = this.forwardSpeed * MPS_TO_MPH;

    // Check if landing into deep water
    if (this.currentSurfaceType === 'WATER') {
      this.applyCrashDamage(85, 'BOTTOM', 'DITCHED IN EAST RIVER — PRESS [R] TO RESET');
      this.isGrounded = true;
      this.forwardSpeed *= 0.15;
      this.velocity.set(0, 0, 0);
      this.pitch = 0;
      this.roll = 0;
      return;
    }

    // Evaluate hard / improper landing criteria
    const isSteepNoseDive = pitchDeg < -24;
    const isSevereBank = rollDeg > 32;
    const isExcessiveDescent = descentSpeed > 13.5;
    const isOverspeedLanding = speedMph > 185 && descentSpeed > 7.5;

    if (isSteepNoseDive || isSevereBank || isExcessiveDescent || isOverspeedLanding) {
      const impactSeverity =
        Math.max(0, descentSpeed - 7) * 4.2 +
        (isSteepNoseDive ? 35 : 0) +
        (isSevereBank ? 28 : 0) +
        (isOverspeedLanding ? 25 : 0);

      this.applyCrashDamage(
        impactSeverity,
        isSteepNoseDive ? 'FRONT' : 'BOTTOM',
        'HARD LANDING IMPACT — STRUCTURAL DAMAGE'
      );
    } else {
      // Controlled, safe touchdown!
      if (this.currentSurfaceType === 'ROOFTOP') {
        this.triggerBanner('ROOFTOP TOUCHDOWN — HOLD [SPACE] TO BRAKE!', 'ready', 3.5);
      } else if (this.currentSurfaceType === 'RUNWAY') {
        this.triggerBanner('RUNWAY TOUCHDOWN — PRESS [F] TO STOW WINGS', 'ready', 3.2);
      } else {
        this.triggerBanner('TOUCHDOWN — TRANSITIONING TO GROUND DRIVE', 'ready', 2.5);
      }
      this.cameraShake = Math.min(0.45, Math.max(0.1, descentSpeed * 0.04));
    }

    // Compress suspension and transition smoothly back into ground driving physics
    this.isGrounded = true;
    this.mode = 'DRIVING';
    this.velocity.y = 0;
    this.suspensionOffset = -0.08;
    this.pitch = THREE.MathUtils.clamp(this.pitch * 0.25, -0.05, 0.05);
    this.roll = THREE.MathUtils.clamp(this.roll * 0.25, -0.05, 0.05);
  }

  /**
   * Resolves 3D collisions against buildings and bridge piers
   */
  private resolveBuildingCollisions() {
    // Effective vehicle bounding radius (wider when wings are deployed!)
    const bodyRadius = 1.15;
    const wingSpanRadius = this.wingProgress > 0.35 ? 1.15 + this.wingProgress * 3.6 : bodyRadius;

    const colliders = this.world.queryCollidersNear(this.position.x, this.position.z, wingSpanRadius + 4);
    const carYBottom = this.position.y + 0.15;
    const carYTop = this.position.y + 1.15;

    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];

      // If the vehicle is above the building's roof, it's flying over or driving on the rooftop — not hitting the walls
      if (carYBottom >= b.topY - 0.35 || carYTop <= b.baseY) continue;

      // Closest point on the building's 2D footprint to the car's center
      const closestX = Math.max(b.minX, Math.min(this.position.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(this.position.z, b.maxZ));

      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      // First check if outer wingtips clipped the building wall
      if (this.wingProgress > 0.45 && distSq < wingSpanRadius * wingSpanRadius && distSq >= bodyRadius * bodyRadius) {
        // Wingtip strike!
        const speedMph = Math.abs(this.forwardSpeed) * MPS_TO_MPH;
        if (speedMph > 18) {
          this.applyCrashDamage(
            Math.min(55, speedMph * 0.45),
            dx > 0 ? 'LEFT_WING' : 'RIGHT_WING',
            'WINGTIP BUILDING STRIKE — AERO SURFACE DAMAGED'
          );
          this.forwardSpeed *= 0.65;
          this.yawRate += (dx > 0 ? -1 : 1) * 2.5;
        }
      }

      // Main chassis collision with building facade
      if (distSq < bodyRadius * bodyRadius) {
        const dist = Math.sqrt(distSq) || 0.001;
        let nx = dx / dist;
        let nz = dz / dist;

        // If center penetrated inside the AABB, push out along shallowest axis
        if (dist < 0.05) {
          const penLeft = Math.abs(this.position.x - b.minX);
          const penRight = Math.abs(b.maxX - this.position.x);
          const penFront = Math.abs(this.position.z - b.minZ);
          const penBack = Math.abs(b.maxZ - this.position.z);
          const minPen = Math.min(penLeft, penRight, penFront, penBack);
          if (minPen === penLeft) {
            this.position.x = b.minX - bodyRadius;
            nx = -1;
            nz = 0;
          } else if (minPen === penRight) {
            this.position.x = b.maxX + bodyRadius;
            nx = 1;
            nz = 0;
          } else if (minPen === penFront) {
            this.position.z = b.minZ - bodyRadius;
            nx = 0;
            nz = -1;
          } else {
            this.position.z = b.maxZ + bodyRadius;
            nx = 0;
            nz = 1;
          }
        } else {
          const push = bodyRadius - dist + 0.08;
          this.position.x += nx * push;
          this.position.z += nz * push;
        }

        // Compute impact velocity along normal
        const vn = this.velocity.x * nx + this.velocity.z * nz;
        const impactMph = Math.abs(vn) * MPS_TO_MPH + (this.isGrounded ? 0 : Math.abs(this.forwardSpeed) * MPS_TO_MPH * 0.5);

        if (impactMph > 12) {
          const impactZone = Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? 'LEFT' : 'RIGHT') : 'FRONT';
          this.applyCrashDamage(impactMph * 0.62, impactZone, 'BUILDING COLLISION IMPACT');
        }

        // Bounce / deflect velocity
        this.forwardSpeed *= -0.25;
        this.velocity.x = nx * 4.5;
        this.velocity.z = nz * 4.5;

        // If airborne and slammed into a skyscraper, fall down under gravity
        if (!this.isGrounded) {
          this.forwardSpeed = Math.max(10, Math.abs(this.forwardSpeed));
          this.velocity.y = Math.min(this.velocity.y, -4.0);
          this.pitch = -0.25;
        }
        break;
      }
    }
  }

  /**
   * Severity-based Crash, Deformation, Detached Parts, Sparks & Explosion System
   */
  private applyCrashDamage(
    severity: number,
    location: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'LEFT_WING' | 'RIGHT_WING' | 'BOTTOM' | 'TOP',
    bannerText: string
  ) {
    if (this.mode === 'EXPLODED') return;

    const dmgPoints = Math.min(100, Math.max(4, severity * 0.85));
    this.health = Math.max(0, this.health - dmgPoints);
    this.cameraShake = Math.min(1.2, 0.25 + severity * 0.015);

    // Spawn collision sparks at impact point
    this.spawnImpactSparks(Math.min(35, Math.floor(8 + severity * 0.35)));

    const normSev = Math.min(1.2, severity / 65);

    // Deform or detach specific vehicle components based on impact location & severity
    if (location === 'FRONT' || location === 'BOTTOM') {
      const prev = this.damage.frontBumper;
      this.damage.frontBumper = Math.min(1.2, this.damage.frontBumper + normSev * 0.85);
      if (prev < 1 && this.damage.frontBumper >= 1) {
        this.spawnDetachedPart(new THREE.Vector3(2.0, 0.24, 0.5), 0x111418);
      }
      this.damage.windshield = Math.min(1, this.damage.windshield + normSev * 0.6);
      this.damage.wheelFL = Math.min(0.95, this.damage.wheelFL + normSev * 0.45);
      this.damage.wheelFR = Math.min(0.95, this.damage.wheelFR + normSev * 0.45);
      this.damage.engine = Math.min(0.9, this.damage.engine + normSev * 0.35);
    } else if (location === 'LEFT' || location === 'LEFT_WING') {
      const prevDoor = this.damage.leftDoor;
      this.damage.leftDoor = Math.min(1.2, this.damage.leftDoor + normSev * 0.9);
      if (prevDoor < 1 && this.damage.leftDoor >= 1) {
        this.spawnDetachedPart(new THREE.Vector3(0.18, 0.45, 1.35), 0x0c0e12);
      }
      if (this.wingProgress > 0.2 || location === 'LEFT_WING') {
        const prevWing = this.damage.leftWing;
        this.damage.leftWing = Math.min(1.2, this.damage.leftWing + normSev * 0.95);
        if (prevWing < 1 && this.damage.leftWing >= 1) {
          this.spawnDetachedPart(new THREE.Vector3(2.2, 0.08, 1.1), 0x181c22);
        }
      }
      this.damage.wheelFL = Math.min(1.1, this.damage.wheelFL + normSev * 0.5);
    } else if (location === 'RIGHT' || location === 'RIGHT_WING') {
      const prevDoor = this.damage.rightDoor;
      this.damage.rightDoor = Math.min(1.2, this.damage.rightDoor + normSev * 0.9);
      if (prevDoor < 1 && this.damage.rightDoor >= 1) {
        this.spawnDetachedPart(new THREE.Vector3(0.18, 0.45, 1.35), 0x0c0e12);
      }
      if (this.wingProgress > 0.2 || location === 'RIGHT_WING') {
        const prevWing = this.damage.rightWing;
        this.damage.rightWing = Math.min(1.2, this.damage.rightWing + normSev * 0.95);
        if (prevWing < 1 && this.damage.rightWing >= 1) {
          this.spawnDetachedPart(new THREE.Vector3(2.2, 0.08, 1.1), 0x181c22);
        }
      }
      this.damage.wheelFR = Math.min(1.1, this.damage.wheelFR + normSev * 0.5);
    } else {
      this.damage.rearDiffuser = Math.min(1.2, this.damage.rearDiffuser + normSev * 0.8);
      this.damage.windshield = Math.min(1, this.damage.windshield + normSev * 0.7);
    }

    this.car.applyDamageVisuals(this.damage);

    // Catastrophic crash -> Cinematic Explosion!
    if (this.health <= 0 || severity >= 92) {
      this.health = 0;
      this.triggerExplosion();
    } else {
      this.triggerBanner(
        severity > 40 ? `${bannerText} — PRESS [R] TO REPAIR` : bannerText,
        severity > 40 ? 'danger' : 'warning',
        3.2
      );
    }
  }

  private triggerExplosion() {
    this.mode = 'EXPLODED';
    this.forwardSpeed = 0;
    this.velocity.set(0, 6.5, 0);
    this.cameraShake = 1.6;

    // Detach multiple parts in the blast
    this.damage.frontBumper = 1.2;
    this.damage.rearDiffuser = 1.2;
    this.damage.leftDoor = 1.2;
    this.damage.rightDoor = 1.2;
    this.damage.windshield = 1.0;
    this.car.applyDamageVisuals(this.damage);

    for (let i = 0; i < 6; i++) {
      this.spawnDetachedPart(new THREE.Vector3(0.8, 0.3, 1.1), 0x14171c);
    }

    // Spawn fireball & shockwave particles
    this.spawnExplosionFireball();
    this.triggerBanner('CATASTROPHIC STRUCTURAL FAILURE — PRESS [R] TO RESET VEHICLE', 'danger', 10.0);
  }

  private updateExplodedState(dt: number) {
    // Vehicle settles onto ground and emits heavy fire/smoke until R is pressed
    if (this.position.y > this.currentSurfaceHeight) {
      this.velocity.y -= 18 * dt;
      this.position.y = Math.max(this.currentSurfaceHeight, this.position.y + this.velocity.y * dt);
    } else {
      this.position.y = this.currentSurfaceHeight;
      this.velocity.set(0, 0, 0);
    }

    this.smokeTimer += dt;
    if (this.smokeTimer > 0.04) {
      this.smokeTimer = 0;
      this.spawnSmokeAndFire(true);
    }
  }

  private spawnDetachedPart(size: THREE.Vector3, colorHex: number) {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.position).add(new THREE.Vector3(0, 0.8, 0));
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.debrisList.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        6 + Math.random() * 10,
        (Math.random() - 0.5) * 18
      ),
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      ),
      life: 14.0,
    });
  }

  private spawnImpactSparks(count: number) {
    const sparkGeo = new THREE.BoxGeometry(0.1, 0.1, 0.32);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.position.copy(this.position).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 2.2));
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 22,
          3 + Math.random() * 11,
          (Math.random() - 0.5) * 22
        ),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        scaleRate: -1.2,
        type: 'spark',
      });
    }
  }

  private spawnSmokeAndFire(withFire: boolean) {
    const isFire = withFire && Math.random() > 0.45;
    const size = isFire ? 0.55 : 0.75;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: isFire ? (Math.random() > 0.5 ? 0xff5500 : 0xffaa00) : 0x26292e,
      transparent: true,
      opacity: isFire ? 0.85 : 0.55,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.position).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.85, 0.9 + (Math.random() - 0.5) * 0.8)
    );
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2.5, 3.2 + Math.random() * 2.5, (Math.random() - 0.5) * 2.5),
      life: 0,
      maxLife: isFire ? 0.45 : 1.1,
      scaleRate: isFire ? 1.8 : 2.6,
      type: isFire ? 'fire' : 'smoke',
    });
  }

  private spawnExplosionFireball() {
    for (let i = 0; i < 42; i++) {
      const isCore = i < 22;
      const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
      const mat = new THREE.MeshBasicMaterial({
        color: isCore ? (i % 2 === 0 ? 0xff4500 : 0xffb700) : 0x1f2328,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(this.position).add(new THREE.Vector3(0, 0.9, 0));
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 26,
          2 + Math.random() * 18,
          (Math.random() - 0.5) * 26
        ),
        life: 0,
        maxLife: 0.7 + Math.random() * 0.9,
        scaleRate: 3.2,
        type: isCore ? 'fire' : 'smoke',
      });
    }
  }

  private updateDebrisAndParticles(dt: number) {
    // Update 3D detached car parts with gravity and ground bounce
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debrisList.splice(i, 1);
        continue;
      }

      d.velocity.y -= 18.5 * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.angularVelocity.x * dt;
      d.mesh.rotation.y += d.angularVelocity.y * dt;
      d.mesh.rotation.z += d.angularVelocity.z * dt;

      if (d.mesh.position.y < this.currentSurfaceHeight + 0.2) {
        d.mesh.position.y = this.currentSurfaceHeight + 0.2;
        d.velocity.y = Math.abs(d.velocity.y) * 0.42;
        d.velocity.x *= 0.78;
        d.velocity.z *= 0.78;
        d.angularVelocity.multiplyScalar(0.75);
      }
    }

    // Update sparks, smoke, and explosion fireball particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'spark') {
        p.velocity.y -= 22 * dt;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
      const s = Math.max(0.05, 1 + p.scaleRate * p.life);
      p.mesh.scale.set(s, s, s);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - p.life / p.maxLife);
    }
  }

  /**
   * Synchronizes the 3D Supercar hierarchy, wheels, and suspension with physics state
   */
  private syncCarTransform() {
    this.car.root.position.copy(this.position);

    // Apply Euler orientation (YXZ order: Heading -> Pitch -> Roll)
    this.car.root.rotation.order = 'YXZ';
    this.car.root.rotation.y = this.heading;
    this.car.root.rotation.x = this.pitch;
    this.car.root.rotation.z = this.roll;

    // Suspension travel on chassis body relative to wheels
    this.car.chassisBody.position.y = this.suspensionOffset;

    // Spin wheels when on ground or slowly coasting to a stop after takeoff
    const wheelSpeed = this.isGrounded ? this.forwardSpeed : this.forwardSpeed * 0.15;
    this.wheelRotation -= (wheelSpeed / 0.36) * 0.016;

    for (let i = 0; i < 4; i++) {
      // Front wheels (0, 1) steer with steerAngle
      if (i < 2) {
        this.car.wheelSteerPivots[i].rotation.y = this.steerAngle;
      }
      this.car.wheelSpinGroups[i].rotation.x = this.wheelRotation;
    }
  }

  /**
   * Smooth Third-Person Chase Camera with speed pullback, flight banking,
   * wing transformation framing, collision avoidance, and shake
   */
  private updateCamera(dt: number, instantSnap: boolean) {
    const speedMph = Math.abs(this.forwardSpeed) * MPS_TO_MPH;
    const speedRatio = Math.min(1, speedMph / 180);

    // Pull back slightly during wing transformation so the player gets a full view of the 11.4m wings unfolding
    const transformPullback = this.wingCameraHighlightTimer > 0 ? 1.85 : 0;
    const wingDeployedOffset = this.wingProgress * 1.15;

    const followDist = 6.8 + speedRatio * 1.9 + wingDeployedOffset + transformPullback;
    const followHeight = (this.isGrounded ? 2.25 : 2.55) + speedRatio * 0.35 + transformPullback * 0.32;

    // Compute ideal camera offset behind the vehicle's heading and pitch
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const pitchLift = this.isGrounded ? 0 : Math.sin(this.pitch) * followDist * 0.45;

    const desiredCamPos = new THREE.Vector3(
      this.position.x + sinH * followDist,
      this.position.y + followHeight - pitchLift,
      this.position.z + cosH * followDist
    );

    // Prevent camera from going below the road/rooftop surface
    const camSurf = this.evaluateSurfaceBeneath(desiredCamPos.x, desiredCamPos.y, desiredCamPos.z);
    if (desiredCamPos.y < camSurf.height + 1.15) {
      desiredCamPos.y = camSurf.height + 1.15;
    }

    // Look ahead of the vehicle along its travel vector
    const lookAheadDist = 12.0;
    const desiredLookTarget = new THREE.Vector3(
      this.position.x - sinH * lookAheadDist,
      this.position.y + 1.05 + (this.isGrounded ? 0 : Math.sin(this.pitch) * lookAheadDist * 0.65),
      this.position.z - cosH * lookAheadDist
    );

    if (instantSnap) {
      this.camPosition.copy(desiredCamPos);
      this.camLookTarget.copy(desiredLookTarget);
      this.camRoll = 0;
    } else {
      const posSmooth = 1 - Math.exp(-11.5 * dt);
      const lookSmooth = 1 - Math.exp(-15.0 * dt);
      this.camPosition.lerp(desiredCamPos, posSmooth);
      this.camLookTarget.lerp(desiredLookTarget, lookSmooth);
    }

    // Apply subtle camera shake during hard impacts, takeoff, or extreme speed
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - 2.4 * dt);
    }
    const highSpeedVibration = speedMph > 140 ? (speedMph - 140) * 0.00025 : 0;
    const totalShake = this.cameraShake + highSpeedVibration;

    this.camera.position.copy(this.camPosition);
    if (totalShake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * totalShake;
      this.camera.position.y += (Math.random() - 0.5) * totalShake;
    }

    this.camera.lookAt(this.camLookTarget);

    // Subtle banking camera tilt during flight rolls
    const targetCamRoll = this.isGrounded ? -this.roll * 0.25 : -this.roll * 0.38;
    this.camRoll = THREE.MathUtils.lerp(this.camRoll, targetCamRoll, 7 * dt);
    this.camera.rotation.z += this.camRoll;

    // Speed-sensitive FOV (62 deg base -> up to 74 deg at top flight speed)
    const targetFov = 62 + speedRatio * 12;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6 * dt);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Builds the telemetry snapshot for the Hybrid Supercar & Avionics HUD
   */
  private buildTelemetry(input: InputState): TelemetryData {
    const speedMph = Math.round(Math.abs(this.forwardSpeed) * MPS_TO_MPH);
    const speedKts = Math.round(Math.abs(this.forwardSpeed) * MPS_TO_KTS);

    // Gear & RPM calculation
    let gear = '1';
    let rpm = 1200;
    if (!this.isGrounded) {
      gear = 'AERO';
      rpm = Math.min(8500, Math.round(3200 + (speedMph / 250) * 5200));
    } else if (this.forwardSpeed < -0.5) {
      gear = 'R';
      rpm = Math.min(7000, Math.round(1500 + Math.abs(speedMph) * 110));
    } else if (speedMph < 2 && !input.w) {
      gear = 'N';
      rpm = 1100;
    } else {
      const gearIndex = Math.min(7, Math.max(1, Math.floor(speedMph / 28) + 1));
      gear = String(gearIndex);
      const gearMinSpeed = (gearIndex - 1) * 28;
      const inGearRatio = (speedMph - gearMinSpeed) / 28;
      rpm = Math.min(8500, Math.max(1600, Math.round(2800 + inGearRatio * 5400)));
    }

    const wingEfficiency =
      Math.pow(this.wingProgress, 1.5) *
      Math.max(0.1, 1 - 0.45 * (this.damage.leftWing + this.damage.rightWing));
    const liftRatio = Math.min(1.5, wingEfficiency * Math.pow(speedMph / 78, 2));
    const takeoffReady = this.wingProgress >= 0.92 && liftRatio >= 0.95;

    // Compass heading (0 = North/-Z, 90 = East/+X, 180 = South/+Z, 270 = West/-X)
    const rawDeg = ((-THREE.MathUtils.radToDeg(this.heading) % 360) + 360) % 360;
    const headingDeg = Math.round(rawDeg) % 360;

    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(this.pitch));
    const rollDeg = Math.round(THREE.MathUtils.radToDeg(this.roll));
    const altitudeFeet = Math.max(0, Math.round(this.position.y * METERS_TO_FEET));
    const altitudeAglFeet = Math.max(
      0,
      Math.round((this.position.y - this.currentSurfaceHeight) * METERS_TO_FEET)
    );
    const verticalSpeedFpm = Math.round(this.velocity.y * METERS_TO_FEET * 60);

    const stallWarning = !this.isGrounded && (speedMph < 58 || this.wingProgress < 0.55);
    const landingAligned =
      !this.isGrounded &&
      Math.abs(rollDeg) < 22 &&
      pitchDeg > -16 &&
      pitchDeg < 20 &&
      this.velocity.y > -12.0;

    return {
      mode: this.mode,
      wingStatus: this.wingStatus,
      wingProgress: this.wingProgress,
      wingTarget: this.wingTarget,
      speedMph,
      speedKts,
      rpm,
      gear,
      throttle: input.w ? 1 : 0,
      brake: input.space || input.s ? 1 : 0,
      altitudeFeet,
      altitudeAglFeet,
      verticalSpeedFpm,
      headingDeg,
      pitchDeg,
      rollDeg,
      liftRatio,
      takeoffReady,
      stallWarning,
      landingAligned,
      surfaceType: this.currentSurfaceType,
      districtName: this.world.getDistrictName(this.position.x, this.position.z),
      health: Math.round(this.health),
      damage: { ...this.damage },
      statusBanner: this.statusBanner,
      statusBannerSeverity: this.statusBannerSeverity,
      fps: this.currentFps,
    };
  }
}
