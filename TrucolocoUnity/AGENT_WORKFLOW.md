# TrucolocoUnity Agent Workflow

## Objetivo actual

Construir un MVP híbrido `3D + UI` para `Trucoloco` en Unity 6.

- `3D`: mesa, luces, humo, props, personajes más adelante.
- `UI`: cartas jugables, HUD, highlights, feedback de mano, modificadores.

## Canon actual del juego

- Formato: `3v3`
- Roles:
  - `Negociador`
  - `Jugador Estrella`
  - `Team Manager`
- Cada jugador enfrenta al rival de su mismo rol.
- Personajes vigentes en código:
  - `Marvyn` (`Negociador`, A)
  - `El Gazpacho` (`Jugador Estrella`, A)
  - `Irvyn` (`Team Manager`, A)
  - `El Consul` (`Negociador`, B)
  - `El Ruso` (`Jugador Estrella`, B)
  - `Cartachin` (`Team Manager`, B)

## Escenas

- `Assets/Scenes/SampleScene.unity`
  - usar como laboratorio / blockout / referencia.
- `Assets/Scenes/TrucolocoRuntime.unity`
  - usar como escena runtime principal del MVP.

## Estado actual de arquitectura

- `Assets/Scripts/Scene/TrucolocoSceneBootstrap.cs`
  - genera la escena base bajo `_Generated`
  - tiene `sceneMode`:
    - `Blockout`
    - `Runtime`
  - `autoRebuildInEditor` debe quedar apagado por defecto
- `Assets/Scripts/Scene/TableSceneController.cs`
  - hoy concentra demasiada lógica
  - controla HUD, cartas, highlights, modificadores y loop de mano
  - próximo refactor recomendado:
    - `RuntimeHudController`
    - `HandSimulationController`
    - `RuntimeFxController`
- `Assets/Editor/TrucolocoSceneBootstrapEditor.cs`
  - agrega botón visible `Rebuild Trucoloco Scene` en el Inspector
- `Assets/Editor/UnityMcpRecovery.cs`
  - recovery táctico para el bridge Unity-MCP
  - no convertirlo en muleta permanente

## Unity / MCP: lo que ya aprendimos

- El bridge MCP puede “caerse” cuando `Assembly-CSharp` no recompila.
- Síntoma: tools timeout, `/api/tools` vacío o parcial.
- Recovery que funcionó:
  - corregir compilación
  - reiniciar Unity
  - dejar que `Assembly-CSharp.dll` se regenere
- `AI-Game-Developer-Config.json` útil real:
  - `TrucolocoUnity/UserSettings/AI-Game-Developer-Config.json`
- También existe una copia en `Assets/Resources`, pero la referencia de trabajo no debe confundirse.

## Lecciones de workflow

- No perseguir “todo 3D” para un card game desde el día 1.
- El blockout sirvió para validar input, no para entregar el runtime final.
- El aprendizaje más valioso viene de separar:
  - escena de laboratorio
  - escena runtime
- Si el usuario no ve el botón de rebuild:
  - abrir `Inspector`
  - seleccionar `TrucolocoBootstrap`
  - usar el botón visible del custom editor

## Problemas vistos

- Auto rebuild en editor generaba caos visual y confusión.
- Mezclar textos 3D con HUD rompía legibilidad.
- Placeholder world-space de personajes distrae más de lo que aporta.
- La UI puede quedar fuera de escala o cortada si los pivots/anchors no están bien.

## Siguiente dirección recomendada

1. Mantener `SampleScene` sólo como blockout.
2. Mejorar `TrucolocoRuntime` como vertical slice real.
3. Reducir `TableSceneController` en responsabilidades.
4. Construir feedback de carta jugada más claro:
   - animación simple
   - cartas al centro
   - highlight ganador
   - modificador de mano visible
5. Reemplazar placeholders con personajes importados cuando existan assets reales.

## Regla práctica para agentes

- Antes de inventar más features, confirmar:
  - compila
  - la escena runtime sigue legible
  - no se reintroduce basura de blockout en `Game`
