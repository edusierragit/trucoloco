# Trucoloco Web

Pivot web del proyecto para trabajar con una arquitectura mas amigable a `vibecoding`.

## Stack

- `Vite`
- `React`
- `Three.js` via `@react-three/fiber`
- `@react-three/drei`

## Objetivo de este slice

- Mesa 3D y atmosfera turbia
- HUD 2D legible
- Mano jugable minima
- Cartas del centro
- Roles `3v3` visibles
- Tono argentino y caotico

## Scripts

```bash
npm run dev            # dev server (vite)
npm run build          # build de produccion
npm run check:rules    # valida cantos y puntos del truco (node puro)
npm run check:flow     # valida el flujo de una mano completa (node puro)
npm run check:ui       # valida la UI real por CDP (necesita dev server + Chromium)
npm run test           # tests unitarios (vitest): capa de red y validaciones
npm run lint           # eslint (react-hooks incluido)
npm run format         # prettier sobre src/ y scripts/
npm run dev:mcp        # dev server + bridge MCP de three.js
npm run mcp:three      # bridge MCP manual
```

Los 4 checks (`check:rules`, `check:flow`, `check:ui`, `build`) son
obligatorios antes de cada push: el workflow de GitHub Pages los corre y no
despliega si alguno falla.

## Multiplayer: modelo host-autoritativo

No hay servidor: las salas son P2P por WebRTC (`trystero` sobre relays
nostr). El codigo vive en `src/game/net/` y el diseño completo en
`../MULTIPLAYER_DESIGN.md`.

- **El host es la unica verdad.** El creador de la sala corre el match real
  (`useTrucolocoMatch`). Tras cada mutacion emite un *snapshot* del estado;
  al crear la sala emite uno inicial para que el que entra vea la mesa al
  instante.
- **Los guests hidratan, no simulan.** Un guest aplica el snapshot a su
  pantalla (`hydrate`), que valida el shape antes de pisar nada
  (`isValidSnapshotState`). Solo se aceptan snapshots del peer identificado
  como host — un snap forjado por otro guest se descarta.
- **Las jugadas de guests viajan como intents.** Un guest sentado no muta su
  partida local: manda `{action, seatId, payload}` (jugar carta, envido,
  truco, quiero/no quiero) y el host lo valida dos veces — que la silla sea
  la que ese peer reclamo en la sala, y que la jugada pase los mismos gates
  del match que usa el host para si mismo (turno, fase, carta en mano). La
  vista del guest (`src/game/net/guestView.js`) expone la misma interfaz del
  hook, con su mano y sus gates derivados de SU silla.
- **El auto-play del host respeta a los humanos.** Las sillas sin humano las
  juegan bots con cadencia; si la silla del turno la reclamo un humano
  remoto, el host espera su intent.

### Limitaciones actuales (a proposito, no bugs)

- Los **poderes de rol** (armas del Cartachin, negociacion, acuerdo) siguen
  siendo solo del host; los guests juegan cartas y cantan.
- **Sin bot suplente por timeout**: si un guest sentado se va sin soltar la
  silla, su turno queda esperando (el diseño del suplente esta en
  `MULTIPLAYER_DESIGN.md` §2).
- **Sin migracion de host**: si el host se cae, la partida no continua.
- La identidad del host es "el primer hello con isHost" — suficiente contra
  el troleo casual, pero sin firma criptografica (P2P sin servidor).
- El snapshot incluye **todas las manos**: un guest tecnico podria mirar las
  cartas ajenas en la consola. Ocultarlas requiere snapshots por-peer.

## Verlo en vivo

```bash
npm run dev:mcp
```

Despues abri:

- `http://127.0.0.1:4173`

## MCP de Three.js

El repo ya tiene instalado `threejs-devtools-mcp` como dependencia local.

Flujo esperado:

1. correr `npm run dev:mcp` para levantar el juego en `http://127.0.0.1:4173` y asegurar el bridge `http://localhost:9222`
2. en otra terminal, correr `npm run mcp:three` si queres abrir el bridge manualmente
3. abrir una sesion nueva de Codex desde la raiz del repo para que cargue las tools MCP configuradas
4. mantener abierta una sola pestaña de `http://localhost:9222` mientras uses las tools
