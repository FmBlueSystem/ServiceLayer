# =====================================================
# DEPLOY TO PRODUCTION - ServiceLayer
# =====================================================
# Este script despliega cambios a producción de forma segura

param(
    [switch]$SkipBackup = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$ProjectPath = "C:\Projects\ServiceLayer"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE A PRODUCCIÓN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# PASO 1: VERIFICACIONES PRE-DESPLIEGUE
# =====================================================
Write-Host "[1/7] Verificando pre-requisitos..." -ForegroundColor Yellow

# Verificar que estamos en la rama correcta
cd $ProjectPath
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "windows") {
    Write-Host "ERROR: No estás en la rama 'windows'" -ForegroundColor Red
    Write-Host "Rama actual: $currentBranch" -ForegroundColor Yellow
    Write-Host "Ejecuta: git checkout windows" -ForegroundColor Gray
    exit 1
}
Write-Host "OK: En rama 'windows'" -ForegroundColor Green

# Verificar que no hay cambios sin commitear
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "ERROR: Hay cambios sin commitear" -ForegroundColor Red
    Write-Host "Ejecuta: git add . && git commit -m 'mensaje'" -ForegroundColor Gray
    exit 1
}
Write-Host "OK: No hay cambios pendientes" -ForegroundColor Green

# =====================================================
# PASO 2: BACKUP DE BASE DE DATOS
# =====================================================
if (-not $SkipBackup) {
    Write-Host ""
    Write-Host "[2/7] Creando backup de base de datos..." -ForegroundColor Yellow

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "$ProjectPath\backups\db_$timestamp.sql"

    # Crear directorio de backups si no existe
    New-Item -ItemType Directory -Path "$ProjectPath\backups" -Force | Out-Null

    $env:PGPASSWORD = "FmDiosMio1"
    try {
        pg_dump -U myapp_user -h localhost -d myapp -f $backupPath 2>&1 | Out-Null
        Write-Host "OK: Backup creado en $backupPath" -ForegroundColor Green
    } catch {
        Write-Host "ADVERTENCIA: No se pudo crear backup (continuando...)" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[2/7] Saltando backup (--SkipBackup)" -ForegroundColor Gray
}

# =====================================================
# PASO 3: BACKUP DEL CÓDIGO ACTUAL
# =====================================================
Write-Host ""
Write-Host "[3/7] Guardando hash del commit actual..." -ForegroundColor Yellow

$currentCommit = git rev-parse HEAD
Write-Host "Commit actual: $currentCommit" -ForegroundColor Gray
Set-Content -Path "$ProjectPath\.last-deploy" -Value $currentCommit
Write-Host "OK: Hash guardado para rollback" -ForegroundColor Green

# =====================================================
# PASO 4: ACTUALIZAR CÓDIGO
# =====================================================
Write-Host ""
Write-Host "[4/7] Actualizando código desde Git..." -ForegroundColor Yellow

try {
    git pull origin windows
    Write-Host "OK: Código actualizado" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo actualizar el código" -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 5: INSTALAR DEPENDENCIAS
# =====================================================
Write-Host ""
Write-Host "[5/7] Verificando dependencias..." -ForegroundColor Yellow

# Verificar si package.json cambió
$packageChanged = git diff HEAD@{1} HEAD --name-only | Select-String "package.json"
if ($packageChanged) {
    Write-Host "package.json cambió, instalando dependencias..." -ForegroundColor Gray
    npm install
    Write-Host "OK: Dependencias actualizadas" -ForegroundColor Green
} else {
    Write-Host "OK: No hay cambios en dependencias" -ForegroundColor Green
}

# =====================================================
# PASO 6: REINICIAR SERVIDOR
# =====================================================
Write-Host ""
Write-Host "[6/7] Reiniciando servidor..." -ForegroundColor Yellow

# Detener procesos Node.js
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "Procesos Node.js detenidos: $($nodeProcesses.Count)" -ForegroundColor Gray
}

# Esperar a que los procesos terminen
Start-Sleep -Seconds 3

# Iniciar servidor en nueva ventana
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $ProjectPath; node src/index.js" -WindowStyle Normal
Write-Host "OK: Servidor iniciado" -ForegroundColor Green

# =====================================================
# PASO 7: VERIFICACIÓN POST-DESPLIEGUE
# =====================================================
Write-Host ""
Write-Host "[7/7] Verificando que el servidor esté funcionando..." -ForegroundColor Yellow

Start-Sleep -Seconds 5

$maxAttempts = 6
$attempt = 0
$serverOk = $false

while ($attempt -lt $maxAttempts -and -not $serverOk) {
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "https://10.13.0.29:3443/health" -SkipCertificateCheck -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serverOk = $true
            Write-Host "OK: Servidor respondiendo correctamente" -ForegroundColor Green
        }
    } catch {
        Write-Host "Intento $attempt/$maxAttempts - Esperando..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
}

if (-not $serverOk) {
    Write-Host ""
    Write-Host "ADVERTENCIA: El servidor no responde" -ForegroundColor Red
    Write-Host "Revisa los logs manualmente" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para hacer rollback, ejecuta:" -ForegroundColor Yellow
    Write-Host "  .\scripts\rollback.ps1" -ForegroundColor Gray
    exit 1
}

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Versión desplegada:" -ForegroundColor White
Write-Host "  Commit: $(git log -1 --format='%h - %s')" -ForegroundColor Gray
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  HTTPS: https://10.13.0.29:3443" -ForegroundColor Cyan
Write-Host "  HTTP:  http://10.13.0.29:3000 (redirige a HTTPS)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitoreo recomendado:" -ForegroundColor Yellow
Write-Host "  - Verificar login de usuarios" -ForegroundColor Gray
Write-Host "  - Probar funcionalidades críticas" -ForegroundColor Gray
Write-Host "  - Revisar logs: .\logs\app.log" -ForegroundColor Gray
Write-Host ""
Write-Host "Si hay problemas, ejecuta:" -ForegroundColor Yellow
Write-Host "  .\scripts\rollback.ps1" -ForegroundColor Gray
Write-Host ""
