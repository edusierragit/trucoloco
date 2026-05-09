# Trucoloco Web

Pivot web del proyecto para trabajar con una arquitectura mas amigable a `vibecoding`.

## Stack

- `Vite`
- `React`
- `Three.js` via `@react-three/fiber`
- `@react-three/drei`

## Objetivo de este slice

- Mesa 3D y atmosfera turbia
- HUD 2D legible
- Mano jugable minima
- Cartas del centro
- Roles `3v3` visibles
- Tono argentino y caotico

## Scripts

```bash
npm run dev
npm run dev:mcp
npm run build
```

## Verlo en vivo

```bash
npm run dev:mcp
```

Despues abri:

- `http://127.0.0.1:4173`

## MCP de Three.js

El repo ya tiene instalado `threejs-devtools-mcp` como dependencia local.

Flujo esperado:

1. correr `npm run dev:mcp`
2. abrir una sesion nueva de Codex desde la raiz del repo
3. el MCP levanta un proxy/bridge en `http://localhost:9222`
4. mantener abierta la pestaña del browser para que las tools sigan vivas
