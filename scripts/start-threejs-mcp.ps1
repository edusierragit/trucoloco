$webRoot = Join-Path $PSScriptRoot "..\trucoloco-web"
Set-Location $webRoot
$env:DEV_PORT = "4173"
$env:BROWSER = "none"
& ".\node_modules\.bin\threejs-devtools-mcp.cmd"
