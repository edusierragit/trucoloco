# HANDOFF — Trucoloco

Última revisión: 10 de septiembre de 2026.

## Ubicación del proyecto

El repositorio real está en:

`C:\Users\Tomas\Desktop\T\Trucoloco\proyecto`

El website activo está dentro de:

`C:\Users\Tomas\Desktop\T\Trucoloco\proyecto\trucoloco-web`

Antes de continuar, abrir Codex directamente sobre la carpeta del repositorio real o trasladar el proyecto de forma deliberada. No asumir que la carpeta de esta tarea ya contiene el código.

## Estado actual del website

- Stack principal: Vite, React 19, Three.js, `@react-three/fiber`, `@react-three/drei` y postprocesado.
- La entrada actual carga el nuevo portal 2D mediante `src/portal/PortalApp.jsx`.
- El juego/antro 3D anterior sigue disponible y se carga de forma diferida desde `src/App.jsx` al elegir jugar.
- El diseño del portal está implementado en `src/portal/portal.css`.
- La URL de desarrollo prevista es `http://127.0.0.1:4173/`.
- El servidor local estaba funcionando en `http://127.0.0.1:4173/` al cerrar esta etapa.
- Rama de trabajo: `Nari`.
- La entrega completa del portal, sus recursos y los últimos ajustes fue autorizada para commit y push a `origin/Nari` el 10 de septiembre de 2026.
- No hacer `reset`, `checkout` ni limpieza de archivos sin revisar primero el estado de Git.

## Estructura y archivos importantes

### Raíz del repositorio real

- `AGENTS.md`: criterios visuales y técnicos; prioriza claridad, estética nocturna/criolla y cambios incrementales.
- `AGENT_WORKFLOW.md`: flujo operativo y obligación de trabajar en `Nari`.
- `CODEX_SESSIONS.md`: bitácora de sesiones y validaciones anteriores.
- `TRUCOLOCO_CONTEXT.md`: canon amplio de reglas, personajes y visión.
- `MVP_CANON.md`: canon corto del slice jugable.
- `MESA_VIVA_DESIGN.md`, `MULTIPLAYER_DESIGN.md` y documentos `TRUCOLOCO_*`: decisiones de diseño adicionales.
- `TrucolocoUnity/`: implementación Unity heredada; ya no es el camino principal.
- `trucoloco-web/`: implementación web activa.

### Website

- `trucoloco-web/src/main.jsx`: punto de entrada; importa Médula One y renderiza `PortalApp`.
- `trucoloco-web/src/portal/PortalApp.jsx`: portal principal, navegación, anotador, tienda, reglas, quizzes, acceso de muestra y lanzamiento del juego.
- `trucoloco-web/src/portal/portal.css`: estilos completos del portal y su responsive.
- `trucoloco-web/src/App.jsx`: juego/antro 3D y flujo jugable anterior.
- `trucoloco-web/src/styles.css`: estilos del juego 3D/HUD.
- `trucoloco-web/src/game/hooks/useTrucolocoMatch.js`: estado y lógica principal de la partida.
- `trucoloco-web/src/game/data/cards.js`: cartas del juego.
- `trucoloco-web/src/game/data/weapons.js`: armas y efectos.
- `trucoloco-web/src/game/data/characters.js`: personajes, roles, modelos y animaciones.
- `trucoloco-web/src/game/rules/truco.js`: reglas computables del truco.
- `trucoloco-web/src/game/scene/TrucolocoScene.jsx`: escena Three.js principal.
- `trucoloco-web/src/game/ui/Hud.jsx`: HUD del juego.
- `trucoloco-web/public/assets/brand/`: logo y espada, incluidas versiones HD.
- `trucoloco-web/public/assets/shop/`: referencias y composiciones de tienda.
- `trucoloco-web/public/assets/cards/trucoloco/`: imágenes de 41 cartas Trucoloco.
- `trucoloco-web/public/assets/cards/armas/`: imágenes de 35 cartas de armas; la galería actual usa 30 nombres/descripciones.
- `trucoloco-web/public/assets/cards/fronts/`: baraja española y cartas especiales en SVG.
- `trucoloco-web/public/assets/characters/`: modelos GLB y skins.
- `trucoloco-web/scripts/validate-*.mjs`: validaciones de reglas, flujo, UI y combate.

