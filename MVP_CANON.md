# Trucoloco MVP Canon

## Objetivo

Cerrar un slice jugable, entendible y estable antes de volver a meter caos pesado.

## Formato del MVP

- `3 vs 3`
- `6 jugadores` fijos
- `1 rol activo` por vez en la interfaz
- Las otras posiciones de la mesa juegan automatizadas para sostener el orden real de ronda
- La mano rota por los 6 asientos fijos; el repartidor es el asiento anterior en el orden de ronda
- `1 mano = hasta 3 vueltas`
- `1 partida = primero a 30`

## Roles

### Negociante

- Equipo A: `Irvyn`
- Equipo B: `Marvyn`
- Poder: `Negociar puntos`
- Regla MVP:
  - Solo al abrir la mano
  - Los dos negociantes tiran dados
  - Si la suma da `8 o mas`, la mano cobra invertida

### Jugador Estrella

- Equipo A: `Gazpacho`
- Equipo B: `Myke Keta`
- Poder: `pasivo`
- Regla MVP:
  - No usa armas
  - Tiene mejor chance de cartas pesadas y bonus de estrella

### Cartachin

- Equipo A: `Cartachin Sur`
- Equipo B: `Cartachin Norte`
- Poder: `Mazo de armas`
- Regla MVP:
  - Solo Cartachin puede usar armas
  - Las armas se cargan al abrir la mano

## Golden Path

1. Elegir rol
2. Abrir mano
3. Si aplica, activar poder del rol
4. Bajar carta
5. Resolver vuelta
6. Repetir hasta cerrar la mano
7. Cobrar puntos
8. Pasar a la siguiente mano

## Qué entra en este MVP

- Roles claros
- Mazo tradicional de truco argentino de `40 cartas`
- 3 vueltas reales
- Puntos
- Negociar puntos
- Armas de Cartachin
- Modificador de mano simple
- Mesa 3D como ambientacion
- UI 2D para leer y accionar

## Qué no entra todavia

- El reglamento completo del PDF
- Todos los cantos avanzados
- Todas las cartas del mazo Trucoloco
- Todos los personajes modelados
- Todos los FX locos
- Multijugador

## Regla de diseño

Si el jugador no entiende estas tres cosas, la iteracion falla:

- quien es
- que puede hacer ahora
- que paso en la vuelta
