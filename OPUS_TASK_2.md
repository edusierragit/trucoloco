# TAREA 2 PARA OPUS (v2 — REESCRITA con el flujo definitivo de Edu, 2026-07-05)

> Decile a Opus: **"Leé OPUS_TASK_2.md y ejecutá la tarea"**.
> Es LA tarea de UX. En orden de prioridad estricto. Edu: "el flujo sigue
> estando baratísimo... quiero que se pueda jugar el juego".

## 1. EL FLUJO DE ENTRADA DEFINITIVO (palabra de Edu, no improvisar)

Pantalla única de menú ANTES de ver la habitación:

1. **Menú principal** (pantalla propia, sin la habitación de fondo o con
   fondo desenfocado): dos opciones grandes — **"Crear sala"** y **"Buscar
   partida"** (+ unirse con código). Aparte, chiquito, a modo testing:
   **"Jugar vs bots"**.
2. Al tocar **Crear sala** → pantalla de **elegir rol y personaje**.
3. Recién después de elegir → **entrás a la habitación** (con tu sala ya
   creada, panel visible).
4. Dentro de la habitación te sentás **haciendo click en la mesa** (o F).
   La partida arranca desde el panel de sala del host ("Iniciar partida",
   ya existe — lo hizo Fable).

"Jugar vs bots" (testing) salta directo a rol/personaje → habitación → mesa.

## 2. MUERTE A LOS CÍRCULOS DEL PISO (queja directa con captura)

En `TrucolocoScene.jsx` líneas ~1167-1168 están los `WalkMarker` ("F
SENTARSE" / "F PUERTA"): anillos gigantes superpuestos en el piso. Edu:
"sacá los 200 círculos que no sirven para nada". El hint de la esquina
(walk-hint) alcanza. Eliminarlos o reemplazarlos por UN indicador sutil
(punto de luz chico), nunca anillos con texto.

## 3. La vista "cartas flotando en negro" — verificar muerta

Fable ya metió el invariante en App.jsx (con mano en juego solo hay cámara
silla/caminar/ring). Verificá que no quede NINGÚN camino a la vista
"table"/"entry" durante una partida (incluso refrescando con ?sala=).

## 4. Feedback del truco — hoy parece bug y es UX

Edu: "canté truco y se terminó la mano, sumé 1 punto" — el rival había
dicho NO QUIERO pero no se ve NADA. Falta:
- Respuesta del rival visible y dramática: "POL NO QUIERE" grande + por qué
  cobrás lo que cobrás ("No quisieron tu truco: +1").
- El bot no debe responder instantáneo (Codex agrega el delay en el motor —
  CODEX_TASK_5; vos cubrí la capa visual).

## 5. Sala del Conflicto: cámara

Zoom actual demasiado cerca ("no se ve nada"). Alejar el encuadre y
habilitar **zoom con rueda** como en la habitación.

## 6. Caminantes remotos robóticos

Fable subió el envío a 20Hz. Del lado receptor: interpolación con
suavizado (lerp posicional + yaw) y mapear la animación de caminar del GLB
del personaje remoto cuando se mueve (hoy quedan tiesos o con anim
equivocada — Edu cargó varios movimientos por personaje).

## Sigue pendiente de la v1 (si hay nafta)

- Anotador de palitos (fósforos, malas/buenas) leyendo match.scores.
- Cabezas vivas / idle sutil.

## ⛔ NO TOCAR
`useTrucolocoMatch.js`, `rules/`, `scripts/validate-*` (Codex tiene trabajo
sin commitear ahí — NO los agregues a ningún commit), `net/room.js` (Fable).

## Checks
Los 4 de siempre + `?modo=comun`. Si renombrás botones de arranque,
actualizá el regex del validador en el mismo commit.
