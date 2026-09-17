[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerBinary = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe' }
if (-not (Test-Path -LiteralPath $dockerBinary)) { throw 'Installer Docker Desktop puis démarrer son moteur Linux.' }
$env:PATH = (Split-Path -Parent $dockerBinary) + [IO.Path]::PathSeparator + $env:PATH
function Invoke-Docker {
    & $dockerBinary @args
    if ($LASTEXITCODE -ne 0) { throw "Docker a échoué (code $LASTEXITCODE). Les données et volumes sont conservés." }
}
Push-Location $PSScriptRoot
try {
    Invoke-Docker info --format '{{.OSType}}'
    $engine = & $dockerBinary info --format '{{.OSType}}'
    if ($engine -ne 'linux') { throw 'Activer les conteneurs Linux dans Docker Desktop.' }
    Invoke-Docker compose version
    if ($CheckOnly) { Write-Host 'Prérequis Docker disponibles.'; return }
    if (-not (Test-Path -LiteralPath '.env')) {
        Invoke-Docker run --rm --mount "type=bind,source=$PSScriptRoot,target=/workspace" --workdir /workspace node:24-bookworm-slim node scripts/init-env.mjs
    }
    Invoke-Docker compose config --quiet
    Invoke-Docker compose up -d --build --wait --wait-timeout 300
    Write-Host 'AlarMap disponible sur http://localhost:8080/'
    Write-Host 'Premier administrateur : suivre docs/MULTI_UTILISATEURS.md.'
} finally { Pop-Location }
