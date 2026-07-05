# PROPUESTA (no ejecutada): división de archivos "Dios" + destino de TrucolocoUnity

> Escrito 2026-07-05 en la rama `ivix-world`. Este documento es SOLO la
> propuesta — ningún archivo fue movido. Cada bloque se puede ejecutar como
> un commit independiente cuando Edu lo apruebe. Regla de oro: cada paso
> deja los 4 checks + tests verdes antes del siguiente.

## Por qué

Cinco archivos concentran ~6.000 líneas y mezclan responsabilidades: un fix
localizado en uno arriesga regresiones en modos que no se tocaron. La
extracción de `src/game/conflict/` (Codex) ya demostró el patrón que
funciona acá: mover por responsabilidad, sin reescribir lógica.

## 1. `App.jsx` (~1.000 líneas tras borrar el bloque muerto)

Hoy: orquestador 3D + toda la sala online + auto-play + audio + walk-mode UI.

| Extraer a | Qué se lleva | Riesgo |
|---|---|---|
| `src/game/net/useSala.js` (hook) | joinSala/leaveSala, roster, claimSeat + resolución de conflictos, auto-seat, backfill/búsqueda, mic, sendIntent, efecto de snapshots | Bajo: es un bloque autocontenido con costuras claras (ya usa refs propios) |
| `src/ui/SalaPanel.jsx` | El portal completo del panel de sala + caja de unirse | Bajo: JSX puro, recibe el hook de arriba |
| `src/ui/WalkControls.jsx` | Los controles táctiles + hint de caminata | Bajo |
| `src/game/hooks/useAutoPlay.js` | El efecto "la mesa juega sola" (con el skip de sillas humanas) | Medio: tocarlo pide re-verificar check:flow |

## 2. `useTrucolocoMatch.js` (~1.500 líneas)

Hoy: helpers puros de mesa + fases + acciones + red. La parte pura (fuera
del hook) ya es la mayoría del archivo — la división natural es por módulos
puros, el hook queda como coordinador:

- `src/game/rules/tableEngine.js`: `playSeatCard`, `resolveTableTrick`,
  `dealSeatHands`, `buildOpeningState`, `clearResolvedTrick` (mesa pura).
- `src/game/rules/cantos.js`: `applyEnvidoCallBySeat`,
  `applyTrucoCallByTeam`, `getNextTrucoCall`, heurísticas del bot.
- `src/game/rules/phases.js`: `getPhaseData` — y de paso achatar las 6 ramas
  repetidas a una tabla base + overrides por fase (el bug silencioso vive ahí).
- `src/game/net/snapshot.js`: `isValidSnapshotState` + hydrate/getSnapshot.
- El hook queda con estado, acciones y `applyIntent` (~350 líneas).

Riesgo bajo-medio: son movimientos de funciones ya puras; `check:rules`
cubre exactamente esta lógica. Hacerlo en 4 commits, un módulo por commit.

## 3. `TrucolocoScene.jsx` (~1.670 líneas)

Dividir por modo de cámara, que es como ya se razona el archivo:
`cameras/seatCamera.js`, `cameras/walkCamera.js`, `cameras/ringCamera.js`
(funciones puras de pose) + `SceneChrome.jsx` (luces/neón/humo). El único
`useFrame` gigante pasa a delegar en la función del modo activo.
Riesgo medio: es visual — validar con check:ui + ojo humano (`?perf=high`).

## 4. `Hud.jsx` (~1.230 líneas) y `Table.jsx` (~1.300 líneas)

- `Hud.jsx`: un archivo por panel que ya existe como función interna
  (`TrucoResponsePanel`, `AgreementPill`, `CantoBar`, `RoleSelect`...) bajo
  `src/game/ui/panels/`. Riesgo bajo, es cortar y pegar componentes.
- `Table.jsx`: separar `HandCards3D` (mano en primera persona), `TrickPiles`
  y `BoardRing` (efectos del tablero). Riesgo bajo-medio.

## 5. `styles.css` (5.117 líneas)

Partir por sección con imports planos (sin preprocesador):
`styles/base.css`, `styles/hud.css`, `styles/sala.css`, `styles/canto.css`,
`styles/walk.css`, `styles/pantalla-inicial.css`, y `styles.css` queda como
índice de `@import`. Riesgo bajo (Vite los inlinea en el build); commit
mecánico separado.

## Orden sugerido de ejecución

1. `useTrucolocoMatch` → módulos puros (máximo valor: es el corazón y ya
   tiene tests/checks que lo blindan).
2. `App.jsx` → `useSala` + `SalaPanel` (des-riesga el multiplayer, que es
   el frente activo).
3. `styles.css` (mecánico, cuando no haya otra rama tocando estilos).
4. `Hud.jsx` / `Table.jsx`.
5. `TrucolocoScene.jsx` (último: el más visual, pide validación a ojo).

## TrucolocoUnity/: evaluación

**Qué es**: scaffold de Unity con 2 scripts C# reales (`CharacterProfile`,
`MatchState` + 2 de escena), sin escenas armadas, sin assets. No participa
del build ni del deploy; ninguna referencia desde `trucoloco-web/`. El
CLAUDE.md canónico declara `trucoloco-web/` como "proyecto activo" desde
2026-07.

**Recomendación**: eliminarlo del repo en un commit propio (`git rm -r
TrucolocoUnity/ scripts/enable-unity-mcp.ps1 scripts/disable-unity-mcp.ps1`
+ limpiar las entradas Unity del `.gitignore` raíz). El historial de git lo
conserva para siempre — si el pivot a Unity revive, se recupera con un
`git checkout <sha> -- TrucolocoUnity`. Mantenerlo hoy solo agrega ruido a
las búsquedas y confusión sobre cuál es el proyecto real.

**Alternativa conservadora**: si Edu prefiere no borrarlo, moverlo a una
rama `archivo/unity` y sacarlo de `main`. Mismo efecto práctico, cero
pérdida psicológica.
