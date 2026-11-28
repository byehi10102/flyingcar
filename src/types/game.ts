import * as THREE from 'three';

export type VehicleMode =
  | 'DRIVING'
  | 'TRANSFORMING_TO_FLIGHT'
  | 'READY_FOR_TAKEOFF'
  | 'AIRBORNE'
  | 'LANDING_ROLLOUT'
  | 'CRASHED'
  | 'EXPLODED';

export type WingStatus =
  | 'STOWED'
  | 'STAGE_1_BAYS_UNLOCKING'
  | 'STAGE_2_ROOT_SPARS_EXTENDING'
  | 'STAGE_3_MAIN_FOIL_SWEEPING'
  | 'STAGE_4_OUTER_WINGS_LOCKING'
  | 'DEPLOYED_LOCKED'
  | 'RETRACTING_OUTER_WINGS'
  | 'RETRACTING_MAIN_FOIL'
  | 'RETRACTING_ROOT_SPARS'
  | 'CLOSING_BAYS'
  | 'JAMMED_DAMAGED';

export interface ComponentDamage {
  frontBumper: number; // 0 = intact, 0..1 = deformed, >= 1 = detached
  rearDiffuser: number;
  leftDoor: number;
  rightDoor: number;
  windshield: number;
  leftWing: number;
  rightWing: number;
  wheelFL: number;
  wheelFR: number;
  wheelRL: number;
  wheelRR: number;
  engine: number;
}

export interface TelemetryData {
  mode: VehicleMode;
  wingStatus: WingStatus;
  wingProgress: number; // 0.0 (stowed) to 1.0 (fully deployed)
  wingTarget: number; // 0 or 1
  speedMph: number;
  speedKts: number;
  rpm: number;
  gear: string;
  throttle: number;
  brake: number;
  altitudeFeet: number;
  altitudeAglFeet: number;
  verticalSpeedFpm: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  liftRatio: number; // 0.0 to 1.5+ (1.0 = sufficient lift for takeoff)
  takeoffReady: boolean;
  stallWarning: boolean;
  landingAligned: boolean;
  surfaceType: 'ROAD' | 'HIGHWAY' | 'BRIDGE' | 'RUNWAY' | 'ROOFTOP' | 'PARK' | 'TUNNEL' | 'AIR' | 'WATER';
  districtName: string;
  health: number; // 0 to 100
  damage: ComponentDamage;
  statusBanner: string | null;
  statusBannerSeverity: 'info' | 'ready' | 'warning' | 'danger';
  fps: number;
}

export interface BuildingCollider {
  id: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  topY: number;
  isLandableRoof: boolean;
  district: string;
}

export interface ElevatedSurface {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  getHeightAt: (x: number, z: number) => number | null;
  getNormalAt?: (x: number, z: number) => THREE.Vector3;
  surfaceType: 'HIGHWAY' | 'BRIDGE' | 'RUNWAY' | 'TUNNEL';
  ceilingY?: number; // For tunnels or underpasses
}

export interface DetachedDebris {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  life: number;
}

export interface ParticleItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scaleRate: number;
  type: 'spark' | 'smoke' | 'fire' | 'shockwave';
}
