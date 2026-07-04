# TRUCOLOCO CONTEXT PACK

## 1. Resumen ejecutivo

Trucoloco Web es una aplicacion Vite + React 19 + React Three Fiber que combina un juego de Truco argentino 3v3, una habitacion 3D caminable y una Sala del Conflicto con combate local en tiempo real.
El proyecto corre, los checks deterministas de reglas y flujo pasan, el check UI pasa contra la instancia MCP y el build productivo termina correctamente.
La base de cartas usa un mazo tradicional de 40 cartas, reparte tres cartas a seis asientos y resuelve hasta tres vueltas por mano.
El flujo clasico ya incluye Envido, Truco, Retruco, Vale cuatro, Quiero/No quiero, puntaje y rotacion de mano/repartidor, pero varias reglas estan simplificadas o incompletas.
El oponente y los otros asientos del juego de cartas son automatizados localmente mediante una heuristica simple; no existe multiplayer online.
Los roles existen, pero sus mecanicas estan desparejas: Negociante funciona parcialmente, Cartachin permite elegir arma pero su efecto no llega al flujo 3v3, y Jugador Estrella no tiene regla extra activa.
La Sala del Conflicto ya tiene combate real-time local para dos jugadores, HP, ataques, cooldowns, bloqueo, esquiva, knockback, audio sintetizado y condicion de KO.
El combate no usa motor de fisicas: movimiento, colisiones, impactos y empujes son calculos manuales en `App.jsx`.
El PvP todavia no se siente terminado: la deteccion de golpe es solo por distancia, las animaciones no sincronizan con el impacto, faltan colisiones entre jugadores y la camara automatica del ring produce encuadres malos.
La mayor deuda tecnica es la concentracion de responsabilidades: `App.jsx`, `TrucolocoScene.jsx`, `useTrucolocoMatch.js`, `Table.jsx`, `Hud.jsx` y `styles.css` son archivos grandes que mezclan logica, presentacion e input.
No conviene rehacer el proyecto ni instalar un framework general de gameplay. Conviene extraer primero el combate a un hook pequeno y estabilizar una unica experiencia jugable.
El siguiente slice recomendado es: Sala del Conflicto local P1 vs P2 clara, con camara estable, colisiones simples, hit timing legible y reset confiable; luego volver al flujo de cartas.

## 2. Stack detectado

### Aplicacion activa

- Proyecto: `trucoloco-web/`
- Build tool: Vite `8.0.8`
- UI: React `19.2.5` y React DOM `19.2.5`
- 3D: Three.js `0.183.2`
- React 3D: `@react-three/fiber` `9.5.0`
- Helpers 3D: `@react-three/drei` `10.7.7`
- Postprocesado: `@react-three/postprocessing` `3.0.4` y `postprocessing` `6.39.0`
- Devtools: `threejs-devtools-mcp` `0.4.1`
- Configuracion Vite: host `0.0.0.0`, puerto por defecto `4173`
- Entry point: `trucoloco-web/src/main.jsx`
- Aplicacion principal: `trucoloco-web/src/App.jsx`
- Navegacion: no hay router ni paginas; la experiencia es una unica aplicacion controlada por estado.

### Fisica y networking

- Motor de fisicas: no encontrado. No hay Rapier, Cannon, Ammo, Matter ni equivalente.
- Networking de juego: no encontrado. No hay Socket.IO, PeerJS, Colyseus ni cliente WebSocket de gameplay.
- El unico `WebSocket` encontrado esta en `scripts/validate-ui-flow.mjs` y se usa para controlar Chromium/Edge mediante DevTools.
- Voz: no implementada. El canon propone WebRTC/Web Audio/signaling como trabajo futuro.

### Assets

- Cartas reales del mazo tradicional: 40 SVG en `public/assets/cards/fronts/`.
- Dorso: `public/assets/cards/backs/truco-back.svg`.
- Fuente/atribucion: `public/assets/cards/ATTRIBUTION.md` y `public/assets/cards/source/`.
- Modelos GLB: `cubano`, `gazpacho`, `irvyn`, `marvyn`, `myketa`, `pocho`, `pol` y `tablero`.
- Skins PNG adicionales para Gazpacho y Negociante.
- Los GLB de personajes pesan aproximadamente entre 1.9 MB y 13.3 MB cada uno.

