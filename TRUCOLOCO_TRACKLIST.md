# TRUCOLOCO — TRACKLIST VIVO

> Actualizado por Claude (Fable) el 2026-07-02. Este archivo es el estado real del
> proyecto: qué se hizo, qué está en curso y qué falta. Cualquier agente (Claude,
> Codex) debe actualizarlo al terminar su tarea.

## ✅ HECHO (commits recientes, checks verdes en todos)

- **BUG HISTÓRICO: las cartas jugadas por fin muestran su cara** — los RoundedBox
  tenían radio de redondeo mayor que la mitad del espesor: la geometría se inflaba
  como un libro y se tragaba el plano de la textura (por eso los "cartones gigantes"
  desde el día uno). Radios corregidos + polygonOffset + cara visible de ambos lados
  + banda GRANDE de número/palo legible desde cualquier silla.
- **Preload del mazo** — las 40 caras se precargan en idle: no más naipes blancos.
- **Panel de armas** ya no pisa las cartas (dock izquierdo en vista silla);
  cartel "ROL DE LA PARTIDA / MAZO DE ARMAS" eliminado en todos los modos.

- **Fix crash de arranque** — el juego no cargaba (variables fantasma en App.jsx).
- **Mesa Liar's Bar** — cartas 3D en mano en primera persona (hover levanta, click tira),
  cámara sentada a nivel de ojos, personajes que se giran a mirar al que actúa,
  cartel ACTÚA billboard (ya no se ve espejado), auto-sentarse al repartir.
- **Cámara manual** — en vista silla la cámara NO se mueve sola: arrastrás para mirar.
- **Performance** — GLBs de Tripo optimizados: 74 MB → ~4 MB y 70% menos vértices
  (Gazpacho: 444k → 133k verts). Modo low por defecto (sombras/bloom off);
  `?perf=high` en la URL activa el modo lindo. Los personajes SIEMPRE usan su GLB
  real (se eliminaron los conos de fallback).
- **Mesa legible** — cartas jugadas se PARAN inclinadas frente a su dueño mirando
  hacia afuera (desde tu silla leés de frente las del rival); vueltas resueltas se
  doblan boca abajo junto al mazo; hexágono decorativo achicado (tapaba todo);
  fuera el texto pintado en el fieltro.
- **Menos carteles** — fuera "ROL EN JUEGO", chips de estado, textos mockeados;
  panel de turno reducido a una línea; mano HTML compacta en aérea y oculta en silla.
- **Armas con nombre real** — "Sustancia X en el Naipe" (+2) y "Pucho en el Ojo" (−2).
- **Vista "Mesa" → "Aérea · plano general"**.

## ✅ HECHO (2026-07-03)

- **SONIDO cableado** — synth WebAudio cero assets: golpe de carta al fieltro,
  tick de hover en la mano 3D, stinger de canto, jingle de mano/partida ganada o perdida.
- **CANTOS DRAMÁTICOS 3D** — "¡TRUCO! / ¡RETRUCO! / ¡VALE CUATRO! / ¡ENVIDO! / ¡QUIERO!"
  aparece gigante sobre la mesa con golpe de escala + sonido, mirando siempre a cámara.
- **Personajes con lenguaje corporal** — se inclinan hacia la mesa cuando les toca,
  el equipo ganador salta al cerrar la mano, el perdedor se hunde.

## ✅ HECHO (2026-07-03, tarde)

- **CANTO-BAR única contextual** — una sola píldora abajo al centro con solo lo
  cantable en ese momento: Envido/Truco (gates del hook), poder del Negociante,
  armas del Cartachin como chips, botón de avance. QUIERO/NO QUIERO como píldora
  grande. ActionFocus duplicado eliminado en silla. Chau cajas apiladas.
- **Jugadores que LLEGAN** — en elección de rol estás solo vos frente a la mesa;
  al repartir aparecen los demás con crecimiento suave (antesala de salas online).