## Funcionalidades implementadas

### Portal y navegación

- Página inicial con logo Trucoloco 6.0, eslogan `El truco, pero bien loco.` y motivos de los cuatro palos.
- Barra fija con Inicio, Jugar, Anotador, Tienda y Reglas.
- La navegación principal reinicia cada sección a su pantalla inicial al volver a pulsarla.
- La barra permanece disponible cuando se entra al juego 3D y puede solicitar el regreso al portal.
- Transición visual entre inicio y secciones internas.
- Botón `Iniciar sesión` en inicio con modal de demostración: nombre, email, fecha de nacimiento y aviso de mayoría de 18 años. No hay cuentas reales ni backend.

### Jugar

- Selector entre `Truco tradicional` y `Trucoloco`.
- Texto de Trucoloco decidido: `El clásico, dos mazos extra y cero cordura.`
- Acciones posteriores: jugar con bot, jugar online, ranking y torneo.
- Solo `Jugar con un bot` abre actualmente el juego; online, ranking y torneo son vistas/acciones deshabilitadas de “próximamente”.
- Hay una maqueta simple de llave clasificatoria.
- El juego 3D existente incluye mesa, bar/antro, personajes, cámaras, modo caminar, controles táctiles, selección de rol/personaje, cantos básicos y sistemas experimentales de conflicto.

### Anotador

- Selector de partida a 15 o 30 puntos.
- Controles `+` y `−` para Nosotros y Ellos.
- El puntaje no baja de 0 ni supera el objetivo.
- Mensajes finales `¡Ganamos!` y `¡Ganaron!`.
- Botones `Nueva partida` y `Cambiar partida`.

### Tienda

- Título/eslogan decidido: `Tienda` / `Equipá tu mesa.`
- Mazo español incluido, Mazo Trazos y Mazo Gazpacho con composiciones visuales de tres cartas.
- Productos de muestra: Lentes del Hexágono, skins de personajes y Fichines.
- Marcadores de precio `$ --` y estado `Próximamente`.
- Animación de giro al pasar el cursor sobre previsualizaciones.
- La compra no es funcional; la sección lo aclara explícitamente.

### Reglas

- Selector entre Truco tradicional y Trucoloco.
- Reglas tradicionales ampliadas: conceptos básicos, cómo comienza, desarrollo de la mano, Envido, Truco y escala completa de valores de cartas.
- Envido y Truco muestran la aclaración `(canto)`.
- Quiz tradicional con preguntas base y combinaciones generadas sobre jerarquía de cartas.
- Reglas de Trucoloco ordenadas por reglas de mesa, equipos y roles, súper cantos, Mazo Trucoloco, Mazo de Armas, sanciones y práctica.
- Galerías visuales con imágenes, nombre externo y explicación de cada carta.
- Quiz de Trucoloco con preguntas base y preguntas generadas a partir de ambos mazos.
- Al responder, la opción correcta queda verde; la incorrecta queda roja y también se revela la correcta. Luego aparece `Siguiente`.

## Decisiones de diseño

