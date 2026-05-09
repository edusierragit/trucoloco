# TRUCOLOCO UNITY

## Objetivo
- Construir la version Unity del juego Trucoloco.
- Esta carpeta es el proyecto de juego.
- `../Unity-MCP` es la infraestructura MCP, no el juego.

## Direccion creativa
- Antro clandestino, humo, rojos oscuros, dorado opaco, mesa central pesada.
- Tono argentino, absurdo, competitivo y con mucho ego.
- No hacer UI generica de casino.

## Fase actual
1. Activar/licenciar Unity Editor.
2. Abrir este proyecto y dejar que resuelva paquetes.
3. Confirmar que `com.ivanmurzak.unity.mcp` carga desde ruta local.
4. Crear escena base de mesa.
5. Crear personajes, turnos y scripts del truco.

## Personajes obligatorios
- El Gazpacho
- Edu
- 4 personajes extra con roles: Negociante, J.E., Team Manager

## Notas tecnicas
- Editor esperado: `6000.0.45f1`
- Plugin MCP local: `../../Unity-MCP/Unity-MCP-Plugin/Assets/root`
- Priorizar una arquitectura simple: una escena principal, scripts de dominio separados de la presentacion.

## Bloqueo actual
- El editor no puede crear ni abrir correctamente en batchmode sin una licencia activa.