- **Cámara drag corregida** (ya no invertida) · **vista aérea eliminada** ·
  **pilas de vueltas prolijas** · `CODEX_TASK.md` creado (Codex corriendo escenario).

## ✅ HECHO por Codex (2026-07-03)

- **Antro cerrado estructuralmente** — agregada carcasa de techo, frente, zócalos,
  puente lateral y cierres de pasillo sin tocar mesa, asientos, HUD ni reglas.
- **Sala del Conflicto más sólida** — techo, pared frontal, laterales con umbral,
  columnas y zócalos para que el ring no quede flotando en vacío negro.
- **Entrada lateral más clara** — puerta/umbral con cartel de obra para ocultar el
  hueco cuando se camina por el antro y todavía no se entra al ring.
- **Bar con apoyos visibles** — soportes bajo estantes y remates de pared para que
  botellas/estantes no parezcan props cortados.

## ✅ HECHO (2026-07-03, noche)

- **SALAS ONLINE — etapa 1 (presencia) FUNCIONANDO** — botón "🌐 Crear sala" arriba
  a la derecha → código de 4 letras + "Copiar link"; el amigo abre `?sala=XXXX` y
  entra directo. Panel muestra el roster en vivo (nombre · rol, ★ host, contador x/6).
  Verificado con E2E de dos navegadores reales por relays nostr (redundancia total,
  relay muerto excluido, guard anti-StrictMode). Base: `src/game/net/room.js`.
  **Falta (etapa 2): partida compartida** — hoy cada uno ve su propia partida local;
  hay que sincronizar el match (host autoritativo emite estado, invitados mandan
  jugadas) + asignación de asientos por rol + chat de voz (`room.addStream`).
- **Píldora a la esquina inferior derecha** (portal a body — el sidebar con
  backdrop-filter rompía el fixed) + chips para cambiar de rol al fin de mano.

## ✅ HECHO (2026-07-03, cierre)

- **Deploy público a GitHub Pages** — workflow `.github/workflows/pages.yml`
  (repo edusierragit/trucoloco), vite con base relativa. El "Copiar link" copia
  la URL real donde esté corriendo → los amigos entran desde SUS casas.
- **Unirse con código** — input CÓDIGO + botón Unirse junto a "Crear sala".
- **Cámara silla en convención única "agarrar el mundo"** (arrastrás la escena).
- `CODEX_TASK_2.md` — máquina de humo interactiva (prop + hotspot F + partículas
  + fog que se enturbia ~20s y se disipa) lista para delegar cuando Codex
  termine la tarea 1.

## ✅ HECHO (2026-07-03, ronda final)

- **Deploy público ARREGLADO** — assetUrl() con BASE_URL (las rutas absolutas
  /assets/ daban 404 bajo /trucoloco/ en Pages). Verificado en producción.
- **LA MESA JUEGA SOLA** — auto-avance con cadencia humana; el juego solo se
  detiene cuando el humano decide (?auto=0 lo apaga, lo usa el validador).
- **Panel duplicado de acciones eliminado del árbol** (arriba-derecha).
- **ACTO DE ACUERDO de negociantes** — la negociación salió del medio de la
  mano (era anti-reglas): ahora al cierre, el Negociante ve "Acuerdo: Vos ±n /
  Rival ±n / Sellar". El bot rival no firma que le saquen ni regalos grandes
  (cae al cobro automático). "Siguiente mano" espera el sello.
- **Panel de mano cerrada minimal** — fuera chips de meta y kicker.
- CLAUDE.md actualizado con el mindset de dirección técnica/creativa de Edu.

## ✅ HECHO (2026-07-03, ronda a fondo)

- **Auditoría de cantos VERIFICADA con tests** — Truco/Retruco/Vale4 pagan
  2/3/4 querido y 1/2/3 no querido; cobro invertido acredita al otro lado;
  envido 33/20/carta alta y empate lo gana el mano. Todo en check:rules
  ("Cantos y puntos OK"). La lógica ESTABA bien; ahora está blindada.