- Usar Médula One como tipografía global del portal; se priorizó más tamaño y espaciado entre letras para mejorar legibilidad.
- Mantener una estética verde oscuro, crema y dorado: nocturna, criolla, elegante y levemente absurda.
- Reducir texto innecesario y hacer que cada pantalla presente decisiones simples.
- Conservar el logo aportado por el usuario, con la espada funcionando como la `T` de Trucoloco y el `6.0` tratado como parte del conjunto visual.
- Usar la espada HD del logo en los motivos decorativos y en el palo de espadas.
- Usar como basto la referencia visual semejante a un bate de béisbol aportada por el usuario.
- Fondo decorativo basado en los cuatro palos: espada, oro, copa y basto.
- Botones de Jugar y Reglas sin numeración `01/02`.
- Flecha sola para volver, sin texto adicional.
- Mantener la barra principal como vía consistente para volver a la raíz de cada sección.
- El portal es 2D para legibilidad; el juego conserva Three.js para mesa, atmósfera, personajes y exploración.
- En la tienda, las cartas se muestran abiertas en abanico y los productos giran al hacer hover.
- Las cartas de reglas se muestran completas y se acompañan con título y descripción fuera de la imagen.

## Decisiones tomadas durante la conversación

- Usar `Truco tradicional`, no `Truco común`.
- Subtítulo tradicional: `El de siempre. Envido, truco y orgullo.`
- CTA tradicional: `Entrar a la mesa`.
- Subtítulo Trucoloco: `El clásico, dos mazos extra y cero cordura.`
- CTA Trucoloco: `Entrar a la locura`.
- En Jugar, mostrar `Elegí el modo.`
- Mantener `Anotador`, no cambiarlo por `Contador`.
- En una partida activa, el título debe ser `Partida a 15 puntos` o `Partida a 30 puntos`, sin repetir `Anotador`.
- Para Nosotros usar `¡Ganamos!`; para Ellos usar `¡Ganaron!`.
- En Tienda usar `Equipá tu mesa.`
- Productos de tienda elegidos: mazos, lentes, skins de roles y fichines.
- El acceso/perfil es solo una demostración por ahora y exige conceptualmente ser mayor de 18 años.
- Los futuros modos de juego contemplan bot, online, ranking y torneo.
- Los rankings futuros deberían separar individual/equipos y tradicional/Trucoloco.
- El torneo propuesto es al mejor de tres con inscripción del equipo por su Negociador.
- Chat/micrófono durante partidas online queda como decisión futura; no implementarlo todavía.
- El tamaño general de las letras del portal se aumentó un punto visual y se igualaron tamaños entre elementos equivalentes.
- Los textos del menú fijo deben quedar centrados respecto de sus símbolos, sin correcciones laterales distintas para Inicio o Reglas.
- Los botones secundarios de Jugar deben aparecer en este orden: Jugar con un bot, Jugar online, Torneo y Ranking.
- Torneo y Ranking quedan disponibles como demostraciones visuales tanto en Truco tradicional como en Trucoloco.
- Jugar con un bot y Jugar online abren por ahora la misma pantalla jugable existente; el funcionamiento real por internet sigue pendiente.
- La entrada a Trucoloco usa una transición de humo; la entrada al Truco tradicional usa una variante cálida de la misma transición.
- El nuevo movimiento de mazo se prueba primero solo con el Mazo español antes de decidir si se extiende a los otros mazos.
- En reglas usar `Cómo comienza`, no `Cómo arranca`, y decir `El juego termina`, no `La partida termina`.
- Trucoloco se presenta como `Baraja española & barajas especiales`.
- Las explicaciones de reglas deben ser completas, aunque el resto del portal sea minimalista.

## Cambios realizados recientemente

