# TAREA 3 PARA CODEX — Refactor de perspectiva del match (SIN estética)

> Cómo usar: abrí Codex en `trucoloco-thegame/trucoloco-web` y decile:
> **"Leé ../CODEX_TASK_3.md y ejecutá la tarea."**
> Es el paso 1 de `../MULTIPLAYER_DESIGN.md` — leelo entero antes de empezar.
> ⛔ NO toques: nada en `src/game/scene/`, `src/game/ui/Hud.jsx`, `src/App.jsx`,
> `src/styles.css`, `src/game/audio/`, `src/game/net/`. Tu único territorio es
> `src/game/hooks/useTrucolocoMatch.js`, `src/game/rules/truco.js` (solo si
> hace falta mover funciones puras) y `scripts/validate-*.mjs` (para AGREGAR
> tests, no aflojar los existentes).

## Objetivo

Hoy `useTrucolocoMatch` está escrito en primera persona: `selectedRole`,
`humanHand`, "lane humano vs rival". Para el multiplayer (host autoritativo
con 6 asientos humanos) necesitamos separar:

1. **Núcleo de mesa** (estado global sin "vos"): `handsBySeat` como única
   fuente de verdad de manos, turnos por `seatId`, cantos con equipo
   caller/target, acuerdo de negociantes por equipo. Debe poder serializarse
   entero con `JSON.stringify` (snapshot) y restaurarse con una función
   `hydrateMatchState(snapshot)` que dejás exportada.
2. **Perspectiva** (vista derivada): una función pura
   `deriveView(coreState, mySeatId)` que produce EXACTAMENTE el shape que hoy
   consume el HUD/escena (`humanHand`, `activeLane`, `canPlayCard`, `phase`,
   `tableFlow`, etc.) para el asiento dado. El hook actual pasa a ser:
   núcleo + `deriveView(state, seatDelJugadorLocal)`.

## Contrato ESTRICTO (lo que no puede cambiar)

- La interfaz externa del hook queda IDÉNTICA: mismos campos, mismos nombres,
  mismas acciones. `Hud.jsx`, `Table.jsx`, `TrucolocoScene.jsx` y `App.jsx`
  NO se tocan y deben seguir funcionando sin un solo cambio.
- Los 4 checks pasan: `npm run check:rules && npm run check:flow &&
  npm run build && npm run check:ui` (check:ui con dev server en 5173).
- El juego local vs bots se comporta EXACTAMENTE igual (mismos textos, mismos
  gates, mismo flujo de fases).

## Entregables extra

- `getSnapshot(state)` y `hydrateMatchState(snapshot)` exportados y probados:
  agregá un test en `scripts/validate-truco-flow.mjs` que tome un estado a
  mitad de mano, lo serialice, lo hidrate y verifique que `deriveView` da lo
  mismo antes y después (deepEqual).
- Test de perspectiva: `deriveView` del MISMO estado para dos seatIds
  distintos debe dar `humanHand` distintas y consistentes con `handsBySeat`.
- Documentá el resultado en `../TRUCOLOCO_TRACKLIST.md` (sección
  "HECHO por Codex", con fecha) y una nota corta de API en
  `../MULTIPLAYER_DESIGN.md` al final (sección "Paso 1 — implementado").

## Por qué vos

Es un refactor de lógica pura con contrato verificable y cero estética —
exactamente tu terreno. Si algo del contrato es imposible sin tocar archivos
prohibidos, PARÁ y anotá el bloqueo en el tracklist en vez de forzarlo.
