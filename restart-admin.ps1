# =====================================================
#  REINICIO SERVIDOR (REQUIERE ADMINISTRADOR)
#  ServiceLayer - STIA Multi-Regional
# =====================================================

# Verificar si se está ejecutando como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERROR: Este script requiere permisos de Administrador" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pasos:" -ForegroundColor Yellow
    Write-Host "  1. Haz clic derecho en PowerShell" -ForegroundColor White
    Write-Host "  2. Selecciona 'Ejecutar como Administrador'" -ForegroundColor White
    Write-Host "  3. Ejecuta de nuevo: .\restart-admin.ps1" -ForegroundColor White
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  REINICIO DEL SERVIDOR (ADMIN)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Detener todos los procesos Node.js
Write-Host "[1/3] Deteniendo procesos Node.js..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    $count = $nodeProcesses.Count
    Write-Host "  - Encontrados $count proceso(s) Node.js" -ForegroundColor Gray
    
    foreach ($proc in $nodeProcesses) {
        Write-Host "  - Deteniendo PID: $($proc.Id)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "  - Todos los procesos Node.js detenidos" -ForegroundColor Green
} else {
    Write-Host "  - No hay procesos Node.js corriendo" -ForegroundColor Gray
}

# Paso 2: Esperar y verificar puerto
Write-Host ""
Write-Host "[2/3] Esperando 3 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$connection = Get-NetTCPConnection -LocalPort 3443 -ErrorAction SilentlyContinue
if ($connection) {
    Write-Host "  - Advertencia: Puerto 3443 aun ocupado" -ForegroundColor Yellow
} else {
    Write-Host "  - Puerto 3443 libre" -ForegroundColor Green
}

# Paso 3: Iniciar servidor
Write-Host ""
Write-Host "[3/3] Iniciando servidor..." -ForegroundColor Yellow

Set-Location -Path "C:\Projects\ServiceLayer"

if (-not (Test-Path "package.json")) {
    Write-Host ""
    Write-Host "ERROR: No se encuentra package.json" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "  - Ejecutando: npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SERVIDOR INICIANDO..." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

npm start
