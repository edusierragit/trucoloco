$configPath = Join-Path $PSScriptRoot "..\.codex\config.toml"
$content = Get-Content $configPath -Raw -ErrorAction Stop
$updated = $content -replace '(\[mcp_servers\.ai-game-developer\]\r?\nenabled = )false', '${1}true'
Set-Content -Path $configPath -Value $updated -ErrorAction Stop
Write-Host "Unity MCP enabled for this repo."
