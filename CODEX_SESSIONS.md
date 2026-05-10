# Codex Sessions

Este archivo es el relevo operativo entre conversaciones de Codex/agents.
Usalo para recordar para que se abrio cada chat, que se cambio, que quedo pendiente y como continuar sin depender del historial de la app.

## Como usarlo sin quemar contexto

- Este archivo es el entrypoint liviano. Leerlo primero.
- No leer todos los `.md` completos por defecto.
- Abrir `TRUCOLOCO_CONTEXT.md` solo si la tarea toca canon, reglas, roles, nombres o vision de producto.
- Abrir `MVP_CANON.md` solo si la tarea toca el slice jugable actual.
- Abrir `AGENTS.md` / `AGENT_WORKFLOW.md` solo si faltan instrucciones de trabajo o hay duda de scope.
- Al cerrar una sesion larga: agregar una entrada nueva arriba de `Historial`.
- Si el usuario aclara canon/reglas/personajes: actualizar tambien `TRUCOLOCO_CONTEXT.md`.
- Si se cambia el slice jugable actual: actualizar tambien `MVP_CANON.md` si aplica.
- Si solo se hicieron cambios tecnicos/visuales de una sesion: registrar aca, no contaminar el canon.
- Mantener entradas cortas y accionables: objetivo, archivos tocados, validacion, pendientes.

## Lectura rapida actual

- Proyecto activo: `trucoloco-web/`.
- Stack activo: Vite + React + Three.js + React Three Fiber + drei.
- Nucleo de reglas: `trucoloco-web/src/game/hooks/useTrucolocoMatch.js`.
- Regla operativa: no tocar `useTrucolocoMatch.js` salvo que el pedido sea de logica/reglas.
- Direccion visual: bar nocturno criollo, mesa premium, 3D atmosferico/jugable y UI 2D funcional.
- Estado visual reciente: mundo 3D con bar, mesa, sillas, camaras `Puerta/Mesa/Silla/Caminar`, hotspots y atmosfera.
- Pendiente importante: integrar modelos 3D reales cuando el usuario los genere/descargue.

## Historial

### 2026-05-09 - Seleccion de personajes y preparacion para GLB

Objetivo:
- Permitir elegir personaje dentro de cada rol antes de repartir.
- Preparar la escena para integrar modelos GLB reales sin tocar reglas.

Cambios:
- `trucoloco-web/src/game/data/characters.js`
  - `Pol` queda como opcion Cartachin junto a `Pochex`.
  - Agregado `characterOptionsByRole`.
- `trucoloco-web/src/game/hooks/useTrucolocoMatch.js`
  - Estado de seleccion de personaje por rol.
  - `selectCharacter`, `selectedCharacter`, `selectedRoleCharacters`.
- `trucoloco-web/src/game/ui/Hud.jsx`
  - Picker de personaje dentro del selector de rol.
- `trucoloco-web/src/game/scene/TeamsAroundTable.jsx`
  - El elegido recibe foco visual durante `role-select`, sin cambiar ocupantes reales de las seis sillas.
- `trucoloco-web/src/game/scene/CharacterFigure.jsx`
  - Los personajes sin GLB usan su figura procedural de rol en vez del fallback generico.
  - Loader robusto contra bounds `NaN` en GLB, necesario para `marvyn.glb`.
  - Clonado de modelos riggeados con `SkeletonUtils.clone`.
  - Soporte para clips embebidos `idle/walk/run`.
- `trucoloco-web/src/game/scene/world/WalkablePlayer.jsx`
  - En modo `Caminar`, el avatar usa el personaje seleccionado.
  - Cambia `animationMode` a `idle`, `walk` o `run` segun input/Shift.
  - `J` o `Espacio` dispara animacion extra `box` por ~0.85s.
- `trucoloco-web/src/game/data/characters.js`
  - Mapeados clips genericos de Tripo (`NlaTrack*`) para `irvyn`, `marvyn`, `pol`.
  - Mesa no reproduce animaciones por defecto; solo el jugador caminable usa clips.
- `trucoloco-web/src/game/scene/Table.jsx`
  - `tablero.glb` reemplaza al hexagono central procedural.
- `trucoloco-web/package.json`, `trucoloco-web/README.md`, `MCP_SETUP.md`
  - Agregado `npm run mcp:three`.
  - `npm run dev:mcp` ahora usa `scripts/dev-with-threejs-mcp.ps1`: levanta Vite en `4173` y asegura el bridge `9222` si no esta abierto.
- `trucoloco-web/src/styles.css`
  - Estilos del picker de personajes.
- `trucoloco-web/public/assets/characters/`
  - Copiados desde `C:\Users\eduar\GAMES\trucoloco-info`: `irvyn.glb`, `marvyn.glb`, `pol-arabe.glb`, `tablero.glb`.
  - Irvyn, Marvyn y Pol ahora apuntan a sus GLB reales.

Validacion:
- `npm run check:rules`: OK.
- `npm run build`: OK, con warning esperado de bundle grande por Three/R3F.
- Server local detectado en `http://127.0.0.1:4173`.
- MCP Three.js conectado en esta sesion: proxy `http://localhost:9222` hacia `http://localhost:4173`.
- Screenshot MCP final: vigas elevadas, Marvyn visible, `Imported_Tablero_Central` activo.

