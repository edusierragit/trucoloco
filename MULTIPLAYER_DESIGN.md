# TRUCOLOCO MULTIPLAYER — Diseño de arquitectura (etapa 2)

> Escrito 2026-07-03 tras el feedback de Edu: "pensá la necesidad antes de
> implementar". Este documento ES el pensamiento. La etapa 2 se ejecuta
> siguiendo esto, sin manotazos.

## 1. Cómo funciona el matchmaking en juegos reales (y qué tomamos)

Los juegos online usan tres patrones, casi siempre combinados:

1. **Party/Lobby por invitación** (Among Us, Jackbox, Liar's Bar): un host crea
   la sala, comparte código/link, los amigos entran. La partida arranca cuando
   el host decide. → **Es NUESTRO caso primario**: Trucoloco es un juego de
   grupo de amigos.
2. **Backfill** (Rocket League, Left 4 Dead): una sala con asientos libres se
   publica como "abierta" y el sistema le inyecta jugadores que están en cola.
   → **Nuestro secundario**: "somos 4, que entren 2 randoms".
3. **Cola pura 1v1/ranked** (chess.com): dos desconocidos se emparejan de cero.
   → NO aplica hoy (mi error anterior): sin partida compartida ni comunidad,
   emparejar desconocidos en un lobby vacío no sirve de nada.

**Decisión**: Party-first + backfill opcional controlado por el host
("Abrir sala a randoms"). El buscador ("Entrar a sala abierta") solo existe
como la otra cara del backfill.

## 2. Identidad y persistencia (el problema del F5)

- **playerId persistente** en localStorage (`trucoloco.playerId`, uuid): tu
  identidad sobrevive refresh, crash y cambio de pestaña. El nick/personaje
  se asocia a ese id.
- **La URL ES la sala**: al crear o entrar, la URL queda `?sala=CODE` (no se
  limpia nunca mientras estés adentro). Refresh → el auto-join te devuelve a
  la sala. Cerrar pestaña y volver con el link → igual. Salir → se limpia.
- **Reconexión a partida en curso**: el host mantiene el mapa
  `playerId → seatId`. Cuando un peer reaparece con un playerId conocido, se
  le re-asigna su asiento y se le manda el snapshot actual. Su asiento
  mientras tanto lo juega un bot suplente ("entra el pibe del bar") con un
  timeout de gracia (90s) antes de considerarlo abandono.

## 3. Autoridad: host autoritativo con snapshots (NO lockstep)

Dos opciones estándar:
- *Lockstep determinista* (RTS, slingshot): todos simulan; solo viajan inputs.
  Exige determinismo total y TODOS presentes para avanzar. Frágil con 6
  celulares y reconexiones.
- **Host autoritativo + snapshots** (Among Us, Jackbox): el host corre la
  única verdad; los demás mandan intents y renderizan snapshots. Tolera
  reconexión trivial (mandás el último snapshot). El truco es por turnos y
  el estado es chico (< 5 KB) → snapshots completos por evento, sin deltas.

**Decisión**: host autoritativo.
- **Host** = el creador de la sala. Corre `useTrucolocoMatch` real.
- **Guests** mandan `intent` = `{ playerId, seatId, action, payload }`
  (playCard, callEnvido, callTruco, acceptTruco, rejectTruco, raise,
  proposeAgreement, sealAgreement, selectRole...). El host valida contra los
  gates del hook (turno, asiento, fase) y aplica. Nada del guest se confía.
- **Snapshot** = el estado serializable del match + roster de asientos. Se
  emite tras cada mutación (los eventos de trystero son confiables/ordenados
  por peer sobre DataChannel). Guests lo aplican a un "match proxy" con la
  MISMA interfaz que el hook (mismos campos + funciones que en vez de mutar,
  envían intents) → el HUD y la escena no se enteran de que son remotos.
- **Migración de host**: todos los guests cachean el último snapshot. Si el
  host se va (onPeerLeave del host), el peer vivo con menor peerId asume:
  levanta el match desde el snapshot y anuncia `soyHost`. Ventana de gracia
  de 10s por si el host vuelve (su playerId manda).

## 4. Asientos y arranque

- El lobby de sala muestra las 6 sillas (3 roles × 2 equipos). Cada humano
  elige silla libre (rol+equipo+personaje). Conflictos: primero que llega.
- **Arranca el host** con ≥2 humanos. Las sillas vacías las juegan bots
  (marcados 🤖 en la mesa). Si la sala está "abierta a randoms", el backfill
  puede llenarlas incluso a mitad de partida (el random entra como suplente
  en silla de bot, entre manos).
- Modo 4 jugadores (2v2): variante futura — el reglamento es 3v3; con 4
  humanos quedan 2 bots, y listo.

## 5. La perspectiva (el refactor clave del hook)

Hoy `useTrucolocoMatch` está escrito en primera persona (selectedRole,
humanHand, "Vos"). Etapa 2 lo separa en dos capas:
1. **Núcleo de mesa** (ya casi existe): `handsBySeat`, `tableCards`, turnos
   por seatId, cantos con `caller/target` por equipo — SIN noción de "vos".
2. **Perspectiva**: cada cliente deriva su vista con su `seatId`:
   `humanHand = handsBySeat[miSeat]`, "Vos" = mi equipo, la cámara se sienta
   en MI silla (ya funciona así con `getOwnSeat`).
El HUD no cambia: recibe el mismo shape de siempre.

## 6. Voz

`room.addStream(micStream)` de trystero (WebRTC audio P2P full-mesh, 6 peers
es viable). Toggle de mute por jugador + indicador de quién habla (analyser
de volumen). Se monta sobre la MISMA sala, cero servidores.

## 7. Orden de ejecución de la etapa 2

1. Refactor perspectiva del hook (núcleo por seatId + vista derivada). Los 4
   checks deben seguir verdes con el juego local intacto.
2. Protocolo sala: seats, intents, snapshots, host-authority (2 humanos).
3. Reconexión (playerId + re-asiento + snapshot) y migración de host.
4. Lobby de sillas en la sala + arranque por host + bots suplentes.
5. Backfill a sala en curso + voz.
6. E2E: dos navegadores jugando UNA mano completa compartida, con un refresh
   en el medio y verificación de que el estado sobrevive.

## Ya implementado (esta sesión)

- playerId persistente en localStorage.
- URL `?sala=` persistente (refresh vuelve a la sala) y limpieza solo al salir.
- Backfill semántico correcto: host togglea "📢 Abrir a randoms"; el botón
  del inicio es "Entrar a sala abierta" (toma la primera oferta con lugar).
  El emparejamiento 1v1 sin propósito fue eliminado.

## Paso 1 implementado — API pura de perspectiva e intents

- `useTrucolocoMatch({ mySeatId })` acepta una perspectiva opcional. Si no se
  pasa, conserva el comportamiento local anterior: equipo A con el rol elegido.
- `deriveView(coreState, mySeatId)` es pura y devuelve la vista consumida por
  HUD/escena: `humanHand`, `rivalHand`, `activeLane`, `selectedSeatId`,
  `oppositeSeatId`, gates (`canPlayCard`, `canCallEnvido`, `canCallTruco`, etc.)
  y `tableFlow`.
- `applyIntent(coreState, { seatId, action, payload })` es el reducer puro para
  host autoritativo. Acciones MVP: `playCard`, `callEnvido`, `callTruco`,
  `acceptTruco`, `rejectTruco`, `raiseTruco`, `advance`. Si el intent viola
  turno, fase o equipo objetivo, devuelve el mismo estado.
- `scripts/validate-truco-flow.mjs` blinda perspectiva por asiento, snapshot
  serializable, gates de envido, cadena truco/retruco/vale cuatro y modo común
  sin armas.
