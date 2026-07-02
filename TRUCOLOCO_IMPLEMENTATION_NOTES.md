# TRUCOLOCO — IMPLEMENTATION NOTES

## Sesión 2026-07-02 — "Mesa Liar's Bar" (Claude Fable)

### Qué se implementó

**0. Fix crítico:** la app crasheaba al cargar (`moveDebatePlayer is not defined`) —
identificadores fantasma en un dep-array de `App.jsx:847` tras un refactor del ring.
El juego estaba 100% caído; ahora carga.

**1. Cartas 3D en la mano (Liar's Bar core).** Nuevo componente `HeldHand` en
`src/game/scene/Table.jsx` (final del archivo): en vista SILLA tus cartas son objetos
3D en abanico sostenidos frente a la cámara (viewmodel), con textura SVG real, hover
que levanta la carta, glow dorado y click que la tira a la mesa via `match.playCard`.
Respeta `match.canPlayCard` (se atenúan cuando no es tu turno). Montado en
`TrucolocoScene.jsx` fuera del grupo Room (espacio mundo), solo en `cameraView === "seat"`.

**2. Cámara sentada de verdad.** `getCameraPose` caso `"seat"` reescrito
(`TrucolocoScene.jsx`): ojo a la altura de tu puesto en la mesa, mirando a través del
fieltro; la mirada deriva suavemente hacia el asiento que está actuando (`getActiveTurnSeat`).

**3. Repartir = sentarse.** Al salir de `role-select` la cámara pasa sola a la vista
SILLA (`App.jsx`, effect junto a `handleCameraViewChange`). La vista de juego por
defecto ya no es el plano cenital.

**4. Los personajes se miran.** `CharacterSeat` (`TeamsAroundTable.jsx`) ahora gira
suavemente (~±0.5 rad, lerp) hacia el asiento del que actúa — la mesa se siente viva.
Los carteles flotantes (ACTÚA / nombre) ahora son `<Billboard>` → legibles desde
cualquier asiento (antes se veían espejados).

**5. La carta vuela desde quien la tira.** `AnimatedTableCard` origina su arco en la
posición real del asiento del dueño (`card.seatId` → `tableSeats`), no de un lado genérico.

**6. Menos cajas.** En modo silla el panel HTML de mano (`.hand-panel`) queda "ghost"
(clip-path inset 50%): sigue en el DOM y es clickeable por JS —
**`validate-ui-flow.mjs` sigue pasando** — pero visualmente la mano es 100% 3D.
CSS al final de `src/styles.css` (`.stage-seat-mode ...`).

**7. Trofeo central a escala de adorno.** `Imported_Tablero_Central` (tablero.glb)
a scale 0.5 — antes tapaba al rival de enfrente desde la vista sentada.

### Archivos tocados
`src/App.jsx` · `src/game/scene/TrucolocoScene.jsx` · `src/game/scene/Table.jsx` ·
`src/game/scene/TeamsAroundTable.jsx` · `src/styles.css`

### Checks (todos verdes)
`check:rules` OK · `check:flow` OK · `check:ui` OK (vuelta completa de 6 cartas,
cámara rotando por 5 asientos) · `build` OK.

### Cómo probar
`npm run dev` → elegir rol → **Sentarse y repartir** → estás EN la mesa: cartas en la
mano (hover + click para tirar), rivales enfrente girándose hacia quien juega.
Teclas 1-4 cambian de cámara (2 = plano mesa clásico si lo extrañás).

### Pendientes / ideas siguientes
- Personajes siguen de pie junto a su silla (los GLB de Tripo no tienen clip "sit");
  se leen como parados en la mesa desde ciertos ángulos. Opción: bajar la silla-caja
  o generar pose sentada.
- Cantos (TRUCO/ENVIDO) como voces 3D sobre la mesa (hoy siguen en paneles HTML laterales).
- Sala del Conflicto: sin cambios en esta sesión (delegada a Codex — ver prompt en el chat).