- **🎲 BUSCAR RANDOM** — cola de espera P2P global: dos desconocidos se
  emparejan y caen en la misma sala. Verificado E2E con dos navegadores.
- **Cuadro de cierre a la derecha** (portal) — nunca más sobre tus naipes;
  el acuerdo de negociantes convive a su izquierda.
- **Cartas de mesa a proporción** (0.7, radio 1.32 — lejos del borde).
- **Copy honesto en sala**: los bots son PRÁCTICA mientras se llena.

## ✅ HECHO (2026-07-03, diseño multiplayer)

- **MULTIPLAYER_DESIGN.md** — la arquitectura completa de la etapa 2, pensada
  y no manoteada: party-first + backfill, playerId persistente, la URL es la
  sala (refresh-proof), host autoritativo con snapshots, migración de host,
  reconexión con asiento reservado y bot suplente, refactor de perspectiva
  del hook, voz con addStream. Orden de ejecución en 6 pasos.
- **Matchmaking re-semantizado (backfill real)** — fuera el emparejamiento 1v1
  sin propósito: ahora el HOST togglea "📢 Abrir a randoms" en SU sala y el
  buscador usa "🚪 Entrar a sala abierta". Verificado E2E: el random cayó en
  la sala del host, con URL persistente.
- **La URL es la sala**: ?sala=CODE queda en la barra — refresh te devuelve
  adentro. playerId persistente en localStorage (base de reconexión).
- **Codex completó su pasada 1** (soportes de estantes + vigas del techo,
  checks verdes) — CODEX_TASK_2.md (máquina de humo) listo para dárselo.

## ✅ HECHO (2026-07-03, pase de arte)

- **ARTE del antro (Claude)** — neón TRUCOLOCO con parpadeo de tubo viejo +
  luz roja sobre la barra, trío de lámparas colgantes con conos de luz
  volumétrica falsa, techo cerrado (chau vacío negro), pared frontal, alfombra
  circular bajo la mesa, y la **MÁQUINA DE HUMO clickeable** (le hacés click y
  escupe humo: el fog del antro se enturbia ~20s y se disipa; luz de standby
  roja→verde). La estética queda en manos de Claude; CODEX_TASK_2 (humo) queda
  absorbida y obsoleta.
- **Panel de sala v2** — compacto, botones que no se rompen en 3 líneas.
- **CODEX_TASK_3.md** — el refactor de perspectiva del hook (paso 1 del
  multiplayer) especificado para Codex: lógica pura, contrato estricto,
  snapshot/hydrate + tests. CERO estética.

## ✅ HECHO (2026-07-03, presencia tangible)

- **La sala se VE en el mundo**: el que reclama silla aparece con cartel
  "● Nombre · EN LÍNEA" flotando sobre su lugar en la mesa 3D; suena un
  stinger cuando alguien entra a la sala. Sillas sincronizadas P2P
  (verificado E2E: A ve la silla de B ocupada con su nombre).
- **Fix**: hello descartaba seatId/seatAt/playerId al copiar el perfil.
- **Ayuda Brave** en el panel: los Shields bloquean los WebSockets del enlace.
- ⚠ **CODEX_TASK_3 la toma CLAUDE** (Codex sin cupo ~1h): no dársela cuando
  vuelva — Claude hace el refactor de perspectiva y el protocolo juntos.

## 🔧 EN CURSO

- [x] **Codex**: escenario sólido (casa cerrada, salas tapiadas, taburetes) — base cerrada; taburetes quedan pendientes porque los asientos viven en archivos marcados NO TOCAR.
- [ ] **Cámara silla**: si "agarrar el mundo" tampoco convence a Edu, probar
  convención FPS pura (los dos ejes espejados respecto de la actual).
- [ ] **Auditoría fina de reglas de canto** (envido solo 1ª vuelta/mano, cadena
  truco-retruco-vale4 y quién tiene el quiero) — con tests en check:rules.
