# Trucoloco Character 3D Prompts

Usalos con un flujo `image -> 3D` en Meshy o Tripo.

## Gazpacho

Base images:
- usar la foto real del personaje con pipa como referencia principal de identidad
- preservar cara, pelo rizado, barba, anteojos oscuros y pipa

Prompt:

```text
Stylized realistic 3D game character for a premium indie tabletop duel game, full body, readable silhouette, warm nocturnal cantina mood, heroic but compact proportions, grounded shoes, subtle exaggerated head and hands for gameplay readability, curly dark hair, dark wraparound sunglasses, short dark beard, smoking pipe, gray worn t-shirt, confident star player attitude, criollo nightlife, tactile materials, production-friendly topology, clean UVs, game-ready mesh, separate accessories if possible, neutral A-pose, facing forward.

Keep the identity from the reference photo. Preserve the pipe, sunglasses, curly hair and beard. Avoid generic fantasy armor, avoid extra props, avoid cartoon toy proportions, avoid background elements, avoid dramatic action pose, avoid exaggerated muscles.
```

## Negociante

Base images:
- usar la foto real del personaje con lentes transparentes como referencia principal de identidad
- preservar cabeza rapada, barba, aro en la nariz y lentes

Prompt:

```text
Stylized realistic 3D game character for a premium indie tabletop duel game, full body, compact readable proportions for top-down camera, elegant low-key bar atmosphere, shaved head, transparent oversized glasses, trimmed beard, nose ring, black t-shirt, calm dangerous negotiator energy, criollo underground bar vibe, tactile believable fabrics, subtle stylization, game-ready topology, clean UVs, separate glasses mesh if possible, neutral A-pose, facing forward.

Keep the identity from the reference photo. Preserve the glasses shape, beard, nose ring and shaved head. Avoid suits with tie, avoid business office look, avoid cyberpunk neon nonsense, avoid hats, avoid extra objects, avoid busy base or scenery.
```

## Export notes

```text
Preferred output: GLB
Target style: stylized realistic, not chibi
Pose: A-pose or relaxed T-pose
Texture style: warm, slightly worn, readable from mid distance
Poly target: low-to-mid poly suitable for web game
Need: one combined GLB per character, centered at origin, feet on ground plane
```
