$webRoot = Join-Path $PSScriptRoot "..\trucoloco-web"
$mcpScript = Join-Path $PSScriptRoot "start-threejs-mcp.ps1"
$bridgePort = 9222

function Test-LocalPortOpen {
    param([int]$Port)

    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)

        if (-not $connect.AsyncWaitHandle.WaitOne(250)) {
            $client.Close()
            return $false
        }

        $client.EndConnect($connect)
        $client.Close()
        return $true
    }
    catch {
        return $false
    }
}

if (-not (Test-LocalPortOpen -Port $bridgePort)) {
    $pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
    $shell = if (Test-Path $pwsh) { $pwsh } else { "powershell.exe" }

    Start-Process `
        -FilePath $shell `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $mcpScript) `
        -WorkingDirectory $webRoot `
        -WindowStyle Hidden

    Start-Sleep -Seconds 2
}

Set-Location $webRoot
& npm.cmd run dev -- --host 127.0.0.1 --port 4173
