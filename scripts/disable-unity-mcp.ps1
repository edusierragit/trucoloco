$configPath = Join-Path $PSScriptRoot "..\.codex\config.toml"
$content = Get-Content $configPath -Raw -ErrorAction Stop
$updated = $content -replace '(\[mcp_servers\.ai-game-developer\]\r?\nenabled = )true', '${1}false'
Set-Content -Path $configPath -Value $updated -ErrorAction Stop
Write-Host "Unity MCP disabled for this repo."
