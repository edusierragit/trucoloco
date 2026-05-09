# Trucoloco Context

## Proposito

Este archivo es la fuente de verdad operativa del proyecto.
Cada vez que el usuario aclare una regla real, un nombre canonico, un flujo importante o una decision de producto, hay que registrarlo aca.

## Regla de trabajo para agentes

- No inventar canon si ya existe informacion en este archivo.
- Si el usuario pasa una regla o dato relevante, actualizar este archivo en la misma sesion.
- Si hay contradiccion entre codigo y este archivo, gana este archivo hasta que el codigo se alinee.
- `MVP_CANON.md` resume el slice actual.
- Este archivo guarda el contexto de producto mas estable y acumulativo.

## Canon confirmado

### Formato

- `3 vs 3`
- `6 jugadores`
- `3 roles`
- El MVP actual trabaja `1 duelo activo por rol`, no los 6 jugadores resolviendo en simultaneo.

### Roles

- `Negociante`
- `Jugador Estrella`
- `Cartachin`
- La interfaz tiene que tratar la eleccion de rol como el primer paso real antes de jugar la mano
- El rol define identidad, recursos y tono del duelo antes de tocar una carta
- La mano no debe arrancar visual ni logicamente hasta confirmar el rol y dar inicio a la mano
- En el loop base, el rol se elige antes de arrancar la partida/mano de prueba y no debe reaparecer como paso principal entre vueltas o manos

### Duelos por rol

- `Irvyn` vs `Marvyn` para `Negociante`
- `Gazpacho` vs `Myke Keta` para `Jugador Estrella`
- `Cartachin Sur` vs `Cartachin Norte` para `Cartachin`

## Fuentes IRL pendientes de canonizar

- `TRUCOLOCO_IRL_TRANSCRIPT_EXTRACTION.md` resume la transcripcion de una partida IRL de aproximadamente 2h30m.
- Esa extraccion contiene timestamps aproximados, hablantes aproximados, frases, reglas semi-reales, poderes inventados y momentos de caos.
- No tomar esos hallazgos como canon automatico: sirven como banco de tono, nombres, roles, armas futuras y reglas candidatas.
- Criterio sugerido: primero preservar el slice de truco clasico legible; despues incorporar roles/armas/eventos como capas modulares.

### Poderes de rol para el MVP

- `Negociante`:
  - poder `Negociar puntos`
  - al abrir la mano se tiran dados
  - si la suma da `8 o mas`, los puntos de la mano se cobran invertidos
- `Cartachin`:
  - es el unico rol que usa armas
- `Jugador Estrella`:
  - por ahora no mete mecanica extra en el slice clasico
  - fija el duelo y el tono

## Vision de producto

- Trucoloco IRL nacio espontaneo: humor de mesa, atrevimiento, negociacion absurda y reglas/poderes que aparecen alrededor del truco
- El juego digital tiene que capturar esa energia sin perder lectura
- La fantasia base deseada es entrar a una escena/lobby con 6 personas, que los 6 se sienten en la mesa y que ahi arranque la partida de Trucoloco
- El juego puede pensarse como una habitacion 3D con mesa, personajes y una fase de sentarse/arrancar antes de la mano
- La mesa 3v3 debe tener asientos fijos; no se deben reordenar los personajes al cambiar de rol porque rompe la lectura espacial
- En el truco 3v3 real, la ronda debe respetar el sentido de mesa y los enfrentamientos por posicion; el MVP 1v1 por rol es solo una simplificacion intermedia
- El estado de UI debe exponer `mesa 3v3`, `orden de ronda`, `mano`, `reparte` y `actua`
- El MVP puede mantener `1 rol activo` controlado por el jugador, pero las otras posiciones de la mesa deben jugar automatizadas para que la vuelta respete seis asientos y no parezca un duelo falso
- La `mano` debe rotar por los 6 asientos fijos; el `repartidor` es el asiento anterior en el orden de ronda
- La seleccion de rol/personaje puede sentirse como character select de arcade/Street Fighter antes de entrar al mundo
- Referencia de sensacion: una mesa/antro tipo `Liar's Bar`, con tension de cartas, presencia de personajes y foco en la mano, pero sin copiar assets ni depender de multijugador real para el MVP
- Las cartas tradicionales de truco deben seguir siendo tradicionales
- La jerarquia/fuerza de cartas es dato interno para resolver vueltas; no debe mostrarse como stat numerico en la UI
- La locura Trucoloco debe vivir principalmente en:
  - roles
  - poderes
  - frases
  - decisiones de mano
  - presencia de personajes
  - eventos alrededor de la mesa
- Para assets de cartas, usar material propio, generado o open-source con licencia clara; no copiar assets cerrados de apps comerciales
- La ruta recomendada para cartas del MVP es primero `CSS/SVG propio` inspirado en baraja espanola: numero grande, palo claro, marco tactil y reverso Trucoloco; despues evaluar assets dominio publico como Fournier 1878 si se acepta el pipeline/licencia
- Tiene sentido empezar a cargar modelos reales cuando el loop jugable ya pida identidad visual, no antes
- El `ring de conflicto` no debe sentirse como un boton de interfaz: debe existir como habitacion fisica separada del antro/mesa, a la que se entra caminando cuando una discusion de reglas o mesa necesita resolverse de forma absurda
- La mecanica futura del ring apunta a pelea fisica graciosa tipo muñecos torpes/borrachos, no a paneles de texto; el MVP puede prototipar movimiento, empujones y golpes simples
- El chat de voz es parte importante de la fantasia social de Trucoloco, pero tecnicamente no lo resuelve Three.js: la escena lo acompaña visualmente; la voz real deberia integrarse con WebRTC/Web Audio y signaling cuando exista multiplayer

## Reglas del slice actual

