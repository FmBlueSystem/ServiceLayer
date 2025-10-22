# =====================================================
# BACKUP DIARIO AUTOMÁTICO
# =====================================================
# Este script debe programarse en Task Scheduler

$ErrorActionPreference = "Stop"
$ProjectPath = "C:\Projects\ServiceLayer"
$BackupPath = "C:\Backups\ServiceLayer"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$date = Get-Date -Format "yyyy-MM-dd"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKUP AUTOMÁTICO - $date" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Crear directorio de backups si no existe
New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupPath\database" -Force | Out-Null
New-Item -ItemType Directory -Path "$BackupPath\code" -Force | Out-Null

# =====================================================
# 1. BACKUP DE BASE DE DATOS
# =====================================================
Write-Host "[1/3] Backup de base de datos..." -ForegroundColor Yellow

$dbBackupFile = "$BackupPath\database\db_$timestamp.sql"
$env:PGPASSWORD = "FmDiosMio1"

try {
    pg_dump -U myapp_user -h localhost -d myapp -f $dbBackupFile
    $dbSize = [math]::Round((Get-Item $dbBackupFile).Length / 1MB, 2)
    Write-Host "OK: Backup DB creado ($dbSize MB)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo crear backup de DB" -ForegroundColor Red
}

# =====================================================
# 2. BACKUP DEL CÓDIGO
# =====================================================
Write-Host ""
Write-Host "[2/3] Backup del código fuente..." -ForegroundColor Yellow

cd $ProjectPath
$currentCommit = git rev-parse HEAD
$codeBackupFile = "$BackupPath\code\code_$timestamp.zip"

try {
    Compress-Archive -Path "$ProjectPath\*" -DestinationPath $codeBackupFile -Force
    $codeSize = [math]::Round((Get-Item $codeBackupFile).Length / 1MB, 2)
    Write-Host "OK: Backup código creado ($codeSize MB)" -ForegroundColor Green

    # Guardar info del commit
    $commitInfo = @"
Commit: $currentCommit
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Message: $(git log -1 --format='%s')
"@
    Set-Content -Path "$BackupPath\code\code_$timestamp.txt" -Value $commitInfo
} catch {
    Write-Host "ERROR: No se pudo crear backup de código" -ForegroundColor Red
}

# =====================================================
# 3. LIMPIAR BACKUPS ANTIGUOS (>30 días)
# =====================================================
Write-Host ""
Write-Host "[3/3] Limpiando backups antiguos..." -ForegroundColor Yellow

$daysToKeep = 30
$cutoffDate = (Get-Date).AddDays(-$daysToKeep)

$oldBackups = Get-ChildItem -Path $BackupPath -Recurse -File | Where-Object { $_.LastWriteTime -lt $cutoffDate }
$deletedCount = 0

foreach ($file in $oldBackups) {
    Remove-Item $file.FullName -Force
    $deletedCount++
}

Write-Host "OK: $deletedCount backups antiguos eliminados" -ForegroundColor Green

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKUP COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ubicación: $BackupPath" -ForegroundColor White
Write-Host "Fecha: $timestamp" -ForegroundColor White
Write-Host ""

# Log del backup
$logFile = "$BackupPath\backup.log"
$logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Backup completado - DB: $dbSize MB, Code: $codeSize MB"
Add-Content -Path $logFile -Value $logEntry
