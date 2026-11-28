import React, { useState, useEffect } from 'react';
import { TelemetryData, WingStatus } from '../types/game';

interface Props {
  telemetry: TelemetryData;
  onToggleWings: () => void;
  onResetVehicle: () => void;
}

function formatWingStatusLabel(status: WingStatus): string {
  switch (status) {
    case 'STOWED':
      return 'WINGS STOWED // ROAD CONFIG';
    case 'STAGE_1_BAYS_UNLOCKING':
      return 'STAGE 1/4 // UNLOCKING SIDE BAYS';
    case 'STAGE_2_ROOT_SPARS_EXTENDING':
      return 'STAGE 2/4 // EXTENDING TITANIUM SPARS';
    case 'STAGE_3_MAIN_FOIL_SWEEPING':
      return 'STAGE 3/4 // SWEEPING MAIN AIRFOILS';
    case 'STAGE_4_OUTER_WINGS_LOCKING':
      return 'STAGE 4/4 // UNFOLDING OUTER WINGS';
    case 'DEPLOYED_LOCKED':
      return 'AERO LOCK ENGAGED // 11.4M SPAN';
    case 'JAMMED_DAMAGED':
      return 'ACTUATOR FAULT // WINGS DAMAGED';
    default:
      return 'TRANSITIONING AERO MECHANISM';
  }
}

function getPartStrokeColor(dmgValue: number): string {
  if (dmgValue >= 0.95) return '#EF4444'; // Detached / Critical
  if (dmgValue >= 0.25) return '#F59E0B'; // Deformed / Damaged
  return '#38BDF8'; // Intact Nominal
}

function getCardinalDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export const SupercarAvionicsHud: React.FC<Props> = ({
  telemetry,
  onToggleWings,
  onResetVehicle,
}) => {
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setShowControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isAeroActive = telemetry.wingProgress > 0.04 || telemetry.mode === 'AIRBORNE';
  const isAirborne = telemetry.mode === 'AIRBORNE';
  const rpmPercent = Math.min(100, Math.max(0, (telemetry.rpm / 8500) * 100));
  const liftPercent = Math.min(100, Math.round(telemetry.liftRatio * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* =====================================================================
          TOP BAR: COMPASS HEADING TAPE, DISTRICT, SURFACE & STATUS ALERTS
         ===================================================================== */}
      <div className="flex flex-col items-center gap-2">
        <div className="hud-glass hud-chamfer flex items-center gap-5 px-6 py-2">
          {/* District & Surface Badge */}
          <div className="flex items-center gap-2.5 border-r border-white/15 pr-4">
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            <div>
              <div className="font-rajdhani text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                SECTOR // {telemetry.surfaceType}
              </div>
              <div className="font-rajdhani text-xs font-bold tracking-[0.12em] text-slate-100 uppercase">
                {telemetry.districtName}
              </div>
            </div>
          </div>

          {/* Digital Compass Tape */}
          <div className="flex items-center gap-3">
            <div className="font-mono-tech text-xs text-slate-400">
              {String((telemetry.headingDeg + 345) % 360).padStart(3, '0')}°
            </div>
            <div className="rounded bg-sky-500/15 px-2.5 py-0.5 border border-sky-400/40 font-mono-tech text-sm font-bold text-sky-300">
              {String(telemetry.headingDeg).padStart(3, '0')}° {getCardinalDirection(telemetry.headingDeg)}
            </div>
            <div className="font-mono-tech text-xs text-slate-400">
              {String((telemetry.headingDeg + 15) % 360).padStart(3, '0')}°
            </div>
          </div>

          {/* Mode & FPS */}
          <div className="flex items-center gap-3 border-l border-white/15 pl-4">
            <div
              className={`rounded px-2 py-0.5 font-rajdhani text-xs font-bold tracking-wider uppercase ${
                telemetry.mode === 'EXPLODED'
                  ? 'bg-red-500/25 text-red-300 border border-red-500/50'
                  : isAirborne
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50'
                  : telemetry.takeoffReady
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                  : 'bg-white/10 text-slate-200'
              }`}
            >
              {telemetry.mode.replace(/_/g, ' ')}
            </div>
            <span className="font-mono-tech text-[11px] text-slate-400">{telemetry.fps} FPS</span>
          </div>
        </div>

        {/* Dynamic Status / Takeoff / Touchdown Banner */}
        {telemetry.statusBanner && (
          <div
            className={`hud-glass rounded px-4 py-1.5 font-rajdhani text-xs font-bold tracking-[0.16em] uppercase transition-all ${
              telemetry.statusBannerSeverity === 'danger'
                ? 'border-red-500/60 bg-red-950/75 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : telemetry.statusBannerSeverity === 'warning'
                ? 'border-amber-400/60 bg-amber-950/75 text-amber-200'
                : telemetry.statusBannerSeverity === 'ready'
                ? 'border-emerald-400/60 bg-emerald-950/75 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                : 'border-sky-400/50 text-sky-200'
            }`}
          >
            {telemetry.statusBanner}
          </div>
        )}

        {/* Take-off prompt when wings are locked on the ground */}
        {!isAirborne && telemetry.wingProgress >= 0.95 && telemetry.mode !== 'EXPLODED' && (
          <div
            className={`rounded-full px-4 py-1 font-rajdhani text-xs font-bold tracking-[0.14em] uppercase border backdrop-blur-md ${
              telemetry.takeoffReady
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300 animate-pulse'
                : 'bg-slate-900/75 border-white/15 text-slate-300'
            }`}
          >
            {telemetry.takeoffReady
              ? 'LIFT VELOCITY ACHIEVED — HOLD [DOWN ARROW] TO PITCH UP & TAKE OFF'
              : `BUILD SPEED TO 78+ MPH FOR TAKEOFF LIFT (${telemetry.speedMph} / 78 MPH)`}
          </div>
        )}
      </div>

      {/* =====================================================================
          CENTER AVIONICS ARTIFICIAL HORIZON & FLIGHT TAPES (WHEN WINGS ACTIVE)
         ===================================================================== */}
      <div
        className={`relative my-auto flex items-center justify-between transition-opacity duration-500 ${
          isAeroActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left Avionics Tape: Airspeed (KTS) & Lift Readiness Bar */}
        <div className="hud-glass hud-chamfer ml-2 flex flex-col gap-2.5 p-3.5 w-36">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-rajdhani text-[10px] font-bold tracking-[0.18em] text-sky-400 uppercase">
              IAS // AIRSPEED
            </span>
            <span className="font-mono-tech text-xs text-slate-400">KTS</span>
          </div>
          <div className="font-orbitron text-2xl font-bold text-white">
            {telemetry.speedKts}
            <span className="ml-1 font-rajdhani text-xs font-medium text-slate-400">KTS</span>
          </div>

          {/* Aerodynamic Lift Bar */}
          <div className="mt-1">
            <div className="mb-1 flex justify-between font-rajdhani text-[10px] font-semibold tracking-wider uppercase">
              <span className="text-slate-400">AERO LIFT</span>
              <span className={liftPercent >= 95 ? 'text-emerald-400' : 'text-sky-300'}>
                {liftPercent}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-150 ${
                  liftPercent >= 95 ? 'bg-emerald-400' : 'bg-sky-400'
                }`}
                style={{ width: `${liftPercent}%` }}
              />
            </div>
          </div>

          {/* Attitude Pitch & Roll Digital Readout */}
          <div className="mt-1 grid grid-cols-2 gap-1 border-t border-white/10 pt-2 font-mono-tech text-[11px]">
            <div>
              <span className="text-slate-400">PCH </span>
              <span className="text-white">{telemetry.pitchDeg > 0 ? `+${telemetry.pitchDeg}` : telemetry.pitchDeg}°</span>
            </div>
            <div>
              <span className="text-slate-400">BNK </span>
              <span className="text-white">{telemetry.rollDeg > 0 ? `+${telemetry.rollDeg}` : telemetry.rollDeg}°</span>
            </div>
          </div>
        </div>

        {/* Center Minimalist Pitch & Roll Artificial Horizon SVG Reticle */}
        <div className="relative flex flex-col items-center justify-center">
          <svg
            width="280"
            height="220"
            viewBox="-140 -110 280 220"
            className="overflow-visible opacity-65"
          >
            {/* Fixed Aircraft Wing Reference Symbol */}
            <path
              d="M -42 0 L -14 0 L -8 6 M 42 0 L 14 0 L 8 6 M -3 0 L 3 0"
              stroke="#38BDF8"
              strokeWidth="2"
              fill="none"
            />
            {/* Rotating & Pitching Artificial Horizon Ladder */}
            <g
              transform={`rotate(${-telemetry.rollDeg}) translate(0, ${Math.max(
                -65,
                Math.min(65, telemetry.pitchDeg * 2.2)
              )})`}
            >
              {/* Horizon Line */}
              <line x1="-85" y1="0" x2="-24" y2="0" stroke="#10B981" strokeWidth="1.5" />
              <line x1="24" y1="0" x2="85" y2="0" stroke="#10B981" strokeWidth="1.5" />
              {/* +10 deg Pitch Ladder */}
              <path
                d="M -45 -25 L -20 -25 L -20 -20 M 45 -25 L 20 -25 L 20 -20"
                stroke="#38BDF8"
                strokeWidth="1.2"
                fill="none"
              />
              {/* -10 deg Pitch Ladder (dashed) */}
              <path
                d="M -45 25 L -20 25 L -20 20 M 45 25 L 20 25 L 20 20"
                stroke="#F59E0B"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                fill="none"
              />
            </g>
          </svg>

          {/* Stall Warning or Landing Alignment Pill */}
          {telemetry.stallWarning && (
            <div className="mt-1 rounded bg-red-600/80 px-3 py-0.5 font-rajdhani text-xs font-bold tracking-[0.2em] text-white uppercase animate-pulse">
              STALL WARNING // INCREASE AIRSPEED OR LOWER NOSE
            </div>
          )}
          {isAirborne && !telemetry.stallWarning && telemetry.altitudeAglFeet < 180 && (
            <div
              className={`mt-1 rounded px-3 py-0.5 font-rajdhani text-[11px] font-bold tracking-[0.16em] uppercase ${
                telemetry.landingAligned
                  ? 'bg-emerald-500/30 border border-emerald-400/60 text-emerald-200'
                  : 'bg-amber-500/30 border border-amber-400/60 text-amber-200'
              }`}
            >
              {telemetry.landingAligned
                ? 'APPROACH STABLE // READY FOR TOUCHDOWN'
                : 'CAUTION // LEVEL WINGS & SLOW DESCENT FOR LANDING'}
            </div>
          )}
        </div>

        {/* Right Avionics Tape: Altitude (FT ASL & AGL) + Vertical Speed (FPM) */}
        <div className="hud-glass hud-chamfer mr-2 flex flex-col gap-2.5 p-3.5 w-40">
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <span className="font-rajdhani text-[10px] font-bold tracking-[0.18em] text-sky-400 uppercase">
              ALTITUDE
            </span>
            <span className="font-mono-tech text-xs text-slate-400">FT</span>
          </div>
          <div className="font-orbitron text-2xl font-bold text-white">
            {telemetry.altitudeFeet}
            <span className="ml-1 font-rajdhani text-xs font-medium text-slate-400">ASL</span>
          </div>

          <div className="flex items-center justify-between font-mono-tech text-xs">
            <span className="text-slate-400">RADAR AGL</span>
            <span className="text-emerald-300">{telemetry.altitudeAglFeet} FT</span>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-2 font-mono-tech text-xs">
            <span className="text-slate-400">V/S FPM</span>
            <span
              className={
                telemetry.verticalSpeedFpm >= 0 ? 'text-sky-300' : 'text-amber-300'
              }
            >
              {telemetry.verticalSpeedFpm > 0
                ? `+${telemetry.verticalSpeedFpm}`
                : telemetry.verticalSpeedFpm}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BOTTOM ROW: CONTROLS CARD (LEFT) & SUPERCAR TELEMETRY BINNACLE (RIGHT)
         ===================================================================== */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left Controls & Quick Action Panel */}
        <div className="pointer-events-auto flex flex-col gap-2">
          {showControls ? (
            <div className="hud-glass hud-chamfer max-w-xs p-3.5 text-xs">
              <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="font-rajdhani text-[11px] font-bold tracking-[0.18em] text-sky-400 uppercase">
                  AERO-V12 FLIGHT & DRIVE SYSTEMS
                </span>
                <button
                  onClick={() => setShowControls(false)}
                  className="rounded bg-white/10 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:bg-white/20"
                >
                  [H] HIDE
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-rajdhani text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">THRUST / DRIVE</span>
                  <kbd className="font-mono-tech text-white">W / S</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">STEER (GROUND)</span>
                  <kbd className="font-mono-tech text-white">A / D</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">BRAKE / AIRBRAKE</span>
                  <kbd className="font-mono-tech text-white">SPACE</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">DEPLOY WINGS</span>
                  <kbd className="font-mono-tech text-sky-300 font-bold">F</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TAKEOFF / PITCH</span>
                  <kbd className="font-mono-tech text-emerald-300">↓ / ↑</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ROLL / BANK</span>
                  <kbd className="font-mono-tech text-emerald-300">← / →</kbd>
                </div>
                <div className="col-span-2 mt-1 flex justify-between border-t border-white/10 pt-1">
                  <span className="text-slate-400">INSTANT REPAIR & SPAWN RESET</span>
                  <kbd className="font-mono-tech text-amber-300 font-bold">R</kbd>
                </div>
              </div>

              {/* Interactive Action Buttons for Convenience */}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={onToggleWings}
                  className="flex-1 rounded bg-sky-500/20 border border-sky-400/50 py-1 font-rajdhani text-xs font-bold tracking-wider text-sky-200 uppercase hover:bg-sky-500/35 transition"
                >
                  [F] {telemetry.wingTarget === 1 ? 'STOW WINGS' : 'UNFOLD WINGS'}
                </button>
                <button
                  onClick={onResetVehicle}
                  className="rounded bg-white/10 border border-white/20 px-3 py-1 font-rajdhani text-xs font-bold tracking-wider text-slate-200 uppercase hover:bg-white/20 transition"
                >
                  [R] RESET
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowControls(true)}
              className="hud-glass rounded px-3 py-1.5 font-rajdhani text-xs font-bold tracking-widest text-slate-300 uppercase hover:text-white"
            >
              [H] SHOW CONTROLS
            </button>
          )}
        </div>

        {/* Bottom-Right Supercar Telemetry Binnacle + Wing Progress + Damage Wireframe */}
        <div className="hud-glass hud-chamfer flex items-center gap-5 px-5 py-3.5">
          {/* Wireframe Chassis & Wing Structural Integrity Diagram */}
          <div className="flex flex-col items-center border-r border-white/10 pr-4">
            <svg width="86" height="76" viewBox="-45 -38 90 76">
              {/* Left & Right Unfolding Wings on Schematic */}
              {telemetry.wingProgress > 0.05 && (
                <>
                  <polygon
                    points={`-10,-4 ${-10 - telemetry.wingProgress * 32},2 ${
                      -10 - telemetry.wingProgress * 30
                    },14 -10,10`}
                    fill="rgba(56, 189, 248, 0.18)"
                    stroke={getPartStrokeColor(telemetry.damage.leftWing)}
                    strokeWidth="1.6"
                  />
                  <polygon
                    points={`10,-4 ${10 + telemetry.wingProgress * 32},2 ${
                      10 + telemetry.wingProgress * 30
                    },14 10,10`}
                    fill="rgba(56, 189, 248, 0.18)"
                    stroke={getPartStrokeColor(telemetry.damage.rightWing)}
                    strokeWidth="1.6"
                  />
                </>
              )}

              {/* Front Bumper */}
              <path
                d="M -9 -22 L 0 -27 L 9 -22"
                fill="none"
                stroke={getPartStrokeColor(telemetry.damage.frontBumper)}
                strokeWidth="2.2"
              />
              {/* Main Chassis Side Doors */}
              <line
                x1="-10"
                y1="-18"
                x2="-10"
                y2="16"
                stroke={getPartStrokeColor(telemetry.damage.leftDoor)}
                strokeWidth="2.2"
              />
              <line
                x1="10"
                y1="-18"
                x2="10"
                y2="16"
                stroke={getPartStrokeColor(telemetry.damage.rightDoor)}
                strokeWidth="2.2"
              />
              {/* Windshield & Canopy */}
              <rect
                x="-6"
                y="-11"
                width="12"
                height="16"
                rx="2"
                fill="none"
                stroke={getPartStrokeColor(telemetry.damage.windshield)}
                strokeWidth="1.5"
              />
              {/* Rear Diffuser */}
              <line
                x1="-9"
                y1="22"
                x2="9"
                y2="22"
                stroke={getPartStrokeColor(telemetry.damage.rearDiffuser)}
                strokeWidth="2.2"
              />
            </svg>
            <div className="mt-1 flex items-center gap-1.5 font-mono-tech text-[11px]">
              <span className="text-slate-400">HULL</span>
              <span
                className={
                  telemetry.health > 65
                    ? 'text-emerald-400'
                    : telemetry.health > 30
                    ? 'text-amber-400'
                    : 'text-red-400'
                }
              >
                {telemetry.health}%
              </span>
            </div>
          </div>

          {/* Speedometer, RPM Bar, Gear & Wing Mechanical Progress */}
          <div className="flex flex-col min-w-[215px]">
            {/* RPM Sweeping Bar */}
            <div className="mb-1 flex items-center justify-between font-mono-tech text-[10px] text-slate-400">
              <span>V12 REV // {telemetry.rpm} RPM</span>
              <span>8,500 MAX</span>
            </div>
            <div className="mb-2.5 h-2 w-full overflow-hidden rounded-sm bg-white/10">
              <div
                className={`h-full transition-all duration-75 ${
                  rpmPercent > 86
                    ? 'bg-gradient-to-r from-sky-400 via-amber-400 to-red-500'
                    : 'bg-gradient-to-r from-sky-500 to-cyan-300'
                }`}
                style={{ width: `${rpmPercent}%` }}
              />
            </div>

            {/* Digital Speed & Gear */}
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-orbitron text-5xl font-extrabold tracking-tight text-white">
                  {String(telemetry.speedMph).padStart(3, '0')}
                </span>
                <span className="font-rajdhani text-sm font-bold tracking-widest text-slate-400 uppercase">
                  MPH
                </span>
              </div>

              {/* Gear Box Readout */}
              <div className="flex flex-col items-end">
                <span className="font-rajdhani text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                  GEAR
                </span>
                <span className="rounded bg-white/10 px-2.5 py-0.5 font-orbitron text-lg font-bold text-sky-300 border border-white/15">
                  {telemetry.gear}
                </span>
              </div>
            </div>

            {/* Mechanical Wing Transformation Progress Bar */}
            <div className="mt-2.5 border-t border-white/10 pt-2">
              <div className="mb-1 flex items-center justify-between font-rajdhani text-[10px] font-bold tracking-[0.14em] uppercase">
                <span
                  className={
                    telemetry.wingStatus === 'DEPLOYED_LOCKED'
                      ? 'text-emerald-400'
                      : telemetry.wingStatus === 'JAMMED_DAMAGED'
                      ? 'text-red-400'
                      : 'text-sky-300'
                  }
                >
                  {formatWingStatusLabel(telemetry.wingStatus)}
                </span>
                <span className="font-mono-tech text-slate-300">
                  {Math.round(telemetry.wingProgress * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full transition-all duration-100 ${
                    telemetry.wingStatus === 'DEPLOYED_LOCKED'
                      ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                      : 'bg-sky-400'
                  }`}
                  style={{ width: `${ Math.round(telemetry.wingProgress * 100) }%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
