$configPath = Join-Path $PSScriptRoot "..\.codex\config.toml"
$content = Get-Content $configPath -Raw -ErrorAction Stop
$updated = $content -replace '(\[mcp_servers\.threejs-devtools-mcp\]\r?\nenabled = )false', '${1}true'
Set-Content -Path $configPath -Value $updated -ErrorAction Stop
Write-Host "Three.js MCP enabled for this repo. Start a new Codex session to use it."
