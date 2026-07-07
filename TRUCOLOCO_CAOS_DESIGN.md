# TRUCOLOCO — El Caos y el puntaje de los Negociantes

> Diseño acordado con Edu (2026-07-07). Objetivo: digitalizar el "vibe" del
> Trucoloco sin que quede una mierda. Base = truco real; el resto son
> AGREGADOS que pasan de vez en cuando, sostenidos por la lógica del truco.

## Principio rector

**Truco Común** = juego competitivo real, motor autoritativo, puntos automáticos.
Ya funciona y está testeado (truco 2 / retruco 3 / vale cuatro 4 / no quiero
1-2-3 / envido / falta envido). NO se toca esa lógica.

**TRUCOLOCO** = no es competitivo, la idea es reírse. El truco sigue siendo
el motor, pero **los puntos los llevan los Negociantes**, no la máquina. Al
final de cada mano hay un ACTO donde se decide el puntaje, anclado en lo que
el truco dictó (sugerencia), con la última palabra de los negociantes.

## 1. El puntaje lo llevan los Negociantes (ya existe la base)

- El motor ya tiene `scoreMode: "auto" | "manual"`. En manual computa
  `suggestedPoints` (lo que el truco dice) pero NO lo aplica.
- Ya existe el "ACTO DE ACUERDO DE NEGOCIANTES" (Hud): ajuste ±2 por equipo,
  el rival firma si no pierde, y `applyAgreement(deltaSelf, deltaRival)`.
- **Regla Trucoloco**: si hay un Negociante HUMANO, corre el Acto (manual).
  Si no (jugás de Cartachin/Estrella), los negociantes bot sellan lo que el
  truco dictó (auto). Así los puntos SIEMPRE pasan por los negociantes,
  aunque sean bots que sellan.
- Pendiente fino: mostrar la sugerencia del truco como ancla en el panel
  ("El truco dice: Casa +2") y que el Acto arranque desde ahí.

## 2. EL CAOS — la carta Yu-Gi-Oh del Jugador Estrella

Son 4 cartas reales (imágenes que carga Edu): Exodia, Dragón Blanco, Mago
Oscuro, Messi. Deben tocar POCO (raras). Cuando el Estrella baja una:

- **Ya hecho**: se anuncia en grande ("¡EXODIA! X rompe la mesa. Deciden los
  negociantes."), violeta, detectando `group === "bonus"` en la mesa.
- **La votación (a construir, con outcomes que confirme Edu)**: la carta NO
  gana sola. Abre una decisión que resuelven los NEGOCIANTES de ambos
  equipos. Menú corto, finito, canónico (para no simular infinitas
  vivezas):
  1. **Se respeta el truco** — pura pose, no pasa nada (default si no hay acuerdo).
  2. **Se anulan los puntos de la mano** — 0-0 esta mano.
  3. **Los puntos van al equipo del Estrella** — el carisma se cobra.
  4. **Doble o nada** — se duplican los puntos de la mano.
- Los dos negociantes eligen; si coinciden, se aplica; si no, default
  ("se respeta el truco"). Vs bots: el humano propone, el bot negociante
  rival acepta/rechaza con la misma lógica del Acto (firma si no sale
  perdiendo groso).
- Frecuencia: hoy el Estrella recibe una bonus al azar por mano. Para que
  sea RARO, bajar a ~1 de cada 4-5 manos (o atarlo a un recurso: "una vez
  por partida por Estrella").

## Estado

- [x] Truco común correcto y testeado
- [x] Respuesta al canto visible (QUIERO / NO QUIERO + puntos)
- [x] Anuncio dramático de la carta de caos
- [x] scoreMode manual + Acto de Acuerdo (base del puntaje por negociantes)
- [ ] Forzar el Acto como cierre canónico del Trucoloco (mostrar la
      sugerencia del truco como ancla)
- [ ] Votación del Caos con el menú de outcomes (definir cuáles con Edu)
- [ ] Bajar la frecuencia de las cartas bonus (que sean raras)
- [ ] Cargar las 4 imágenes reales de Yu-Gi-Oh (Edu las provee → arte-cartas/)

## Preguntas para Edu

1. ¿Los 4 outcomes de arriba te cierran, o querés otros / más locos?
2. ¿La carta de caos debe ser 1 por partida (recurso) o azar raro por mano?
3. ¿La votación la deciden AMBOS negociantes (deben coincidir) o alcanza con
   que el rival "banque" la jugada del Estrella?
