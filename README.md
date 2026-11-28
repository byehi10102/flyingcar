# AERO-V12 — Open-World 3D Flying Supercar

A browser-based open-world driving/flight sandbox: one black Lamborghini-style supercar with
mechanically unfolding wings, a dense NYC-inspired city built from instanced geometry, and a
single-file production build.

Built with React 19 + Three.js + Vite.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/ (the dev server binds all interfaces, so the LAN URL printed
in the terminal works from another device too).

## Production build

```bash
npm run build     # -> dist/index.html (everything inlined, 800 KB)
npm run preview   # serve the build on http://localhost:4173/
```

`dist/index.html` is a single self-contained file — it can be opened directly or dropped on any
static host.

## Controls

| Input | On the ground | In the air |
|---|---|---|
| `W` / `S` | accelerate / brake-reverse | thrust / reduce thrust |
| `A` / `D` | steer | yaw left / right |
| `SPACE` | brake | airbrake |
| `SPACE` + `A`/`D` | handbrake drift | — |
| `↓` / `↑` | — | pitch up / pitch down |
| `←` / `→` | — | bank left / right |
| `F` | deploy / retract wings | deploy / retract wings |
| `R` | instant repair + respawn | instant repair + respawn |
| `H` | toggle the controls card | toggle the controls card |

Takeoff: deploy wings (`F`), accelerate past 74 MPH, hold `↓` to pitch up. Landing: level the
wings, keep the descent gentle, and touch down under ~185 MPH.

## Layout

- `src/App.tsx` — renderer, lighting, input bindings, game loop
- `src/physics/PhysicsEngine.ts` — driving, flight, collisions, damage, chase camera, telemetry
- `src/world/CityBuilder.ts` — city generation, colliders, elevated surfaces
- `src/world/ProceduralTextures.ts` — all canvas-drawn textures and the environment cubemap
- `src/vehicle/SupercarModel.ts` — car geometry and the staged wing transformation
- `src/components/SupercarAvionicsHud.tsx` — HUD
