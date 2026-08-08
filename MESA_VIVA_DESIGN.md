# LA MESA VIVA — personajes sentados estilo Liar's Bar (con pastillas)

> Diseño respondiendo a Edu (2026-07-10): "¿Qué modelo y de qué manera
> animamos y mostramos a los personajes sentados? Este momento es clave:
> la gracia es pasarla bien sentado con amigos". Referencia: Liar's Bar
> (cabezas que siguen la cámara, manos con cartas, el revólver → acá
> PASTILLAS/drogas con efectos de pantalla).

## La estrategia (4 capas, en orden de valor)

### 1. Clips sentados de Mixamo (la base — NECESITA A EDU)
Mixamo tiene exactamente lo que hace falta, para el mismo rig que ya usás:
- **"Sitting Idle"** (respirar sentado, la base)
- **"Sitting Talking"** / "Sitting Disbelief" (gesticular)
- **"Sitting Clap"** o "Sitting Victory" (festejar una mano ganada)
- **"Sitting Drinking"** (¡LA de tomar la pastilla/trago!)

Proceso: mismo que hiciste con walk/run — bajar el FBX por personaje,
apilarlo en el NLA de Blender y re-exportar el GLB. El motor YA soporta
mapas de clips por skin: yo agrego los modos `sit`, `sitTalk`, `sitCheer`,
`sitDrink` al mapa y los personajes sentados cobran vida.

⚠ Regla aprendida A FUEGO: los clips exportan sin nombre (NlaTrack.00X).
Anotar el ORDEN en que se apilan en el NLA, o correr
`node scripts/dump-clips.mjs` + `node scripts/clipsheet.mjs <pj>` (los
harness ya existen) para identificar y mapear.

### 2. Cabeza que sigue (sin clips, lo hago por código)
Como Liar's Bar: buscar el bone `Head`/`mixamorig:Head` del GLB y aplicarle
lookAt SUAVIZADO hacia (a) el jugador que actúa, (b) la cámara del que
habla por voz, (c) la carta que se acaba de tirar. Se mezcla POR ARRIBA del
clip sentado (additive en el bone, después del mixer). Barato y expresivo.

### 3. Cartas en la mano (sin clips, lo hago por código)
Attach de un abanico de 3 cartas al bone de la mano (Object3D.attach) 
mientras el personaje está sentado con mano activa. El rival ve el DORSO.

### 4. Las PASTILLAS (el "revólver" del Trucoloco)
- Platito de pastillas de colores en el centro de la mesa (junto al trofeo).
- Tomar una = modo `sitDrink` + anuncio ("Gazpacho se tomó la ROJA") +
  **efecto de PANTALLA en el que la tomó**: overlay fullscreen con shader
  barato — viñeta pulsante, hue-shift, wobble, doble visión según la
  pastilla. (La base ya existe: Sustancia X tiene efectos en la escena.)
- El evento viaja por el canal `fx` que ya existe (mismo del vinilo
  compartido): todos VEN quién se drogó y su personaje queda con un aura.
- Cuándo se toma: lo define el modo de juego (castigo por perder mano /
  ruleta / voluntario para ganar puntos con la Ley L'Merk — a definir).

## Estado
- [x] Canal fx compartido (vinilo ya lo usa) — listo para pastillas
- [x] Harness de identificación de clips (dump-clips + clipsheet)
- [x] Codex (2026-08-07): mirada real sobre `Head` + `NeckTwist02` en los siete GLB, con estados mirar al jugador / al actor / a la mesa
- [x] Codex (2026-08-07): orientación de mesa corregida con el offset de frente de los GLB; silla y cuerpo ya no giran juntos para simular la mirada
- [x] Codex (2026-08-07): pose sentada procedural compartida — pelvis al asiento, piernas flexionadas, pies al piso, torso y brazos hacia el paño
- [x] Codex (2026-08-07): contacto de mesa normalizado — torso a ~0.28 del aro, pose recogida con variantes por personaje e idle corporal sutil
- [x] Codex (2026-08-07): escala física canónica y pelvis alineada por hueso; sillas desacopladas de la altura/rol y sin aro intersectando el cuerpo
- [ ] Edu: bajar clips sentados de Mixamo para reemplazar la pose estática por actuación animada (polish de capa 1, ya no bloquea la silueta sentada)
- [ ] Modos `sit*` en el motor y cartas rivales ligadas a la mano (capas 1 y 3)
- [ ] Pastillas + efectos de pantalla (capa 4)
