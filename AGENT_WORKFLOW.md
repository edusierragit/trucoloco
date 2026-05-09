# Trucoloco Agent Workflow

## Direccion activa

- Camino principal actual: `trucoloco-web/`
- Camino secundario / legado: `TrucolocoUnity/`
- Motivo del pivot:
  - `Unity + MCP` sirvio para aprender tooling, pero metia friccion innecesaria para iterar un card game.
  - `Three.js + UI web` es mas coherente para un MVP jugable, legible y facil de vibecodear.

## Proyecto y canon actual

- Proyecto web activo: `trucoloco-web/`
- Proyecto Unity legado: `TrucolocoUnity/`
- Fuente acumulativa de verdad: `TRUCOLOCO_CONTEXT.md`
- Fuente corta de verdad para el slice actual: `MVP_CANON.md`
- Relevo operativo liviano entre chats/agentes: `CODEX_SESSIONS.md`
- Escena laboratorio/blockout: `TrucolocoUnity/Assets/Scenes/SampleScene.unity`
- Escena runtime principal: `TrucolocoUnity/Assets/Scenes/TrucolocoRuntime.unity`
- Stack web actual: `Vite + React + Three.js + @react-three/fiber + @react-three/drei`
- Stack Unity legado: `Unity 6 + Unity-MCP + scripts C#`
- Tono: turbio, gracioso, argentino, absurdo

## Uso de contexto sin quemar tokens

- Leer `CODEX_SESSIONS.md` primero para entender estado y pendientes.
- No leer todos los `.md` largos por defecto.
- Abrir `TRUCOLOCO_CONTEXT.md` solo para canon/reglas/personajes/vision.
- Abrir `MVP_CANON.md` solo para cambios del slice jugable.
- Al cerrar una sesion larga, registrar relevo corto en `CODEX_SESSIONS.md`.

## Canon de personajes y roles

- Equipos: `3v3`
- Roles:
  - `Negociante`
  - `Jugador Estrella`
  - `Cartachin`
- Cada rol existe en ambos equipos:
  - `Irvyn` vs `Marvyn` (`Negociante`)
  - `Gazpacho` vs `Myke Keta` (`Jugador Estrella`)
  - `Cartachin Sur` vs `Cartachin Norte` (`Cartachin`)
- Poderes canon minimos del MVP:
  - `Negociante`: puede `negociar puntos`; se tiran dados y, si sale bien, la mano cobra invertida
  - `Cartachin`: es el unico rol que usa el mazo de armas
  - `Jugador Estrella`: carril de cartas pesadas y bonus mas agresivos
- Team A:
  - `Irvyn` (`Negociante`)
  - `Gazpacho` (`Jugador Estrella`)
  - `Cartachin Sur` (`Cartachin`)
- Team B:
  - `Marvyn` (`Negociante`)
  - `Myke Keta` (`Jugador Estrella`)
  - `Cartachin Norte` (`Cartachin`)

## Estado del gameplay

- El duelo jugable actual depende del rol seleccionado:
  - `Irvyn vs Marvyn`
  - `Gazpacho vs Myke Keta`
  - `Cartachin Sur vs Cartachin Norte`
- El HUD debe permitir cambiar de rol antes o durante las pruebas del MVP
- El mazo mezcla truco clásico con cartas absurdas extra tipo Yu-Gi-Oh
- Modificadores de mano implementados:
  - `Sustancia X`
  - `Gafas Legendarias`
  - `Tiempo Arena`
  - `Exodia de Bolsillo`
- Fuente de verdad actual de reglas/cartas en web:
  - `trucoloco-web/src/game/data/cards.js`
  - `trucoloco-web/src/game/data/weapons.js`
  - `trucoloco-web/src/game/hooks/useTrucolocoMatch.js`
- Estas fuentes todavia son una version reducida del reglamento real; cuando se pase el canon completo, esos archivos son los que hay que extender.

## Decision importante de producto

- No conviene empujar "todo 3D" para el MVP.
- Direccion correcta:
  - `3D` para mesa/atmosfera/personajes/props
  - `2D UI` para cartas/HUD/feedback
- En web esto ya se aplica desde el arranque.
- En Unity queda como aprendizaje, no como camino principal.

## Estado del proyecto web

- Slice actual en `trucoloco-web/`:
  - mesa 3D
  - personajes placeholder alrededor de la mesa
  - HUD 2D legible
  - mano jugable minima
  - cartas al centro
  - modificador de mano visible
  - `Truco` y `Envido` basicos
  - respuesta a canto del rival (`Quiero` / `No quiero`)
  - apuesta visible de la mano
- Hook principal:
  - `trucoloco-web/src/game/hooks/useTrucolocoMatch.js`
- Escena principal:
  - `trucoloco-web/src/game/scene/TrucolocoScene.jsx`
- HUD principal:
  - `trucoloco-web/src/game/ui/Hud.jsx`

## Aprendizajes del workflow Unity

- El `Inspector` puede quedar vacío simplemente porque no hay ningún GameObject seleccionado
- Para regenerar la escena, seleccionar `TrucolocoBootstrap`
- Existe un editor custom con botón visible:
  - `Assets/Editor/TrucolocoSceneBootstrapEditor.cs`
- `autoRebuildInEditor` quedó apagado por defecto para evitar reconstrucciones molestas

## Aprendizajes del workflow MCP

- El bridge Unity-MCP se destrabó cuando volvió a compilar `Assembly-CSharp`
- Recovery helper:
  - `TrucolocoUnity/Assets/Editor/UnityMcpRecovery.cs`
- Config local para Codex:
  - `.codex/config.toml`
- Unity MCP ya no esta registrado en la config global de Codex.
- En este repo quedo opt-in:
  - usar `scripts/enable-unity-mcp.ps1`
  - usar `scripts/disable-unity-mcp.ps1`
- El proyecto puede tener Unity-MCP operativo aunque una sesión de Codex no exponga todavía tools MCP
- No asumir que el runner de la sesión soporta tools dinámicas sólo porque Unity dice `MCP server: Running`

## Qué no repetir

- No seguir parcheando `SampleScene` como si fuera la escena final
- No volver a usar nombres de rol viejos como `Negociador` o `Team Manager`
- No meter textos 3D innecesarios en runtime
- No dejar `autoRebuildInEditor` prendido salvo que se esté ajustando el blockout a propósito
- No dejar reglas reales del usuario solo en el chat: si cambia el canon, registrar `TRUCOLOCO_CONTEXT.md`

## Proximo objetivo recomendado

1. Mejorar animacion de carta jugada en web
2. Agregar `Truco`, `Envido` y `No quiero`
3. Meter cartas de armas y eventos locos
4. Reemplazar placeholders 3D por billboards o personajes reales
5. Evaluar MCP/browser tooling para Three.js si el cliente lo soporta
