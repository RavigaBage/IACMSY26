param([switch]$SkipServerCheck)

$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:ProgramData "IACMSY26\Agent"
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js was not found on PATH." }
$configPath = Join-Path $installDir "config.json"
if (-not (Test-Path $configPath)) { $installDir = $PSScriptRoot; $configPath = Join-Path $installDir "config.json" }
if (-not (Test-Path $configPath)) { throw "Agent config was not found. Run Install-Agent.ps1 first." }

Push-Location $installDir
try {
    Write-Host "Checking local agent and command allowlist..."
    & $node.Source index.js --test
    if ($LASTEXITCODE -ne 0) { throw "Agent local self-check failed." }
    if (-not $SkipServerCheck) {
        Write-Host "Checking server reachability and Socket.IO authentication..."
        & $node.Source index.js --check-connection
        if ($LASTEXITCODE -ne 0) { throw "Server connection check failed. Review serverUrl and AGENT_TOKEN in $configPath." }
    }
    Write-Host "Agent checks passed."
} finally { Pop-Location }
