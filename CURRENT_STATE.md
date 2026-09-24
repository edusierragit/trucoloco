# Trucoloco — estado operativo

Actualizado: 25 de septiembre de 2026.

## Abrir primero

- Repositorio: `C:\Users\Tomas\Desktop\T\Trucoloco\proyecto`
- Web activa: `trucoloco-web/`
- Rama obligatoria: `Nari`
- Ejecutar: `npm.cmd run dev -- --host 127.0.0.1 --strictPort`
- URL: `http://127.0.0.1:4173/`
- No hacer commit ni push hasta que el usuario confirme el cierre de la etapa.

## Estado actual

- Portal React/Vite 2D y juego Three.js diferido.
- Esta tanda modifica `PortalApp.jsx`, `portal.css`, `ShopProduct3D.jsx` y los SVG de `public/assets/cards/fronts/`.
- Se corrigieron: logo compacto, símbolos de la portada, scroll único, lectura de textos pequeños, fuegos del anotador, flecha de regreso, conexiones y progresión del torneo, cartas numéricas/figuras compartidas entre Tienda y Reglas, presentación Gazpacho y redacción de reglas Trucoloco.
- Los modelos 3D de lentes, prendas y fichines usan materiales e iluminación más físicos; siguen siendo modelos procedurales simples, no escaneos fotorrealistas.
- `npm run build` termina correctamente. Permanece el warning conocido por chunks grandes de Three.js.

## Próxima validación

- Recorrer visualmente Tienda y Reglas en desktop y mobile.
- Probar el flujo completo del cuadro de torneo con cuatro nombres.
- Recoger comentarios del usuario y ajustar la dirección visual.

## Contexto bajo demanda

- Operación reciente: `CODEX_SESSIONS.md`.
- Canon corto: `MVP_CANON.md`.
- Canon amplio: `TRUCOLOCO_CONTEXT.md`.
- Handoff histórico completo: `HANDOFF.md`.
