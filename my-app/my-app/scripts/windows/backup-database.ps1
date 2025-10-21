# backup-database.ps1
# Script para backup automático de PostgreSQL en Windows

param(
    [string]$BackupDir = "C:\proyecto\backups",
    [string]$DatabaseName = "myapp",
    [string]$PostgresUser = "postgres",
    [int]$RetentionDays = 30
)

# Configuración
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$BackupDir\${DatabaseName}_backup_$timestamp.dump"
$logFile = "$BackupDir\backup_log.txt"
$pgDumpPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"

# Función para escribir log
function Write-Log {
    param([string]$Message)
    $logMessage = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

# Verificar que pg_dump existe
if (!(Test-Path $pgDumpPath)) {
    Write-Log "ERROR: pg_dump no encontrado en: $pgDumpPath"
    exit 1
}

# Crear directorio si no existe
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
    Write-Log "Directorio de backups creado: $BackupDir"
}

Write-Log "╔════════════════════════════════════════════╗"
Write-Log "║      INICIANDO BACKUP DE BASE DE DATOS    ║"
Write-Log "╚════════════════════════════════════════════╝"
Write-Log "Base de datos: $DatabaseName"
Write-Log "Archivo destino: $backupFile"

try {
    # Ejecutar backup
    Write-Log "Ejecutando pg_dump..."
    & $pgDumpPath -U $PostgresUser -F c -b -v -f $backupFile $DatabaseName 2>&1 | Out-File -Append $logFile

    if ($LASTEXITCODE -eq 0) {
        $fileSize = (Get-Item $backupFile).Length / 1MB
        Write-Log "✅ Backup completado exitosamente"
        Write-Log "   Tamaño: $([math]::Round($fileSize, 2)) MB"

        # Comprimir backup
        Write-Log "Comprimiendo backup..."
        Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip" -Force
        Remove-Item $backupFile

        $zipSize = (Get-Item "$backupFile.zip").Length / 1MB
        Write-Log "✅ Backup comprimido: $([math]::Round($zipSize, 2)) MB"

        # Eliminar backups antiguos
        Write-Log "Limpiando backups antiguos (>$RetentionDays días)..."
        $deletedCount = 0
        Get-ChildItem $BackupDir -Filter "*.zip" |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
            ForEach-Object {
                Write-Log "   Eliminando: $($_.Name)"
                Remove-Item $_.FullName
                $deletedCount++
            }

        if ($deletedCount -gt 0) {
            Write-Log "✅ $deletedCount backup(s) antiguo(s) eliminado(s)"
        } else {
            Write-Log "   No hay backups antiguos para eliminar"
        }

        # Resumen
        $totalBackups = (Get-ChildItem $BackupDir -Filter "*.zip").Count
        $totalSize = (Get-ChildItem $BackupDir -Filter "*.zip" | Measure-Object -Property Length -Sum).Sum / 1GB
        Write-Log "📊 Resumen:"
        Write-Log "   Total de backups: $totalBackups"
        Write-Log "   Espacio utilizado: $([math]::Round($totalSize, 2)) GB"
        Write-Log "╚════════════════════════════════════════════╝"
        Write-Log "✅ PROCESO COMPLETADO EXITOSAMENTE"

        # Retornar éxito
        exit 0

    } else {
        Write-Log "❌ ERROR: pg_dump falló con código $LASTEXITCODE"
        exit 1
    }

} catch {
    Write-Log "❌ ERROR CRÍTICO: $($_.Exception.Message)"
    Write-Log "   Stack Trace: $($_.Exception.StackTrace)"
    exit 1
}
