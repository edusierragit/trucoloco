# TAREA 5 PARA CODEX — Envido completo + anotador manual (motor, sin estética)

> Dásela a Codex CUANDO TERMINE la TASK_4 (refactor de perspectiva). Ambas
> piezas son la base del "truco común 100% bien" que pidió Edu.
> Cómo usar: **"Leé ../CODEX_TASK_5.md y ejecutá la tarea."**

## Territorio

`src/game/hooks/useTrucolocoMatch.js`, `src/game/rules/truco.js`,
`scripts/validate-*.mjs`. Nada de UI (Opus) ni de red (Fable). La API que
consumen Hud/App se EXTIENDE, nunca se rompe: los 4 checks quedan verdes.

## 1. Envido completo según las reglas reales

Hoy solo existe un envido simple de 2 puntos. Implementar la cadena
completa (siempre solo en primera vuelta, antes de que el cantado juegue,
respetando quién es mano — los gates de TASK_4):

| Canto / respuesta          | Querido           | No querido                     |
|----------------------------|-------------------|--------------------------------|
| Envido                     | 2                 | 1                              |
| Envido → Envido            | 4 (2+2)           | 2 (lo acumulado antes)         |
| … → Real Envido            | acumulado + 3     | lo acumulado antes del real    |
| … → Falta Envido           | lo que le falta al que va GANANDO para llegar a 30 (si van 0-0, 30) | lo acumulado antes de la falta (mínimo 1) |

- Regla del no querido: se cobra lo acumulado ANTES del último canto
  (mínimo 1 si era el primer envido).
- Los tantos ya se calculan (`resolveEnvido`, 33/20/carta alta); el empate
  lo gana el equipo mano — conservarlo.
- API sugerida: `callEnvido()`, `raiseEnvido("envido"|"real"|"falta")`,
  `acceptEnvido()`, `rejectEnvido()` + `envidoChain` en el estado para que
  la UI muestre la escalera. Mantener `settleEnvido` funcionando.
- El bot responde con criterio simple (acepta con tantos altos, rechaza
  con tantos bajos, sube con 31+) — determinístico y testeable con seed.

## 2. Anotador manual (pedido directo de Edu)

- `scoreMode: "auto" | "manual"` en el estado (default "auto") +
  `setScoreMode(mode)`.
- `adjustScore(team, delta)` — clamp 0..30, recalcula `matchWinner`.
- En modo **manual** el motor NO suma automáticamente al cierre de mano
  (ni envido ni truco ni acuerdo): el anotador humano manda. El cierre de
  mano reporta cuánto CORRESPONDERÍA (`suggestedPoints`) para que la UI lo
  muestre como ayuda.
- En sala online, solo el host puede ajustar (eso lo cablea Fable — vos
  solo exponé las acciones).

## 3. Tests (en `check:rules` / `check:flow`, Node puro)

- Toda la tabla del envido de arriba, incluida falta envido con distintos
  marcadores (0-0, 25-20, 28-29) y no-queridos en cada eslabón.
- Manual: adjustScore clamp, matchWinner a 30, cierre de mano sin suma
  automática en manual, `suggestedPoints` correcto.
- Los tests existentes ("Cantos y puntos OK") siguen verdes tal cual.

Documentar en `TRUCOLOCO_TRACKLIST.md` (sección HECHO por Codex, con fecha).


## Agregado 2026-07-05 (feedback directo de Edu) — el truco "anda como el orto"

Caso real: canto truco -> la mano termina al instante -> +1 punto, sin que
se entienda nada. El motor probablemente hizo lo correcto (rival dijo no
quiero = 1 para el cantor), pero:

4. **El bot NUNCA responde un canto en el mismo tick**: delay minimo 700ms
   con estado visible en el snapshot (`trucoPending.thinking` o similar)
   para que la UI muestre "Pol lo piensa...". La respuesta
   (quiero/no quiero/retruco) debe quedar en el estado (`trucoResponse`)
   para que la UI la anuncie en grande.
5. **Auditar la cadena completa con tests**: truco no querido = 1; retruco
   no querido = 2; vale cuatro no querido = 3; queridos = 2/3/4. Y que la
   mano SIGUE si el truco fue querido (hoy da la sensacion de que cantar
   truco cierra la mano aunque haya quiero).
6. El criterio del bot para querer/rechazar debe depender de la fuerza de
   su mano, no ser aleatorio ni fijo.
