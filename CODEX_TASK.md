# TAREA PARA CODEX — Escenario sólido del antro

> Cómo usar: abrí Codex en `trucoloco-thegame/trucoloco-web` y decile:
> **"Leé ../CODEX_TASK.md y ejecutá la tarea."**

## Contexto obligatorio (leer ANTES de tocar código)

- `../TRUCOLOCO_CONTEXT_PACK.md` — auditoría técnica del proyecto
- `../TRUCOLOCO_TRACKLIST.md` — estado vivo: qué hizo Claude y qué NO tocar
- `../TRUCOLOCO_IMPLEMENTATION_NOTES.md` — si existe

## ⛔ NO TOCAR (rediseñado por Claude, checks verdes)

`src/game/scene/Table.jsx`, `src/game/scene/TeamsAroundTable.jsx`, la cámara
"seat"/CantoVoice de `src/game/scene/TrucolocoScene.jsx`, `src/game/ui/Hud.jsx`,
`src/game/hooks/useTrucolocoMatch.js`, `src/game/data/weapons.js`,
`src/game/audio/sfx.js`, `src/styles.css`, `src/App.jsx`.

Tu territorio es: `src/game/scene/world/BarRoom.jsx`, la geometría del cuarto
dentro de `<group name="Room_Runtime">` en `TrucolocoScene.jsx` (paredes, piso,
techo, props del bar — NO la mesa ni los asientos), y las salas laterales
(`DebateRoom` y afines).

## LA TAREA (en orden de prioridad)

1. **Casa bien cerrada**: piso sin huecos, paredes que cierren sin gaps ni
   paneles flotantes, techo o penumbra creíble arriba. Desde NINGUNA cámara
   (tecla 1 = silla, tecla 2 = caminar con WASD por todos los bordes) se debe
   ver geometría suelta, "construcción" debajo del piso, o el vacío negro
   através de una juntura.
2. **Salas laterales**: el ring/sala del conflicto y cualquier otra sala hoy se
   ven abiertas/bugueadas. Cerrales las paredes; si una sala no está terminada,
   tapiála con una puerta cerrada y un cartel gracioso ("EN OBRA — LA MUGRE FINA").
3. **Props flotantes**: hay objetos levitando (palos, estantes con botellas
   cortadas). Todo apoyado o eliminado.
4. **Sillas**: los asientos parecen pedestales/cajas negras. Rediseñálos como
   taburetes de bar bajos (los personajes están PARADOS junto a ellos — no
   intentes sentarlos, no tienen animación de sentarse todavía).
5. **Iluminación**: mantené la cálida existente (`ModifierAmbientFX`). Podés
   sumar prácticas (lamparitas, neón tenue "TRUCOLOCO") si suman al antro
   clandestino. Presupuesto de polígonos bajo. Nada de assets externos.

## Reglas duras

- Nada de física, networking, refactors grandes ni librerías nuevas.
- El truco clásico no se rompe.
- Al final TODOS estos comandos deben pasar (check:ui necesita `npm run dev`
  corriendo en el puerto 5173 en otra terminal):

```bash
npm run check:rules && npm run check:flow && npm run build && npm run check:ui
```

- Documentá lo que hiciste agregando una sección a `../TRUCOLOCO_TRACKLIST.md`
  (bloque "HECHO por Codex" con fecha) y NO edites las secciones de Claude.