### Proyecto legado

- `TrucolocoUnity/` y `Unity-MCP/` son legado/referencia. El proyecto activo es `trucoloco-web/`.

## 3. Comandos utiles

Ejecutar desde `trucoloco-web/`.

| Objetivo | Comando | Resultado auditado |
| --- | --- | --- |
| Instalar | `npm install` | No ejecutado; `node_modules/` y lockfile ya existen. |
| Desarrollo | `npm run dev` | Vite; usa puerto `4173` salvo override. |
| Desarrollo con MCP | `npm run dev:mcp` | Inicia flujo definido en `scripts/dev-with-threejs-mcp.ps1`. |
| MCP Three.js | `npm run mcp:three` | Inicia proxy/devtools definido en `scripts/start-threejs-mcp.ps1`. |
| Reglas | `npm run check:rules` | Pasa: `Truco rules OK`. |
| Flujo | `npm run check:flow` | Pasa: `Truco flow OK`. |
| UI | `npm run check:ui` | Pasa contra `TRUCOLOCO_URL=http://127.0.0.1:9222`. |
| Build | `npm run build` | Pasa con warning de chunk grande. |
| Preview | `npm run preview` | Disponible; no auditado manualmente. |

Para validar UI contra una URL concreta:

```powershell
$env:TRUCOLOCO_URL='http://127.0.0.1:9222'
npm run check:ui
```

No hay scripts de lint ni un framework formal de unit tests.

## 4. Mapa de archivos importantes

| Archivo | Responsabilidad | Estado | Notas |
| --- | --- | --- | --- |
| `trucoloco-web/src/main.jsx` | Entry point React | OK | Renderiza `App` bajo `StrictMode`. |
| `trucoloco-web/src/App.jsx` | Shell, camaras, mundo, inputs y combate | Critico / sobrecargado | Contiene casi toda la logica de Sala del Conflicto, input global y transiciones de vista. |
| `trucoloco-web/src/game/hooks/useTrucolocoMatch.js` | Estado y acciones del Truco | Parcial / central | Nucleo correcto a preservar; contiene reglas simplificadas y automatizacion de asientos. |
| `trucoloco-web/src/game/rules/truco.js` | Helpers puros de reglas | Parcial | Tiene calculos utiles y un flujo 1v1 legado que no coincide completamente con el flujo 3v3 activo. |
| `trucoloco-web/src/game/data/cards.js` | Mazo, bonus y modificadores | OK / contenido inactivo | Mazo tradicional correcto; bonus y Sustancia X no entran al slice clasico actual. |
| `trucoloco-web/src/game/data/characters.js` | Roles, personajes, GLB y asientos | Parcial | Registry util, pero identidad seleccionada y asientos fijos pueden divergir. |
| `trucoloco-web/src/game/data/weapons.js` | Armas de Cartachin | Parcial | Datos existen; sus efectos no llegan a la resolucion 3v3 activa. |
| `trucoloco-web/src/game/ui/Hud.jsx` | HUD completo del juego de cartas | Parcial / grande | Muchas secciones y decisiones; riesgo de duplicar informacion y CTA. |
| `trucoloco-web/src/game/scene/Table.jsx` | Mesa, cartas 3D y props | Funcional / grande | Las cartas jugadas se ven en mesa; mezcla decoracion y gameplay visual. |
| `trucoloco-web/src/game/scene/TrucolocoScene.jsx` | Escena general, camaras y Sala del Conflicto | Critico / sobrecargado | Ring, fighters, entrada, luces, camara y efectos estan en un solo archivo. |
| `trucoloco-web/src/game/scene/CharacterFigure.jsx` | Carga GLB, clips y fallback | Parcial | Soporta GLB y fallback; depende de nombres de clips Tripo poco confiables. |
| `trucoloco-web/src/game/scene/world/WalkablePlayer.jsx` | Movimiento libre del antro | Parcial | Buen prototipo caminable; movimiento y colisiones son manuales. |
| `trucoloco-web/src/game/scene/world/BarRoom.jsx` | Geometria del antro | Parcial | Capa visual del mundo; no es un sistema de navegacion/fisica. |
| `trucoloco-web/src/styles.css` | Toda la UI y responsive | Critico / muy grande | Aproximadamente 86 KB; dificil aislar regresiones visuales. |
| `trucoloco-web/scripts/validate-truco-rules.mjs` | Check determinista de reglas | Util pero incompleto | Valida helpers y arma en flujo 1v1, no el hook 3v3 real. |
| `trucoloco-web/scripts/validate-truco-flow.mjs` | Simulacion determinista 3v3 | Util pero duplicado | Replica flujo en vez de ejecutar `useTrucolocoMatch`. |
| `trucoloco-web/scripts/validate-ui-flow.mjs` | Smoke test UI/CDP | OK para flujo de cartas | No cubre Sala del Conflicto. |
| `MVP_CANON.md` | Canon corto | Importante | Debe prevalecer para el slice clasico. |
| `TRUCOLOCO_CONTEXT.md` | Contexto acumulado | Importante | Contiene decisiones recientes y deuda conocida. |