- Base: `truco clasico`
- Mazo activo del MVP: `40 cartas tradicionales del truco argentino`
- Una mano se resuelve en `hasta 3 vueltas`
- La palabra visible para el jugador es `vuelta`, no `baza`
- Primero a `30` puntos gana la partida
- La base jugable debe ser truco normal ronda por ronda con cartas tradicionales
- Los cantos clasicos (`Envido`, `Truco`, luego `Retruco`/`Vale cuatro`) pertenecen a la base del juego, no a la capa caotica de Trucoloco
- `Envido` se canta antes de la primera carta y suma puntos de tanto
- `Truco` aumenta el valor de la mano; si el rival no quiere, concede puntos sin seguir jugando la mano
- En el flow base, si ya se canto `Truco`, no se debe seguir ofreciendo `Envido`
- `Envido` debe resolverse como subfase antes de volver a jugar cartas: se canta, el rival quiere/no quiere, se muestran/cantan tantos, se anota y recien ahi sigue la mano
- El MVP ya puede exponer una primera version de `Envido` y `Truco` contra rival scriptado; `Retruco`/`Vale cuatro` quedan preparados internamente pero solo deben mostrarse cuando el turno de subir corresponda
- Las cartas no deben mostrar "fuerza" como stat visible; la jerarquia de truco queda interna y se comunica por resultado de vuelta
- Los roles (`Cartachin`, `Jugador Estrella`, `Negociante`) agregan extras encima del truco normal, no reemplazan la base
- Primero hay que lograr bien el truco normal, sus cartas, turnos y resolucion; recien despues se suman los extras grandes de roles
- Para el rival scriptado del MVP:
  - si abre vuelta, puede jugar agresivo
  - si responde una carta humana, debe usar la carta mas barata que gana
  - si no puede ganar, debe tirar la carta mas baja

## Alcance actual del MVP

### Entra

- Elegir rol
- Ver claramente contra quien jugas
- Abrir mano
- Activar el poder del rol si aplica
- Jugar cartas del mazo tradicional
- Resolver hasta `3 vueltas`
- Cerrar mano
- Sumar puntos
- Siguiente mano
- Mesa 3D como ambientacion
- UI 2D para lectura y acciones

### No entra por ahora

- Reglamento completo del PDF
- Multijugador real
- Simulacion completa de los 6 jugadores a la vez
- Cartas Trucoloco raras metidas en el loop base
- Humo o FX que ensucien la lectura del slice clasico
- Modelado final de personajes

## Direccion visual actual

- Primero claridad y coherencia
- Despues polish
- En el slice clasico, evitar humo y delirio visual que tapen la mesa
- La escena 3D acompana
- La interfaz explica el juego
- Trucoloco se trabaja como `juego web con 3D decorativo y 2D funcional`

## Prioridad operativa actual

- Cerrar primero una mano clasica entendible de punta a punta
- No sumar caos ni features nuevas hasta que la mano clasica sea clara, fluida y coherente
- Tratar `useTrucolocoMatch.js` como nucleo del juego y `TrucolocoScene.jsx` como capa de presentacion
- Optimizar para un loop jugable claro, no para una demo tecnica de Three.js
- Se permite reinventar presentacion, flow e interaccion si eso ayuda a manifestar mejor el juego andando
- El objetivo actual no es proteger una base fragil, sino encontrar una base jugable que empiece a tener sentido
- Pasar mas peso a 3D esta permitido si mejora claridad, personalidad o ganas de cargar modelos reales
- La fase de moverse por el antro y sentarse en la mesa es deseada, pero debe entrar como capa previa/lobby despues de que el reglamento base sea coherente
- En vistas fuera de mesa, como `Puerta`, no se deben poder jugar cartas ni avanzar turnos; la accion jugable vuelve al foco solo al regresar a la mesa
- Si una feature pide demasiado trabajo de escena, buscar primero una version `2D`
- No motorizar de mas ni meter sistemas genericos sin necesidad concreta del MVP
- Antes de sumar contenido, mejorar feedback: timings, highlight, animacion de cartas, claridad de turnos y resolucion de vuelta
- Todo feature nuevo tiene que mejorar al menos una de estas cosas:
  - decision
  - lectura
  - personalidad
- Orden de trabajo actual:
  - mejorar flow
  - mejorar interfaz
  - mejorar escena 3D
  - recien despues expandir contenido

## Criterio de lectura del MVP

- El jugador tiene que entender siempre:
  - quien es
  - contra quien juega
  - quien sale primero
  - quien reparte
  - en que vuelta esta
  - que puede hacer ahora
  - que paso recien
  - cuando termina la mano
- La jugada actual debe vivir en el centro de mesa: dos slots claros para tu carta y la carta rival, visibles antes, durante y despues de resolver la vuelta
- El criterio de exito no es `mas cosas`; es que el jugador entienda en `5 segundos` quien es, que puede hacer y que paso
- No meter `Truco` o `Envido` complejos si rompen lectura del slice clasico
- Si un mock, texto o elemento visual confunde, se simplifica o se saca
- Quitar copy mockeado o generico cuando tape el contenido real del juego
- Si hace falta inventar nombres, frases o poderes por arriba de la logica canonica, esperar `OK` del usuario antes de consolidarlos

## Testing

- Para probar hoy, alcanza con `1 humano vs 1 rival scriptado` por rol
- No hace falta un simulador completo de 6 jugadores todavia
- Si mas adelante se agrega `modo prueba`, debe servir para:
  - forzar quien es mano
  - forzar cartas iniciales
  - testear roles y armas

## Assets y personajes

- El usuario paso una foto para usar como base de `Gazpacho`
- Todavia no hay un modelo real importado en Three.js
- Antes de meter modelado serio, conviene cerrar el slice clasico entendible