Pendientes:
- Revisar visualmente escala/rotacion fina de `irvyn.glb`, `marvyn.glb` y `pol-arabe.glb` despues de hard refresh.
- Los GLB animados ya traen clips, pero Tripo los nombra `NlaTrack*`; si alguna animacion no coincide visualmente, ajustar `animationClipMap`.
- Revisar visualmente escala/altura de `tablero.glb`; ya se redujo el footprint a `1.74`, pero puede requerir otra pasada segun gameplay con cartas.
- Para que Codex cargue tools MCP desde cero, abrir nueva sesion desde raiz del repo con `.codex/config.toml` activo.
- Si se quiere que elegir Pol/Marvyn cambie tambien todos los nombres de reglas/mano, hay que agregar una capa dinamica de roster/asientos.

### 2026-05-08 - Relevo de sesiones y memoria operativa

Objetivo:
- Crear un archivo comun para que cualquier chat pueda retomar el proyecto sin depender del historial visual de Codex.
- Separar canon estable de notas operativas temporales.

Cambios:
- Creado `CODEX_SESSIONS.md`.
- Pendiente marcarlo en `AGENT_WORKFLOW.md`.

Validacion:
- No aplica build; es documentacion.

Proximo paso:
- Pedir a todos los chats/agentes que al finalizar agreguen una entrada aca.

### 2026-04-25 a 2026-05-08 - Web visual, mundo 3D y modo caminar

Objetivo:
- Elevar el slice web para que deje de sentirse como prototipo y empiece a parecer bar/antro Trucoloco.
- Agregar una primera capa de mundo navegable sin romper reglas.

Cambios principales:
- `trucoloco-web/src/App.jsx`
  - Canvas con ACES/tone mapping/postprocessing.
  - Selector de camaras `Puerta`, `Mesa`, `Silla`, `Caminar`.
  - Ritual breve de sentarse.
  - Modo caminar oculta HUD pesado.
  - Hotspot UI para mesa/puerta/barra.
- `trucoloco-web/src/game/scene/TrucolocoScene.jsx`
  - Sala/bar alrededor de la mesa.
  - Luces calidas, rim lights, cono de luz, atmosfera viva.
  - Separacion de camaras: `Mesa` tactica, `Silla` personal.
  - Marcador `TU LUGAR` en vista silla.
  - Hotspots 3D `F SENTARSE`, `F PUERTA`, `F BARRA`.
- `trucoloco-web/src/game/scene/world/BarRoom.jsx`
  - Habitacion/bar procedural: piso, cortinas, barra, botellas, entrada, siluetas.
- `trucoloco-web/src/game/scene/world/WalkablePlayer.jsx`
  - Avatar procedural placeholder.
  - WASD/flechas, Q/E rotan camara, Shift apura.
  - Camara third-person follow.
  - Limites de habitacion y colision circular contra mesa.
  - Hotspots por proximidad.
- `trucoloco-web/src/game/scene/Table.jsx`
  - Mesa mas tactil: props, inlay, brillos, detalles.
- `trucoloco-web/src/game/scene/TeamsAroundTable.jsx`
  - Sillas/slots visibles y estado de silla propia.
- `trucoloco-web/src/game/scene/CharacterFigure.jsx`
  - Skins procedural placeholder para personajes.
- `trucoloco-web/src/game/data/characters.js`
  - Metadata visual de skins.
- `trucoloco-web/src/game/ui/Hud.jsx`
  - HUD mas atmosferico, acta de mesa, tonos por rol.
- `trucoloco-web/src/styles.css`
  - Pulido general de UI, HUD, roles, dock de camara, modo caminar.

Validacion:
- `npm run check:rules`: OK en las ultimas pasadas.
- `npm run build`: OK en las ultimas pasadas.
- Warning persistente esperado: bundle grande por Three/R3F.

Notas tecnicas:
- MCP Three.js a veces queda con tabs duplicadas o `Context Lost`; no asumir que canvas negro del MCP es bug del codigo si build/Vite estan OK.
- Dev server usado varias veces en puertos variables (`4176`, `9222` vistos en capturas).
- El proyecto raiz no parece ser repo git; `trucoloco-web/` puede no tener `.git`.

Pendientes:
- Probar visualmente `Puerta/Mesa/Silla/Caminar` en navegador despues de hard refresh.
- Ajustar `Mesa` vs `Silla` si aun se sienten parecidas.
- Integrar modelos GLB reales cuando existan.
- Si se agregan assets pesados, crear pipeline claro en `public/assets/...` y manifest.

### 2026-04-24 - Extraccion de partida IRL

Objetivo:
- Extraer data de una transcripcion larga de Trucoloco IRL.

Cambios:
- Creado `TRUCOLOCO_IRL_TRANSCRIPT_EXTRACTION.md`.
- Actualizado `TRUCOLOCO_CONTEXT.md` con referencia a fuentes IRL pendientes de canonizar.

Notas:
- La extraccion conserva timestamps aproximados, hablantes aproximados, frases graciosas, reglas semi-reales, poderes inventados y momentos de caos.
- No es canon automatico; es banco de tono/reglas candidatas.