## 5. Estado del juego principal de cartas

### Lo que existe y funciona

- `useTrucolocoMatch()` en `src/game/hooks/useTrucolocoMatch.js` mantiene el estado principal.
- El mazo tradicional de 40 cartas esta definido en `src/game/data/cards.js`.
- Se reparten 18 cartas: tres a cada uno de seis asientos.
- La ronda usa seis asientos fijos definidos en `src/game/data/characters.js`.
- La mano rota por los seis asientos; el repartidor es el asiento anterior.
- Cada vuelta espera seis cartas y una mano se resuelve en hasta tres vueltas.
- `playSeatCard()` y `resolveTableTrick()` implementan el flujo 3v3 activo.
- El puntaje llega hasta 30.
- Existen empate/parda y resolucion de ganador de mano.
- La mesa 3D representa cartas jugadas mediante `Table.jsx`.
- El HUD permite elegir rol, jugar carta, responder cantos, limpiar mesa y avanzar.
- El smoke test UI recorrio una mano con hasta tres cartas en mano y seis cartas en mesa.

### Cantos y decisiones

- Envido: existe antes de la primera carta mediante `callEnvido()`.
- Truco: existe mediante `callTruco()`.
- Retruco y Vale cuatro: existen como escaladas.
- Quiero / No quiero: existen para respuestas.
- Puntaje por cantos: existe.
- Limitacion: Envido compara solamente el asiento humano seleccionado con su opuesto del mismo rol, no modela correctamente una declaracion/evaluacion completa 3v3.
- Limitacion: no existe interaccion de cantar puntos ni posibilidad real de mentir; el valor se calcula automaticamente.
- Limitacion: el rival automatizado responde a cantos humanos, pero no se verifico que inicie cantos de manera autonoma.

### Jugadores e IA

- Solo un asiento es controlado directamente por el usuario.
- Los otros cinco asientos juegan con `pickAutoCard()`: usa la carta mas baja que gana o, si no puede, la mas baja.
- Esta automatizacion sirve para testear el flujo, pero no constituye IA estrategica de Truco.
- No hay multiplayer online ni autoridad de servidor.

### Roles y contenido extra

- Negociante:
  - Puede activar una tirada de dos dados antes de la primera carta.
  - Con suma 8 o mas invierte quien cobra los puntos de la mano.
  - No afecta el puntaje de Envido.
- Cartachin:
  - Puede elegir un arma antes de la primera carta.
  - Bug confirmado: `playSeatCard()` y `resolveTableTrick()` usan el poder crudo de la carta y no reciben `activeWeapon`.
  - `resolveVuelta()` en `rules/truco.js` si aplica armas, pero pertenece al flujo 1v1 que no usa la mesa 3v3 activa.
  - Resultado: el arma se selecciona y se muestra, pero no altera la resolucion activa.
- Jugador Estrella:
  - `roleDefinitions` declara actualmente que no tiene regla extra.
  - Hay inconsistencia documental: `MVP_CANON.md` menciona mejor mano/bonus, mientras el contexto reciente pide no agregar mecanica extra todavia.
- Sustancia X, bonus y modificadores:
  - Estan definidos en `cards.js`.
  - El hook fuerza el modificador `modo-clasico`; no forman parte del flujo activo.

### Lo que falta estabilizar

