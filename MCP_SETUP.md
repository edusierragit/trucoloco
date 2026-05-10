# MCP Setup

## Estado actual

- El MCP de Unity ya no esta en la configuracion global de Codex.
- En este repo queda configurado pero apagado por defecto en `.codex/config.toml`.
- El MCP de Three.js queda configurado solo para este repo y activo por defecto.
- El wrapper evita abrir multiples pestañas: si `localhost:9222` ya esta escuchando, arranca el MCP con `BROWSER=none`.
- Para restauraciones simultaneas, usa un lock temporal de 2 minutos para que solo una sesion intente abrir navegador.

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
- Esta activo por defecto para que una sesion nueva de Codex tenga herramientas Three.js disponibles.
- El wrapper esta en:

```powershell
.\scripts\start-threejs-mcp.ps1
```

- El proyecto web corre en `http://127.0.0.1:4173`.
- El MCP expone un proxy/browser bridge en `http://localhost:9222`.
- La primera sesion puede abrir `http://localhost:9222`.
- Si ya hay un bridge escuchando en `9222`, las sesiones siguientes no abren otra pestaña.

### Flujo correcto

1. En `trucoloco-web`, corre:

```powershell
npm run dev:mcp
```

Esto levanta Vite en `http://127.0.0.1:4173` y, si `9222` no esta abierto, intenta iniciar el bridge Three.js en segundo plano.

2. Si queres abrir el bridge manualmente, en otra terminal corre:

```powershell
npm run mcp:three
```

3. Abri una sesion nueva de Codex desde la raiz del repo.
4. Mantené abierta una sola pestaña de `http://localhost:9222` mientras uses las herramientas Three.js.

Nota: las tools MCP disponibles dentro de Codex se cargan al iniciar la sesion de Codex. Si una sesion ya arranco sin tools, reinicia esa sesion despues de levantar el bridge.

Si queres apagar temporalmente el MCP de Three.js:

```powershell
.\scripts\disable-threejs-mcp.ps1
```

Para volver a activarlo:

```powershell
.\scripts\enable-threejs-mcp.ps1
```
