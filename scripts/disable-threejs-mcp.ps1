$configPath = Join-Path $PSScriptRoot "..\.codex\config.toml"
$content = Get-Content $configPath -Raw -ErrorAction Stop
$updated = $content -replace '(\[mcp_servers\.threejs-devtools-mcp\]\r?\nenabled = )true', '${1}false'
Set-Content -Path $configPath -Value $updated -ErrorAction Stop
Write-Host "Three.js MCP disabled for this repo."