- Conectar armas de Cartachin al flujo real o esconderlas hasta que funcionen.
- Definir una unica regla canonica para Jugador Estrella.
- Revisar Envido 3v3 y la secuencia valida de cantos/respuestas.
- Hacer que los checks ejerciten el hook real y no solo logica duplicada.
- Separar seleccion de rol de seleccion futura de personaje sin cambiar silenciosamente los asientos de la mesa.

## 6. Estado de la Sala del Conflicto / PvP

### Implementacion real encontrada

- El modo existe y no es solo una idea.
- Estado y simulacion: `src/App.jsx`.
- Escena, ring, fighters, entrada, camara y efectos: `src/game/scene/TrucolocoScene.jsx`.
- Modelos/animaciones: `src/game/scene/CharacterFigure.jsx` y `src/game/data/characters.js`.
- El combate real-time se actualiza con `requestAnimationFrame()` y `stepArenaCombat()`.
- `ringKeysRef` mantiene teclas activas sin esperar turnos.
- `applyCombatAction()` ejecuta ataque basico, fuerte, especial, bloqueo y esquiva.
- Hay HP, cooldowns, stamina de esquiva, hitstun, knockback, KO, revancha y salida.
- Hay audio sintetizado mediante Web Audio en `playConflictHitSound()`.

### Controles actuales

- P1: WASD, click izquierdo o Q, E, R, Shift/Espacio, F/click derecho.
- P2 local: IJKL, H/U/O/P.
- Cuando P2 usa controles, `rivalControlled` pasa a `true`.
- No hay IA requerida ni networking; es multiplayer local en un teclado.

### Lo que funciona

- Ambos personajes pueden recibir input en tiempo real.
- Ataques aplican dano con cooldown.
- Bloqueo reduce dano.
- Esquiva desplaza al actor y consume stamina.
- Knockback desplaza al golpeado.
- HP y estado de KO existen.
- Hay feedback textual, flash/impacto visual y sonido sintetizado.

### Lo que esta incompleto o roto

- Impactos: se validan principalmente por distancia; no hay hitbox/hurtbox ni chequeo robusto de angulo.
- Timing: el dano se aplica al input, no en un frame/evento de contacto de la animacion.
- Animaciones: `RingCharacterModel` usa esencialmente el clip generico `"box"` para ataques distintos; no matchea basico/fuerte/especial.
- Colisiones: no hay colision jugador-jugador ni fisica de ring real.
- Movimiento: integracion directa de posicion; no hay aceleracion, desaceleracion, masa ni friccion.
- Camara: `getRingCameraPose()` controla automaticamente el encuadre; no conserva la libertad de camara del modo caminar y produce tomas cenitales o bloqueadas.
- Barras de vida: existen en HUD 2D y tambien como objetos 3D fijos mediante `RingHealthRail`; las barras 3D se superponen con personajes/camara.
- Escala: personajes caminables, personajes de mesa y luchadores usan escalas diferentes.
- Entrada: el acceso a la Sala del Conflicto es visualmente precario y usa posiciones hardcodeadas.
- Estado legado: `App.jsx` conserva ruleta y campos de interacciones anteriores junto al combate real-time.
- Online: no hay sincronizacion, servidor, lobby, salas ni autoridad.

### Naturaleza actual del PvP

- Es combate local real-time, no combate por turnos.
- La ruleta opcional si es una interaccion por turnos, separada del ring.
- Es una simulacion completamente cliente.
- No es seguro ni determinista para multiplayer online.

## 7. Fisica, controles y game feel