- Se aumentó ligeramente el tamaño de todas las letras del portal, incluido el eslogan, el 6.0, el acceso, el menú, los títulos, los botones y los contenidos.
- Se corrigió la alineación de Inicio, Anotador y Reglas respecto de sus símbolos.
- Se reemplazó la flecha recta de regreso por una flecha curva y fina, centrada dentro del botón.
- Los cuatro botones de Jugar ahora se despliegan con movimiento progresivo.
- Torneo aparece antes de Ranking y usa un símbolo triangular de juego.
- Ranking muestra dos listas de ejemplo: individual y por equipos, con seis posiciones. Trucoloco incluye roles y Truco tradicional los oculta.
- Torneo despliega la Clasificatoria solamente al pulsarlo. Equipo 1 y Equipo 2 aceptan nombre, OK y Cancelar. El juego se abre después de que ambos equipos confirman.
- Jugar con un bot y Jugar online abren el juego con una transición más cuidada.
- Reglas despliega el contenido con un movimiento ascendente y progresivo.
- El Mazo español se muestra como un mazo completo inclinado y gira manteniendo la cara hacia arriba. Los otros dos mazos conservan su presentación anterior hasta aprobar esta prueba.
- Los lentes y las prendas giran de manera individual al pasar sobre cada ejemplo.
- Se creó `public/assets/shop/fichines-premium.png`, una imagen con más volumen para reemplazar los fichines planos.
- La construcción final, las reglas, el recorrido del juego y el conflicto fueron comprobados correctamente el 10 de septiembre de 2026.

## Problemas y pendientes

### Críticos de control de versiones

- El portal actual no está committeado en el repositorio real.
- La rama `Nari` sigue apuntando al mismo commit que `main` y `origin/main` (`2adabe0`).
- Antes de continuar: revisar `git status`, validar y crear un commit en `Nari`.
- El usuario autorizó el commit y el push de esta entrega a `origin/Nari` el 10 de septiembre de 2026.
- Trabajar siempre dentro de `C:\Users\Tomas\Desktop\T\Trucoloco\proyecto`.

### Portal

- La alineación de `Inicio`, `Anotador` y `Reglas` fue corregida; conservarla salvo nueva indicación visual del usuario.
- Revisar toda la tipografía en tamaños desktop y mobile para asegurar que el espaciado no sea excesivo.
- Confirmar que el logo, el eslogan y `6.0` sigan centrados como un único conjunto en distintos anchos.
- Validar el basto de referencia en desktop y mobile.
- Revisar accesibilidad: foco de teclado, contraste, etiquetas y reducción de movimiento.
- Revisar visualmente los nuevos tamaños y movimientos en un teléfono real.

### Tienda

- Las imágenes/precios son demostrativos; faltan catálogo, checkout, moneda y backend.
- Revisar la fidelidad del Mazo Gazpacho y decidir si se conservan o limpian marcas/nombres incorporados dentro de las imágenes originales.
- Confirmar visualmente que el abanico del Mazo español usa cartas tradicionales y que Mazo Trazos usa el lenguaje vectorial.
- La rotación actual es una ilusión CSS, no un modelo 3D real.

### Reglas y contenido

- Contrastar todo el contenido con `Trucoloco (reglamentacion).docx.pdf`, `Mazo Trucoloco.pdf` y `Mazo De Armas.pdf` antes de considerarlo canon definitivo.
- Resolver la diferencia entre las 35 imágenes disponibles del Mazo de Armas y las 30 cartas actualmente nombradas/renderizadas.
- Revisar nombres duplicados en el Mazo Trucoloco (`Hexágono 3 gafas`, `Hexágono 2 gafas`, etc.) y asociarlos correctamente con cada imagen.
- El quiz tradicional tiene muchas combinaciones de jerarquía, pero no llega a cubrir todas las preguntas posibles sobre cantos y situaciones de juego.
- El quiz Trucoloco genera preguntas de cartas, pero todavía necesita validación humana de reglas y redacción.

### Cuenta, online y producto

- Crear perfiles reales requerirá autenticación, base de datos, política de privacidad, validación de edad y recuperación de cuenta.
- Jugar online, rankings y torneos no están implementados.
- El botón Jugar online abre hoy el juego local existente, pero todavía no conecta personas por internet.
- El Ranking usa nombres y puntos de muestra; no guarda resultados reales.
- La Clasificatoria funciona como demostración dentro de una sola computadora; todavía no coordina dos equipos conectados.
- Definir arquitectura de salas, persistencia de ranking, equipos, matchmaking y moderación.
- Decidir el sistema de comunicación online: texto, voz libre o voz habilitada por turnos.
- Probar rendimiento y controles en teléfonos reales.
- Optimizar modelos GLB y texturas grandes; varios assets todavía usan texturas de 2K/4K.

