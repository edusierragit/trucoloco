# TAREA 2 PARA OPUS — Menú "JUGAR primero" + anotador de palitos + cabezas vivas

> Cómo usar: decile a Opus **"Leé OPUS_TASK_2.md y ejecutá la tarea"**.
> Todo es UI/escena — tu especialidad. En orden de prioridad.

## 1. Menú principal re-jerarquizado (pedido directo de Edu)

La PRIMERA opción del menú tiene que ser **▶ JUGAR** (grande, protagonista).
Recién al tocarla se despliegan las opciones online:

- **Crear sala** (al crearla: copiar link / invitar, como ya existe)
- **Entrar a sala abierta** (matchmaking random)
- **Unirse con código**

"Practicar contra la IA" queda como opción secundaria, chica, abajo — es un
modo de prueba, no el juego. Dentro de una sala, ocultala del todo: ahí el
arranque es el botón **"▶ Iniciar partida"** del panel de sala (ya existe,
lo puso Fable — el host lo tiene deshabilitado hasta 6/6 humanos o hasta
activar "Rellenar sillas vacías con bots").

## 2. Anotador de palitos (fósforos) — el marcador tradicional del truco

Reemplazá/acompañá el marcador numérico con la notación real del truco:

- Cada 5 puntos = un **cuadradito de 4 fósforos + 1 diagonal** (los puntos
  1-4 van dibujando los lados, el 5° cruza en diagonal).
- Tablero partido en **MALAS** (0-15) y **BUENAS** (16-30), una columna por
  equipo. Al pasar de 15 se "arranca de nuevo" en buenas — así se anota en
  la vida real.
- Dibujalo en SVG o CSS (fósforos con cabeza, look de mesa de bar — nada
  digital/casino). Puede vivir en el HUD o como cartel en la escena 3D
  (mejor aún: en la pared del antro).
- Lee `match.scores` (auto). El **modo manual** llegará del motor como
  `match.adjustScore(team, delta)` y `match.scoreMode` (CODEX_TASK_5):
  dejá el toggle "Anotador: auto/manual" y los botones +/− ya maquetados;
  si `match.adjustScore` no existe todavía, deshabilitados con tooltip
  "próximamente".

## 3. Cabezas vivas (estilo Liar's Bar)

- Los personajes sentados ya miran al que actúa — sumá **idle de cabeza**:
  micro-giros aleatorios suaves, algún vistazo a sus cartas, parpadeo de
  postura. Sutil, no robótico.
- Los personajes de jugadores humanos en sala deben mirar SIEMPRE hacia la
  mesa al sentarse (Edu lo pidió explícito).

## ⛔ NO TOCAR

- `src/game/hooks/useTrucolocoMatch.js` + `src/game/rules/` → Codex (TASK_4/5 en curso)
- `src/game/net/room.js` y la sección de sala/red/lobby de `App.jsx` → Fable
- Si renombrás botones de arranque, actualizá el regex del validador
  (`scripts/validate-ui-flow.mjs`, línea `Sentarse|repartir|...`) en el mismo commit.

## Checks al final

`npm run check:rules && npm run check:flow && npm run build && npm run check:ui`
más `TRUCOLOCO_URL="http://127.0.0.1:5173/?auto=0&modo=comun" npm run check:ui`.
Documentar en `TRUCOLOCO_TRACKLIST.md`.
