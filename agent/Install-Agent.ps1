param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,
    [string]$DeviceId = "auto",
    [string]$DeviceName = "auto",
    [string]$Location = "Training Lab",
    [string]$Department = "Engineering Lab",
    [switch]$SimulationMode,
    [switch]$AllowUnauthenticatedDevelopment
)

$ErrorActionPreference = "Stop"
$taskName = "IACMSY26-Agent"
$installDir = Join-Path $env:ProgramData "IACMSY26\Agent"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) { throw "Run this installer in PowerShell as Administrator." }
if (-not (Test-Path (Join-Path $PSScriptRoot "index.js"))) { throw "Run this script from the extracted agent folder." }
try { $server = [Uri]$ServerUrl } catch { throw "ServerUrl must be a valid URL, for example https://rdm.example.edu or http://192.168.1.20:3000." }
if ($server.Scheme -notin @("http", "https") -or [string]::IsNullOrWhiteSpace($server.Host)) { throw "ServerUrl must use http:// or https://." }
if ($server.Host -in @("localhost", "127.0.0.1", "::1")) { throw "Use a server address reachable from the lab PCs; localhost points back to each PC." }
if ($DeviceId -ne "auto" -and $DeviceId -notmatch '^[A-Za-z0-9._-]{2,100}$') { throw "DeviceId may contain only letters, numbers, dot, underscore, and hyphen." }

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) { throw "Install Node.js 18 or later for all users, then reopen an elevated PowerShell window and retry." }
$nodeVersionText = (& $nodeCommand.Source --version).Trim().TrimStart('v')
if ([version]$nodeVersionText -lt [version]"18.0") { throw "Node.js 18 or later is required. Found $nodeVersionText." }

$agentToken = ""
if (-not $AllowUnauthenticatedDevelopment) {
    $secureToken = Read-Host "Enter the backend AGENT_TOKEN" -AsSecureString
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try { $agentToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    if ([string]::IsNullOrWhiteSpace($agentToken)) { throw "AGENT_TOKEN is required. Use -AllowUnauthenticatedDevelopment only with a development backend that has no AGENT_TOKEN." }
}

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Get-ChildItem -LiteralPath $installDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath $PSScriptRoot -Force |
    Where-Object { $_.Name -notin @("node_modules", ".device_id", ".git") } |
    Copy-Item -Destination $installDir -Recurse -Force

$configPath = Join-Path $installDir "config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.serverUrl = $server.AbsoluteUri.TrimEnd('/')
$config.deviceId = $DeviceId
$config.deviceName = $DeviceName
$config.location = $Location
$config.department = $Department
$config.simulateExecution = [bool]$SimulationMode
if ($agentToken) { $config | Add-Member -NotePropertyName authToken -NotePropertyValue $agentToken -Force }
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8
$agentToken = $null

# Restrict the shared token/config and agent files to SYSTEM and local administrators.
& icacls.exe $installDir /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not set secure permissions on $installDir." }

Push-Location $installDir
try {
    & $npmCommand.Source ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "Could not install agent dependencies (npm exit code $LASTEXITCODE). Check internet access and retry." }
} finally { Pop-Location }

$logsDir = Join-Path $installDir "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$runFile = Join-Path $installDir "run-agent.cmd"
@"
@echo off
cd /d "$installDir"
"$($nodeCommand.Source)" "$installDir\index.js" >> "$logsDir\agent.log" 2>&1
"@ | Set-Content -LiteralPath $runFile -Encoding ascii

$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\cmd.exe" -Argument "/c `"$runFile`"" -WorkingDirectory $installDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "IACMSY26 laboratory PC management agent" -Force | Out-Null

if (-not $SimulationMode) { Write-Warning "Live remote commands are enabled. Use -SimulationMode first if you want a non-disruptive installation check." }
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
$task = Get-ScheduledTask -TaskName $taskName
Write-Host "Agent installed at $installDir"
Write-Host "Scheduled task: $taskName ($($task.State))"
Write-Host "Log file: $(Join-Path $logsDir 'agent.log')"
Write-Host "Run Test-Agent.ps1 from this folder to check local setup and server authentication."
