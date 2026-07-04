# TAREA 4 PARA CODEX — Refactor de perspectiva del match (lógica pura, sin estética)

> Dásela a Codex CUANDO TERMINE la Sala del Conflicto (CODEX_TASK_3). Es el
> corazón del multiplayer coherente y es 100% programación fina con contrato
> verificable — exactamente lo que Codex hace mejor.
> Cómo usar: abrí Codex en `trucoloco-web` y decile:
> **"Leé ../CODEX_TASK_4.md y ejecutá la tarea."**
> Leé antes `../MULTIPLAYER_DESIGN.md` (sección 5 "La perspectiva").

## ⛔ NO TOCAR (territorio de Claude/Opus, en curso)

`src/App.jsx`, `src/game/net/`, `src/game/scene/`, `src/game/ui/`,
`src/styles.css`, `src/game/data/`, `src/game/conflict/` (tu Sala del Conflicto,
ya terminada), `index.html`.

## Tu único territorio

`src/game/hooks/useTrucolocoMatch.js` y, si hace falta mover funciones puras,
`src/game/rules/truco.js`. Además podés AGREGAR tests a `scripts/validate-*.mjs`
(nunca aflojar los existentes).

## El problema (concreto)

Hoy la perspectiva ("quién sos vos en la mesa") está hardcodeada a que SIEMPRE
sos el equipo A con el rol elegido. El acople vive en dos helpers:

```js
const getSelectedSeatId = (role) => getSeatByTeamRole("A", role).seatId;   // línea ~97
const getOppositeSeatId = (role) => getSeatByTeamRole("B", role).seatId;   // línea ~98
```

y se usa para derivar `humanHand`, `rivalHand`, `activeLane`, gates de canto,
etc. (buscá `getSelectedSeatId` / `getOppositeSeatId` — hay ~6 usos).

Para el multiplayer, "vos" podés ser CUALQUIER `seatId` de los 6 (no solo
team-A + rol). Necesitamos que la perspectiva sea un parámetro, no una constante.

## La tarea

1. **Introducí `mySeatId`** como fuente de la perspectiva. El hook
   `useTrucolocoMatch` debe aceptar un `mySeatId` opcional (default: el seat
   de team A con el rol elegido, para preservar el comportamiento local actual).
   Todos los `getSelectedSeatId(selectedRole)` pasan a usar `mySeatId`, y
   `getOppositeSeatId` pasa a ser "el rival relevante para mi asiento" (el
   `oppositeSeatId` del seat en `tableSeats`).

2. **`deriveView(coreState, mySeatId)`** — extraé una función PURA que produzca
   EXACTAMENTE el shape que hoy consume el HUD/escena (`humanHand`, `rivalHand`,
   `activeLane`, `selectedSeatId`, `oppositeSeatId`, gates `canPlayCard` etc.)
   para el asiento dado. El hook = núcleo (state) + `deriveView(state, mySeatId)`.

3. **Exportá una API funcional pura** (sin React) reutilizable por el host
   autoritativo:
   - `getSnapshot(hookState)` y `hydrate(snapshot)` ya existen (Fable) — dejalos.
   - `applyIntent(coreState, { seatId, action, payload })` → nuevo `coreState`:
     una reducción PURA que valida el intent contra los gates (turno, asiento,
     fase) y aplica `playSeatCard` / cantos / etc. Devuelve el mismo state si el
     intent es inválido. Esta es la pieza que el host usará para procesar las
     jugadas de los guests. Acciones mínimas: `playCard`, `callEnvido`,
     `callTruco`, `acceptTruco`, `rejectTruco`, `raiseTruco`, `advance`.

## Contrato ESTRICTO (no negociable)

- La interfaz externa del hook queda IDÉNTICA (mismos campos y acciones).
  `Hud.jsx`, `Table.jsx`, `TrucolocoScene.jsx`, `App.jsx` NO se tocan y siguen
  funcionando sin un cambio. Con `mySeatId` en default, el juego local vs bots
  se comporta EXACTAMENTE igual.
- Los 4 checks pasan: `npm run check:rules && npm run check:flow &&
  npm run build && npm run check:ui` (check:ui con dev server en 5173).

## Tests que debés AGREGAR (en validate-truco-flow.mjs)

- `deriveView(sameState, "A-cartachin")` vs `deriveView(sameState, "B-negociante")`
  dan `humanHand` distintas y consistentes con `handsBySeat`.
- snapshot → hydrate → `deriveView` da lo mismo antes y después (deepEqual).
- `applyIntent` con un intent fuera de turno NO cambia el state; con un intent
  válido en turno, la carta pasa de `handsBySeat[seat]` a `tableCards`.

## Al terminar

Documentá en `../TRUCOLOCO_TRACKLIST.md` (sección "HECHO por Codex", con fecha)
y agregá una nota de API al final de `../MULTIPLAYER_DESIGN.md`
("Paso 1 — implementado: firma de deriveView / applyIntent"). Si algo del
contrato es imposible sin tocar archivos prohibidos, PARÁ y anotá el bloqueo
en el tracklist en vez de forzarlo.


## Agregado 2026-07-04 (Fable) — tests de gates de canto

Al extraer `deriveView(state, mySeatId)` pura, sumá a `scripts/` tests que
blinden los gates del truco común (hoy no son testeables porque viven dentro
del hook de React):

1. **Envido**: solo cantable en la primera vuelta, antes de que tu asiento
   juegue su carta; respeta quién es mano; no cantable con truco pendiente.
2. **Cadena del truco**: truco→retruco→vale cuatro, solo puede subir quien
   tiene el derecho (el que aceptó la última suba); nunca dos subas seguidas
   del mismo equipo.
3. **Quiero/No quiero**: solo el equipo cantado puede responder.
4. **Modo de juego**: con `gameMode: "comun"` el estado inicial no tiene
   cartas bonus en ninguna mano ni armas (ya implementado en el hook — ver
   `dealSeatHands(pool, gameMode)`); tu refactor debe conservar ese parámetro.

Estos tests corren en `check:rules` o `check:flow` (Node puro).
