# Trucoloco Web Agent Workflow

## Decision de producto

Este proyecto web reemplaza el camino principal de Unity para el MVP.

- `3D`: mesa, luces, humo, props, personajes simples
- `UI`: cartas, HUD, relato, highlights y acciones

## Stack

- `Vite`
- `React`
- `Three.js`
- `@react-three/fiber`
- `@react-three/drei`

## Canon vigente

- Fuente acumulativa de verdad: `../TRUCOLOCO_CONTEXT.md`
- Formato `3v3`
- Roles:
  - `Negociante`
  - `Jugador Estrella`
  - `Cartachin`
- Team A:
  - `Irvyn`
  - `Gazpacho`
  - `Cartachin Sur`
- Team B:
  - `Marvyn`
  - `Myke Keta`
  - `Cartachin Norte`

## Slice actual

- Duelo jugable: cambia segun el rol activo
- Selector de rol visible en HUD:
  - `Negociante`
  - `Jugador Estrella`
  - `Cartachin`
- Mazo mezclado:
  - truco clasico
  - cartas absurdas extra
- Modificadores visibles:
  - `Sustancia X`
  - `Gafas Legendarias`
  - `Tiempo Arena`
  - `Exodia de Bolsillo`
- Cantos basicos:
  - `Truco`
  - `Envido`
  - respuesta `Quiero / No quiero`
- La apuesta de mano vive en `activeBet`
- El estado pendiente del rival vive en `pendingCall`

## Regla de arquitectura

- No mezclar UI jugable con objetos 3D de informacion redundante.
- Mantener el estado de partida en hooks puros.
- Mantener la escena 3D declarativa y tonta.
- Si se agregan FX, que salgan del estado del match, no de side effects sueltos.
- Si el usuario aclara una regla o decision real, registrarla tambien en `../TRUCOLOCO_CONTEXT.md`.

## Siguiente direccion

1. Meter animacion real de carta al centro
2. Introducir cartas de armas
3. Reemplazar cilindros por personajes reales o billboards
4. Separar el hook en estado de mesa y estado de cantos si sigue creciendo
5. Integrar MCP/browser tooling si el cliente lo soporta
