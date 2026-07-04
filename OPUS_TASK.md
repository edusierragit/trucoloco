# TAREA PARA OPUS — Selector de modo: Truco Común vs TRUCOLOCO (solo UI)

> Cómo usar: decile a Opus **"Leé ../OPUS_TASK.md y ejecutá la tarea"**
> (o abrilo desde la raíz del repo).

## Contexto

El motor YA tiene los dos modos (commit `2893536`, Fable):

- `match.gameMode` → `"comun"` o `"trucoloco"` (default: trucoloco)
- `match.setGameMode(id)` → cambia el modo (solo fuera de una mano en curso)
- `match.gameModeInfo` → `{ id, label, tagline }` del modo activo
- `GAME_MODES` en `src/game/config.js` → los dos modos con label y tagline

En modo **común** el motor apaga solo: cartas absurdas, armas del Cartachin,
poderes de rol y el acto de acuerdo (se auto-sella). Es truco argentino puro.
En **trucoloco** está todo el delirio. `?modo=comun` en la URL ya funciona
para probar.

## LA TAREA (solo UI — tu especialidad)

1. **Selector en la pantalla inicial** que vos rediseñaste: dos opciones
   grandes y claras ANTES o JUNTO a la elección de rol —
   **"Truco Común"** (sobrio, criollo) vs **"TRUCOLOCO"** (neón, delirio).
   Usá los taglines de `GAME_MODES`. El modo activo bien marcado.
   Llamá `match.setGameMode(id)` al elegir.
2. **Chip de modo visible durante la partida** (discreto, cerca del
   marcador): que siempre se sepa qué se está jugando.
3. En modo común, revisá que la UI no muestre rastros trucoloco: el panel
   de armas, el botón de poder de rol y el acuerdo de negociantes ya vienen
   apagados desde el motor (`canUseWeapon/canUseRolePower` false,
   `agreementApplied` true) — solo verificá que ningún texto suelto los
   mencione.

## ⛔ NO TOCAR

- `src/game/hooks/useTrucolocoMatch.js` y `src/game/rules/` → Codex (TASK_4)
- `src/game/net/room.js` y la sección de red/sala/snapshot de `App.jsx` → Fable
- `scripts/validate-*.mjs` → ya reconocen tu botón "Probar solo"; si renombrás
  botones de arranque de nuevo, actualizá el regex del validador en el mismo
  commit (línea `Sentarse|repartir|Probar solo|JUGAR`).

## Checks obligatorios al final

`npm run check:rules && npm run check:flow && npm run build && npm run check:ui`
y además: `TRUCOLOCO_URL="http://127.0.0.1:5173/?auto=0&modo=comun" npm run check:ui`

Documentá en `TRUCOLOCO_TRACKLIST.md` al terminar.