- [ ] Guiños faciales NO se pueden con los GLB actuales (sin blendshapes) — plan Mixamo.

## 📦 BACKLOG PRIORIZADO (pedidos de Edu)

1. **SALAS ONLINE** — crear sala + invitar amigos por link, 6 jugadores para 3v3
  (ver si hay modo 4). Base técnica lista: infra P2P trystero probada en slingshot
  (lockstep, sala por código, link auto-join). El truco por turnos es ideal para lockstep.
2. **CHAT DE VOZ para todos** — trystero soporta streams de audio P2P nativamente
  (`addStream`); se monta sobre las mismas salas. Clave para negociar y putear.
3. **Modo TRUCO NORMAL cerrado** — el modo clásico debe ser un truco completo y
  correcto (hoy el flujo 3v3 con envido/truco anda pero falta pulir cantos/faltas).
4. **Modo TRUCOLOCO = clásico + mazos locos** (canon del docx de reglamentación):
   - **Jugador Estrella**: cartas Yu-Gi-Oh meme — Dragón Blanco de Ojos Azules,
     Mago Oscuro, Fisura Dimensional, **carta Messi**, **EXODIA** (imprescindibles).
     ⚠ Son marcas registradas: para publicar conviene versión parodia
     ("Dragón Cremoso de Ojos Celestes"?) — decidir con Edu.
   - **Cartachin**: Mazo de Armas completo del reglamento — As (poder absoluto,
     del último MVP: Gazpacho), Comodín, Varita Mágica, Bloqueo envido/truco,
     Cuatruno, Ojo, Gafas/Anti-gafas, Mudo, Sordos, Ciego, Espejito-Espejito,
     Fuego, Parca, Cambio, Revólver (6 tiros), Gomera.
   - **Negociante**: lleva los puntos — sistema para ANOTAR y VOTAR acuerdo por ronda.
   - **Mazo Trucoloco (repartidor)**: modificadores de ronda — Modo invertido,
     Oculto/Oculto, Versus, SUPER Versus, Hexágono (gafas/espadas), R.I.P.,
     Super J.E.yn, Torneo Z, Sustancia X, etc. (lista completa en
     `C:\Users\eduar\GAMES\trucoloco-info\Trucoloco (reglamentacion).docx`).
5. **Escenario sólido** — casa bien cerrada, sin geometría visible bajo el piso,
  salas laterales sin bugs, sillas que no parezcan pedestales. → **Delegado a Codex**
  (prompt en el chat con Edu; si Codex no lo tomó, Claude lo hace).
6. **Sala del Conflicto con sentido** — cámara estable, colisiones, hit timing,
  armas del Cartachin afectando el combate. → **Prompt para Codex ya entregado**.
7. **Gestos/animaciones de personajes (plan Mixamo)** — subir cada GLB a Mixamo
  (gratis): auto-rig + pack de animaciones (sentarse, festejar, burlarse, golpear
  la mesa). Resuelve también las sillas. Caras: carita 2D intercambiable estilo
  Liar's Bar dibujada de las fotos reales (`GAMES\trucoloco-info\`).
8. **Cartas SVG más lindas** — rediseñar las caras del mazo español.
9. **Audio lore** — integrar/inspirarse en "trucoloco 5. audioGod" (carpeta info).

## 📚 Referencias canon

- `TRUCOLOCO_CONTEXT_PACK.md` / `TRUCOLOCO_CONTEXT.md` / `TRUCOLOCO_IMPLEMENTATION_NOTES.md`
- Reglamento físico 5.0 "La Traición": `C:\Users\eduar\GAMES\trucoloco-info\Trucoloco (reglamentacion).docx`
- Fotos fuente de personajes (para gestos/caras): `C:\Users\eduar\GAMES\trucoloco-info\`
- Reglas duras: NO romper truco clásico; los 4 checks (`check:rules/flow/ui`, `build`)
  deben pasar SIEMPRE; 6 asientos fijos; no mezclar con dead-ping/slingshot.