| Sistema | Estado | Diagnostico |
| --- | --- | --- |
| Movimiento en antro | Parcial | Tercera persona caminable y sprint; movimiento kinematico manual. |
| Movimiento en ring | Parcial | P1/P2 en tiempo real, pero sin aceleracion ni respuesta fisica. |
| Aceleracion/desaceleracion | Falta | Posicion cambia con velocidad directa; no hay curva de entrada/salida. |
| Gravedad | Falta | No hay fisica gravitatoria; el salto caminable es visual/controlado. |
| Colision con mesa | Parcial | `keepOutOfTable()` evita un circulo en modo caminar. |
| Colision con escenario | Parcial | Limites rectangulares/manuales; no hay colliders de geometria. |
| Colision entre jugadores | Falta | Los luchadores pueden solaparse. |
| Ataque basico | Parcial | Dano/cooldown/rango existen; falta contacto sincronizado y pose dedicada. |
| Ataque fuerte | Parcial | Estadisticas diferentes; visualmente no queda bien diferenciado. |
| Especial | Parcial | Mayor dano/cooldown; feedback y animacion no justifican el impacto. |
| Bloqueo | Parcial | Reduce dano, pero no verifica correctamente direccion frontal pese al texto del HUD. |
| Esquiva/dash | Parcial | Desplazamiento instantaneo con stamina; sin invulnerabilidad/curva claramente comunicada. |
| Cooldowns | OK basico | Evitan spam; estan dentro del gran estado de `App.jsx`. |
| Hit detection | Roto para calidad objetivo | Es distancia simple; no usa hitbox, hurtbox, angulo ni evento de animacion. |
| Knockback | Parcial | Desplazamiento directo; sin masa, pared, rebote ni separacion. |
| Feedback de golpe | Parcial | Hay texto, efecto, recoil y sonido sintetizado; no siempre coincide con el contacto visual. |
| Animaciones | Parcial / roto | Carga clips GLB, pero nombres Tripo son fragiles y ataques diferentes reutilizan `"box"`. |
| Camara caminable | Parcial | Tercera persona con rotacion; funcional pero sin colision de camara. |
| Camara ring | Roto | Automaticamente encuadra midpoint; puede quedar cenital, tapada o demasiado lejos. |
| Claridad HUD PvP | Parcial | HP y controles se entienden, pero hay informacion duplicada y objetos 3D invasivos. |
| Sensacion de peso | Falta | Sin aceleracion, anticipacion, contacto sincronizado o recuperacion fisica consistente. |

### Bugs de input concretos

- En el handler del ring, ramas genericas de movimiento consumen algunas teclas antes de ramas legacy posteriores; existen caminos de input inalcanzables.
- Espacio se usa como esquiva antes de una rama posterior que tambien intentaba usar Espacio/F para guardia; esa segunda interpretacion de Espacio no puede ejecutarse.
- Hay callbacks legacy de movimiento rival por flechas que quedan ocultos por ramas anteriores.
- El siguiente agente debe eliminar las ramas muertas antes de agregar controles.

## 8. Arquitectura y deuda tecnica

### Mezclas que bloquean velocidad

- `App.jsx` mezcla:
  - estado del shell;
  - vistas/camaras;
  - input global;
  - movimiento del ring;
  - reglas de combate;
  - audio;
  - ruleta;
  - HUD de conflicto.
- `TrucolocoScene.jsx` mezcla:
  - escena principal;
  - luces;
  - entrada;
  - ring;
  - fighters;
  - health rails;
  - revolver;
  - efectos;
  - algoritmo de camara.
- `useTrucolocoMatch.js` mezcla maquina de estados, reglas, automatizacion rival y copy de presentacion.
- `Hud.jsx`, `Table.jsx` y `styles.css` tienen demasiadas responsabilidades visuales.

### Separacion minima recomendada

Sin reescribir arquitectura:

1. Extraer de `App.jsx` un `useConflictCombat.js` con estado, tick, acciones y reset.
2. Extraer de `TrucolocoScene.jsx` un `ConflictArena.jsx` con ring, fighters y camara.
3. Mantener `useTrucolocoMatch.js` como nucleo del Truco y no agregarle PvP/networking.
4. Crear tests puros para resolucion 3v3 real reutilizando funciones del hook extraidas gradualmente.
5. Mantener el registry declarativo de personajes y centralizar escala/orientacion por contexto.

### Hardcodes relevantes

- Bounds, posiciones, escalas, luces y camara del ring estan hardcodeados.
- Los asientos de mesa son fijos, pero la seleccion de personaje puede representar otra identidad.
- Ataques y cooldowns estan hardcodeados dentro de `App.jsx`.
- Los nombres de clips GLB son configuraciones fragiles dependientes de Tripo/NLA.

### Que no conviene tocar todavia

- No migrar toda la app a una maquina de estados o ECS.
- No agregar networking real antes de estabilizar el combate local.
- No introducir un motor de fisicas solo para esconder bugs de input/camara.
- No expandir Sustancia X, cartas especiales o poderes antes de cerrar la mano clasica.
- No reemplazar todos los assets o personajes en la misma pasada.

