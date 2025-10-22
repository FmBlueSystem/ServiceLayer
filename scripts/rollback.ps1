# =====================================================
# ROLLBACK - ServiceLayer
# =====================================================
# Vuelve a la versión anterior del código

param(
    [string]$CommitHash = ""
)

$ErrorActionPreference = "Stop"
$ProjectPath = "C:\Projects\ServiceLayer"

Write-Host "========================================" -ForegroundColor Red
Write-Host "  ROLLBACK A VERSIÓN ANTERIOR" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

cd $ProjectPath

# Si no se especificó commit, usar el último deploy
if (-not $CommitHash) {
    if (Test-Path "$ProjectPath\.last-deploy") {
        $CommitHash = Get-Content "$ProjectPath\.last-deploy"
        Write-Host "Usando último deploy conocido: $CommitHash" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: No se encontró información del último deploy" -ForegroundColor Red
        Write-Host "Especifica un commit manualmente:" -ForegroundColor Yellow
        Write-Host "  .\scripts\rollback.ps1 -CommitHash <hash>" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Últimos 10 commits:" -ForegroundColor Yellow
        git log --oneline -10
        exit 1
    }
}

Write-Host ""
Write-Host "ADVERTENCIA: Esto revertirá el código al commit:" -ForegroundColor Yellow
Write-Host "  $CommitHash" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "¿Continuar? (S/N)"

if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "Rollback cancelado" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "[1/3] Revirtiendo código..." -ForegroundColor Yellow

try {
    git reset --hard $CommitHash
    Write-Host "OK: Código revertido" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo revertir el código" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Instalando dependencias..." -ForegroundColor Yellow
npm install
Write-Host "OK: Dependencias instaladas" -ForegroundColor Green

Write-Host ""
Write-Host "[3/3] Reiniciando servidor..." -ForegroundColor Yellow

# Detener procesos Node.js
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
}

Start-Sleep -Seconds 3

# Iniciar servidor
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $ProjectPath; node src/index.js" -WindowStyle Normal
Write-Host "OK: Servidor iniciado" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ROLLBACK COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Versión actual:" -ForegroundColor White
Write-Host "  Commit: $(git log -1 --format='%h - %s')" -ForegroundColor Gray
Write-Host ""
