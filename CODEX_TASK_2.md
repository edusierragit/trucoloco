# TAREA 2 PARA CODEX — Máquina de humo interactiva

> Cómo usar: cuando Codex termine la tarea 1 (CODEX_TASK.md), abrí Codex en
> `trucoloco-thegame/trucoloco-web` y decile: **"Leé ../CODEX_TASK_2.md y ejecutá la tarea."**
> Mismas reglas y archivos prohibidos que en CODEX_TASK.md.

## LA TAREA

Una **máquina de humo** en el antro, interactiva desde el modo caminar:

1. **El prop**: una máquina de humo apoyada en el piso contra una pared (caja
   metálica con boquilla, lucecita roja de standby). Procedural, low-poly,
   estilo del antro.
2. **Hotspot**: caminando cerca (patrón de `WalkHotspots`/`DebateEntrance`),
   aparece el prompt "F · Tirar humo". Al apretar F:
3. **El humo**: la boquilla escupe un chorro de partículas (sprites/planos con
   opacidad, sin librerías nuevas) y durante ~20 segundos el ambiente se
   enturbia: sube la densidad del fog de la escena y baja levemente la
   visibilidad, después se disipa gradualmente. Reutilizar el patrón de
   partículas que ya existe en la escena si hay uno.
4. **Sonido opcional**: si es fácil, un "pssshhh" con WebAudio inline (mirá
   `src/game/audio/sfx.js` como referencia de estilo — pero NO edites ese
   archivo; hacé el tuyo o inline).
5. **Presupuesto**: barato en polígonos y partículas (que no mate los FPS del
   modo low). Cooldown de ~30s para que no se pueda spamear.

## Reglas duras (idénticas a CODEX_TASK.md)

- NO tocar los archivos listados como prohibidos en CODEX_TASK.md.
- Al final: `npm run check:rules && npm run check:flow && npm run build &&
  npm run check:ui` — los 4 verdes (check:ui necesita dev server en 5173).
- Documentar en `../TRUCOLOCO_TRACKLIST.md` (sección "HECHO por Codex").