### Performance

- Build principal: `1,597.27 kB` minificado, `488.15 kB` gzip.
- Vite advierte que el chunk supera 500 kB.
- Capturas MCP previas muestran cientos de objetos/materiales/geometrias y variacion fuerte de FPS segun escena.
- Hay muchos textos, materiales y geometria decorativa; falta un presupuesto explicito por escena.
- Antes de optimizar agresivamente, conviene medir por modo: antro, mesa y conflicto.

## 9. Bugs o errores encontrados

### Evidencia ejecutada

- `npm run check:rules`: pasa.
- `npm run check:flow`: pasa.
- `npm run check:ui` contra `http://127.0.0.1:9222`: pasa.
- `npm run build`: pasa con warning de chunk grande.
- `rg` confirma ausencia de motor de fisicas y networking de gameplay.
- `git status --short` confirma cambios previos no auditados como propios en:
  - `TRUCOLOCO_CONTEXT.md`
  - `trucoloco-web/package.json`
  - `trucoloco-web/src/App.jsx`
  - `trucoloco-web/src/game/scene/TrucolocoScene.jsx`

### Problemas concretos

1. **Armas de Cartachin sin efecto en flujo activo.** `activeWeapon` se selecciona, pero `playSeatCard()` y `resolveTableTrick()` no lo usan.
2. **Checks de reglas no cubren el hook real.** El check 1v1 valida armas en `resolveVuelta()`, mientras el juego usa flujo 3v3 diferente.
3. **Envido 3v3 incompleto.** Solo resuelve el asiento humano contra el asiento opuesto del mismo rol.
4. **Jugador Estrella sin canon unico.** Codigo actual sin regla extra; documento MVP menciona bonus/mejor mano.
5. **Seleccion de personaje y asientos pueden divergir.** La mesa conserva identidades fijas aunque se seleccione otra skin/personaje.
6. **Input del ring contiene ramas inalcanzables y teclas con significados superpuestos.**
7. **Hit detection del ring no coincide con animacion.** Dano inmediato por distancia, no por contacto/evento.
8. **Camara del ring produce encuadres malos.** El algoritmo automatico reemplaza la camara libre y no evita oclusiones.
9. **Barras de vida 3D duplican HUD y pueden tapar personajes.**
10. **No hay colision jugador-jugador.** Los modelos se atraviesan y pierden lectura.
11. **No hay fisica real.** Knockback, dash, limites y movimiento son offsets manuales.
12. **Bundle grande.** Un unico chunk JS de aproximadamente 1.60 MB minificado.
13. **Escena compleja.** Muchos objetos/materiales/geometrias y luces por modo; riesgo de regresiones de FPS.
14. **No existe validacion automatizada de Sala del Conflicto.**
15. **No existe multiplayer online.** Cualquier plan de salas requiere un nuevo limite cliente/servidor.

## 10. Plan recomendado para Claude Code/Fable

### Fase 1 - Estabilizar

Objetivo: preservar comportamiento y hacer que los bugs sean observables.

1. Crear un checkpoint/commit antes de tocar combate.
2. Eliminar ramas de input inalcanzables y documentar un unico mapa de controles P1/P2.
3. Extraer `useConflictCombat.js` desde `App.jsx` sin cambiar comportamiento.
4. Agregar un check automatizado puro del combate: movimiento, cooldown, dano, bloqueo, KO y reset.
5. Resolver el bug de Cartachin o deshabilitar visualmente sus armas hasta conectarlas.
6. Centralizar configuracion de escala/orientacion de personaje por contexto.

### Fase 2 - Core de Sala del Conflicto

Objetivo: un PvP local jugable y claro antes de online.

1. Mantener P1 vs P2 local; no invertir tiempo en IA.
2. Fijar una camara estable de arena con libertad limitada, zoom seguro y sin oclusiones.
3. Agregar separacion circular entre jugadores y colision contra limites del ring.
4. Reemplazar impacto por distancia con rango + cono frontal + ventana activa de ataque.
5. Separar startup, active frames y recovery para basico/fuerte/especial.
6. Hacer bloqueo frontal real y esquiva con ventana breve de invulnerabilidad.
7. Mantener HP, cooldowns, knockback y reset; eliminar estado legacy no usado.
8. Dejar una sola representacion de barras de vida, preferentemente HUD 2D fijo.
9. Garantizar revancha y salida sin estado residual.

