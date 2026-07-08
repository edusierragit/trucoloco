# TAREA 3 PARA OPUS — El FLUJO del menú (pantalla completa → selección → bar)

> Pedido central de Edu: "nunca vi un menú tan caótico inicial, falta lógica
> de flow. Cuando le paso el link a alguien no sabe qué tocar." Rediseño del
> RECORRIDO, no de las cajas sueltas.

## El flujo deseado (3 pantallas claras, en orden)

### Pantalla 1 — ENTRADA (pantalla COMPLETA, nada más)
- Fondo: la escena del antro vista hacia la mesa/trofeo (techo del Trucoloco),
  desenfocada o con viñeta. Da la sensación de "estás entrando al bar".
- Encima, centrado, SOLO dos acciones grandes:
  - **CREAR PARTIDA**
  - **UNIRSE** (con código / sala abierta)
- Nada de rol, personaje, modo, cámara. Cero ruido. El que recibe el link
  entiende al toque qué hacer.

### Pantalla 2 — SELECCIÓN (tras crear/unirse, con transición)
- Transición que se sienta (fade + un pequeño movimiento de cámara / que
  "bajás al antro"). Que se ENTIENDA que pasás de pantalla.
- Acá va lo de ahora: MODO (Común/Trucoloco) + ROL + PERSONAJE.
- **NUEVO**: preview 3D del personaje elegido. Ya está hecho el componente:
  `import { CharacterPreview } from "../scene/CharacterPreview"` →
  `<CharacterPreview character={match.selectedCharacter ?? match.activeLane.human} />`
  Renderiza el modelo GLB girando sobre una tarima con luz de antro. Ubicalo
  al lado de la lista de personajes (columna izquierda grande, lista a la
  derecha, estilo character-select de juego).
- El botón para avanzar = **ENTRAR AL ANTRO** (grande, protagonista). Que sea
  el "play" natural, no un "Crear sala" aislado y raro.

### Pantalla 3 — EL BAR (lo que ya existe)
- La mesa, sentarse, jugar. El panel de sala pasa a ser lateral discreto.

## Correcciones puntuales de las capturas de Edu

- Panel de sala (SALA ZH5P) se ve pegado/cortado arriba a la izquierda y
  overlapea con el hint "F · Sentarse en mesa". Separar y ordenar.
- El "Crear sala / Entrar a sala abierta / Código / Unirse" NO debe convivir
  con el panel de ELEGÍ ROL: en el flujo nuevo, esas acciones viven en la
  Pantalla 1, y ELEGÍ ROL en la Pantalla 2. Dejan de pisarse.
- Cuando creás sala y estás solo: el CTA claro es **"▶ Iniciar partida"**
  (rellená con bots si querés) — no que el jugador tenga que adivinar.

## Territorio / no pisar
- Motor (`useTrucolocoMatch`, `rules/`) = Codex.
- `net/room.js` + protocolo de intents + TURN = Fable (yo). NO lo toques.
- `CharacterPreview.jsx` = hecho por Fable, solo IMPORTALO.
- Todo el layout/estilo del menú, App.jsx (secciones de UI/pantallas),
  styles.css = tuyo.

## Checks
Los 4 de siempre + `?modo=comun`. Si renombrás botones de arranque,
actualizá el regex del validador en el mismo commit.
