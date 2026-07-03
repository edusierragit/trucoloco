# TAREA 3 PARA CODEX (v2 — REESCRITA) — Sala del Conflicto jugable

> ⚠ La versión anterior de esta tarea (refactor de perspectiva del hook) LA
> TOMÓ CLAUDE — no la hagas. Esta es tu tarea nueva.
> Cómo usar: abrí Codex en `trucoloco-thegame/trucoloco-web` y decile:
> **"Leé ../CODEX_TASK_3.md y ejecutá la tarea."**

## ⛔ NO TOCAR (territorio de Claude, trabajo multiplayer en curso)

`src/game/hooks/useTrucolocoMatch.js`, `src/game/net/`, `src/game/ui/Hud.jsx`,
`src/game/data/`, `src/game/rules/`, `src/game/audio/`, `src/styles.css`,
`src/game/scene/Table.jsx`, `src/game/scene/TeamsAroundTable.jsx`,
`index.html`, y **la sección de sala/red/espejo de `src/App.jsx`** (todo lo
que menciona netRoom, roster, sala, snapshot, mic).

## Tu territorio

El COMBATE de la Sala del Conflicto: hoy vive desparramado dentro de
`src/App.jsx` (stepArenaCombat ~línea 400+, applyCombatAction, RING_START_STATE,
el rAF del ring y los handlers de teclado del ring) y el render en
`src/game/scene/TrucolocoScene.jsx` (DebateRoom/DebateRing/DebateFighter,
getRingCameraPose) + `src/game/scene/world/WalkablePlayer.jsx`.

## LA TAREA (en orden)

1. **EXTRACCIÓN PRIMERO (un solo commit, rápido)**: mover toda la lógica de
   combate de App.jsx a módulos nuevos `src/game/conflict/`
   (`combatState.js`, `useConflictCombat.js`, `useConflictInput.js`,
   `combatConstants.js`). App.jsx queda solo importándolos. CERO cambios de
   comportamiento en ese commit. Esto reduce el riesgo de pisarse con Claude:
   avisá en el tracklist cuando la extracción esté commiteada.
2. **Cámara del ring estable**: que nunca maree ni pierda a los peleadores;
   encuadre fijo/semifijo con seguimiento suave y shake solo al impacto.
3. **Hit timing legible**: windup + active frames + recovery; un ataque pega
   máximo una vez por activación; hitstun y knockback con peso; colisiones y
   límites de arena sólidos; separación entre peleadores.
4. **Armas del Cartachin que importan**: las armas ya elegidas
   (`src/game/data/weapons.js`, NO editarlo — leelo) modifican daño / rango /
   knockback / cooldown del combate. Integración mínima pero real.
5. **Game feel barato**: hit flash, dash trail, barras de vida claras,
   feedback de bloqueo, reset de ronda limpio. Sin post-processing nuevo.

## Reglas duras

- Nada de físicas externas, networking ni refactors fuera de `src/game/conflict/`.
- El juego de cartas NO se rompe. Los 4 checks pasan al final:
  `npm run check:rules && npm run check:flow && npm run build && npm run check:ui`
  (check:ui con dev server en puerto 5173).
- Documentá en `../TRUCOLOCO_TRACKLIST.md` sección "HECHO por Codex" con fecha.