### Validación técnica

- El servidor respondió correctamente en `http://127.0.0.1:4173/` al cerrar esta etapa.
- `npm run build`, `check:rules`, `check:flow` y `check:conflict` terminaron correctamente el 10 de septiembre de 2026.
- `check:ui` tuvo limitaciones previas al iniciar Edge/CDP; el flujo fue revisado manualmente.
- El build produce un warning conocido por el tamaño del bundle de Three.js/R3F.

## Instrucciones para ejecutar el website

Abrir PowerShell en el repositorio real:

```powershell
Set-Location -LiteralPath 'C:\Users\Tomas\Desktop\T\Trucoloco\proyecto\trucoloco-web'
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --strictPort
```

Abrir en el navegador:

`http://127.0.0.1:4173/`

Para usar el flujo con MCP/bridge de Three.js:

```powershell
npm.cmd run dev:mcp
```

Validaciones disponibles:

```powershell
npm.cmd run check:rules
npm.cmd run check:flow
npm.cmd run check:conflict
npm.cmd run check:ui
npm.cmd run build
```

No ejecutar el build solo para mirar el sitio; el comando de desarrollo es suficiente. Si ya existe `node_modules`, no hace falta reinstalar dependencias.

## Próximos pasos recomendados

1. Abrir una tarea de Codex directamente en `C:\Users\Tomas\Desktop\T\Trucoloco\proyecto` y confirmar que la rama activa sea `Nari`.
2. Revisar `git status` y preservar todos los cambios sin commit.
3. Levantar el servidor en `127.0.0.1:4173` y recorrer Inicio, Jugar, Anotador, Tienda y Reglas en desktop y mobile.
4. Confirmar los últimos ajustes pequeños de alineación de Inicio/Reglas y no introducir cambios adicionales sin nueva indicación del usuario.
5. Ejecutar las validaciones de reglas, flujo, conflicto y build.
6. Crear un commit local en `Nari` cuando el usuario lo pida; no hacer push sin permiso explícito.
7. Comparar las galerías y reglas contra los PDF originales y resolver correspondencias/nombres faltantes.
8. Continuar luego con perfiles reales, online, rankings y torneos como etapas separadas.

## Reglas de colaboración y continuidad

- Hablar con el usuario en español sencillo, con instrucciones cortas y de un paso por vez.
- Explicar inmediatamente entre paréntesis cualquier palabra técnica de programación.
- Vigilar la longitud del chat, la cantidad de imágenes e información, las repeticiones, la pérdida de contexto y cualquier lentitud mencionada por el usuario.
- Si el chat empieza a ser riesgoso por su tamaño, decir exactamente: “Este chat está empezando a ser demasiado largo. Conviene terminarlo y continuar en uno nuevo.”
- Antes de cambiar de chat, terminar la tarea actual si es seguro, guardar los cambios en el repositorio real, comprobar el website y revisar Git (sistema que registra los cambios del proyecto).
- Hacer commit (guardar oficialmente una versión de los cambios) y push (subir esa versión a GitHub) en la rama activa solamente si el usuario confirma que la tarea terminó.
- Nunca borrar archivos, conversaciones ni versiones anteriores para efectuar el traspaso.
- Actualizar este archivo antes del traspaso sin copiar su contenido completo al chat.
- Entregar un mensaje breve para el chat nuevo y recordar conservar el chat anterior como referencia.
- Mantener el trabajo incremental y visualmente verificable. No reescribir el proyecto, no borrar cambios del usuario y no modificar `main`.
- Ante cualquier duda de canon, consultar primero `CODEX_SESSIONS.md`, luego `MVP_CANON.md` y finalmente `TRUCOLOCO_CONTEXT.md` o los PDF originales.
