# MCP Setup

## Estado actual

- El MCP de Unity ya no esta en la configuracion global de Codex.
- En este repo queda configurado pero apagado por defecto en `.codex/config.toml`.
- El MCP de Three.js queda configurado solo para este repo, pero apagado por defecto para que Codex no abra ventanas de navegador al iniciar sesiones.

## Cuando quieras usar Unity MCP otra vez

1. Abri PowerShell en este repo.
2. Ejecuta:

```powershell
.\scripts\enable-unity-mcp.ps1
```

3. Abri Unity con `TrucolocoUnity`.
4. Inicia una sesion nueva de Codex desde la raiz del repo.

## Cuando termines

```powershell
.\scripts\disable-unity-mcp.ps1
```

Asi evitas que Codex intente levantar tooling de Unity cuando estes trabajando en otros proyectos.

## Three.js MCP en este repo

- Usa `threejs-devtools-mcp` instalado localmente en `trucoloco-web`.
- Se arranca repo-local desde `.codex/config.toml`.
- Esta apagado por defecto. Prendelo solo cuando necesites inspeccionar la escena Three.js desde Codex.
- El wrapper esta en:

```powershell
.\scripts\start-threejs-mcp.ps1
```

- El proyecto web corre en `http://127.0.0.1:4173`.
- El MCP expone un proxy/browser bridge en `http://localhost:9222`.
- El wrapper define `BROWSER=none`, asi que no abre pestañas automaticamente.

### Flujo correcto

1. En la raiz del repo, habilita el MCP de Three.js:

```powershell
.\scripts\enable-threejs-mcp.ps1
```

2. En `trucoloco-web`, corre:

```powershell
npm run dev:mcp
```

3. Abri una sesion nueva de Codex desde la raiz del repo.
4. Abri manualmente `http://localhost:9222` una sola vez y mantenelo abierto mientras uses las herramientas Three.js.

Cuando termines de inspeccionar Three.js:

```powershell
.\scripts\disable-threejs-mcp.ps1
```
