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

## 🔧 EN CURSO (Claude, próxima sesión)

- [ ] **Cablear el sonido** — `src/game/audio/sfx.js` ya existe (synth WebAudio, cero
  assets: golpe de carta, canto, cierre de mano/partida). Falta conectarlo a los
  eventos del match + cantos TRUCO/ENVIDO como texto 3D dramático sobre la mesa.
- [ ] **Personajes vivos (procedural)** — inclinarse al jugar, festejo/lamento al
  cerrar mano, peso de pie a pie. (Los guiños faciales NO se pueden: los GLB no
  traen blendshapes — ver plan Mixamo abajo.)
- [ ] **Dorso de carta con diseño** — ponerle a las cartas el dorso "TRUCO · LA TRAICIÓN".
- [ ] **Habitación con jugadores que ENTRAN** — pedido de Edu: en la sala solo deberían
  estar los jugadores que van entrando y eligiendo personaje (clave para el modo online);
  mientras tanto, los 6 miran la mesa.

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