### Fase 3 - Game feel

Objetivo: que el combate comunique contacto y decision.

1. Mapear clips distintos para basico, fuerte, especial, hit y KO; fallback procedural si falta clip.
2. Aplicar dano en el frame activo, no al presionar la tecla.
3. Agregar hit pause corto, recoil coherente y screen shake suave.
4. Mantener sonido sintetizado inicialmente, con variacion por golpe.
5. Agregar trail/particula simple solo durante active frames.
6. Ajustar aceleracion, desaceleracion, giro y knockback por playtest.
7. Eliminar textos decorativos que compitan con los combatientes.

### Fase 4 - Pulido Trucoloco

Objetivo: cerrar una mano clasica entendible sin romper PvP.

1. Conectar reglas de Cartachin al flujo 3v3 real.
2. Canonizar Jugador Estrella.
3. Revisar Envido y cantos 3v3 con tests.
4. Reducir repeticion de paneles/CTA del HUD.
5. Separar seleccion de rol y seleccion de personaje.
6. Mantener cartas tradicionales y assets existentes.

### Fase 5 - Futuro

- Multiplayer online con servidor autoritativo o arquitectura claramente definida.
- Lobby, salas, confirmacion de seis personas y sincronizacion de mesa.
- Voice chat WebRTC.
- Matchmaking, ranking y persistencia.
- Personajes definitivos, pipeline de animacion avanzado y balance.
- Fisicas mas complejas solo si el combate local demuestra necesitarlo.
- Contenido caotico adicional, Sustancia X y poderes expandidos.

## 11. Prompt ingredients

- Trabajar sobre `trucoloco-web/`; ignorar Unity salvo referencia.
- No reescribir todo ni agregar arquitectura enterprise.
- Preservar `useTrucolocoMatch.js` como nucleo del Truco; no mezclar PvP ahi.
- Primer objetivo: Sala del Conflicto local P1 vs P2 realmente jugable.
- No implementar IA rival: el producto esta destinado a jugar con amigos.
- No implementar networking online hasta estabilizar combate local.
- Extraer logica de combate de `App.jsx` a un hook pequeno y testeable.
- Extraer presentacion del ring de `TrucolocoScene.jsx` sin redisenar toda la escena.
- Corregir primero input muerto, camara, colisiones, hit timing y reset.
- Mantener controles P1/P2 explicitos y simultaneos.
- Impacto debe depender de rango, frente y active frame; no solo distancia al presionar tecla.
- Una sola UI dominante de HP; eliminar barras 3D que ocluyen.
- Usar clips GLB disponibles, pero proveer fallback si los nombres Tripo no coinciden.
- No cambiar tamano del ring sin una razon de gameplay medida.
- Mantener estetica calida/nocturna/criolla y claridad sobre espectacularidad.
- El Truco clasico usa 40 cartas, seis asientos, tres cartas por persona y hasta tres vueltas.
- Envido/Truco existen pero requieren revision 3v3.
- Cartachin actualmente muestra armas sin aplicar efecto en el flujo real.
- Jugador Estrella tiene conflicto de canon; pedir decision antes de expandirlo.
- Agregar checks automatizados del combate y luego correr `check:rules`, `check:flow`, `check:ui` y `build`.
- Evitar dependencias nuevas salvo que resuelvan una necesidad demostrada.

## 12. Preguntas abiertas

1. ¿La primera entrega online debe sincronizar solamente presencia/lobby o tambien combate y mesa? Son alcances tecnicos muy distintos.
2. ¿Cual es la regla canonica inmediata de Jugador Estrella: sin extra, mejor mano/bonus o una mecanica todavia por definir?
3. ¿Cartachin debe afectar cartas individuales en la mesa 3v3 o modificar el resultado global de una vuelta?
4. ¿La seleccion de personaje debe cambiar los nombres/asientos de la mesa o ser solo una skin/avatar del jugador?
5. ¿La Sala del Conflicto debe resolver una consecuencia real en la partida de Truco o permanecer como minijuego social separado durante el MVP?
