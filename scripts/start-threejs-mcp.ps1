$webRoot = Join-Path $PSScriptRoot "..\trucoloco-web"
Set-Location $webRoot

$bridgePort = 9222
$browserClaimPath = Join-Path $env:TEMP "trucoloco-threejs-mcp-browser-open.lock"
$env:DEV_PORT = "4173"
$env:BRIDGE_PORT = "$bridgePort"

function Test-LocalPortOpen {
    param([int]$Port)

    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $connect = $client.BeginConnect("127.0.0.1", $Port, $null, $null)

        if (-not $connect.AsyncWaitHandle.WaitOne(200)) {
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

function Test-BrowserLaunchClaim {
    param([string]$Path)

    try {
        if (Test-Path $Path) {
            $claim = Get-Item $Path -ErrorAction Stop
            if ($claim.LastWriteTime -lt (Get-Date).AddMinutes(-2)) {
                Remove-Item $Path -Force -ErrorAction SilentlyContinue
            }
        }

        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $writer = [System.IO.StreamWriter]::new($stream)
        $writer.WriteLine("claimed at {0:O}" -f (Get-Date))
        $writer.Dispose()
        return $true
    }
    catch {
        return $false
    }
}

$bridgeAlreadyOpen = Test-LocalPortOpen -Port $bridgePort
$canOpenBrowser = -not $bridgeAlreadyOpen -and (Test-BrowserLaunchClaim -Path $browserClaimPath)

if ($canOpenBrowser) {
    Remove-Item Env:\BROWSER -ErrorAction SilentlyContinue
}
else {
    $env:BROWSER = "none"
}

& ".\node_modules\.bin\threejs-devtools-mcp.cmd"
