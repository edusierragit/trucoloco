# TRUCOLOCO — IMPLEMENTATION NOTES

## Sesión 2026-08-07 — "Mesa Viva / mirada GLB" (Codex)

- Los siete personajes comparten huesos `Head`, `NeckTwist02`, columna, brazos y manos.
- `CharacterFigure` mezcla una mirada suavizada directamente sobre cabeza y cuello del clon GLB.
- En vista silla, el rival del carril mira al jugador; quien actúa mira su jugada; los demás siguen al actor.
- El actor mantiene cuerpo y silla plantados: ya no se rota todo `CharacterSeat` para fingir un giro de cabeza.
- Se corrigió el frente de los GLB en mesa usando su `walkFacingOffset`; antes el rival de enfrente aparecía de perfil.
- Se agregó una pose `seat` procedural compartida basada en direcciones anatómicas del rig: torso, muslos, pantorrillas, pies, brazos y antebrazos.
- La posición del modelo baja la pelvis y la lleva al centro del taburete. La pose se restaura al salir de mesa y no afecta caminar, preview ni ring.
- Los seis grupos sentados se normalizan a radio `2.58`: con el offset de cuerpo/silla, el torso queda cerca de radio `3.08`, a unos `0.28` del aro exterior de la mesa.
- Muslos y antebrazos quedaron más recogidos; una variante determinista evita seis poses idénticas y un idle de baja amplitud mueve columna y brazos sin despegar la pelvis.
- Las alturas GLB ahora siguen las referencias físicas confirmadas: Irvyn/Myke `1.86`, Pol `1.83`, Cubano `1.73`, Marvyn `1.72` (67 kg), Gazpacho/Pochex `1.71`.
- Se eliminaron escalas extra por rol y por skin que alteraban personaje y silla. En pose `seat`, `CharacterFigure` calcula la altura normalizada del hueso `Pelvis` y la apoya a `0.59`, sobre el asiento de `0.465`.
- Se quitó el torus decorativo del taburete que se veía atravesando cintura y muslos.
- El validador UI acepta `TRUCOLOCO_SCREENSHOT` para guardar una captura durante una mano jugable.
- Pendiente inmediato: reducir los anuncios 3D gigantes de turno y mejorar la composición de cámara; luego sustituir el idle procedural por clips sentados.

Checks: `check:rules`, `check:flow`, `check:ui` y `build` OK.

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
