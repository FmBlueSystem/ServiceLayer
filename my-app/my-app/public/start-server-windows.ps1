# ============================================
# INICIAR SERVIDOR NODE.JS EN WINDOWS
# ============================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SERVIDOR NODE.JS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya hay un servidor corriendo
Write-Host "Verificando si hay un servidor corriendo..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "  ⚠ Ya hay un servidor Node.js corriendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "Procesos encontrados:" -ForegroundColor White
    foreach ($process in $nodeProcesses) {
        Write-Host "  PID: $($process.Id) | CPU: $($process.CPU) | Memoria: $([math]::Round($process.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Usa 'stop-server-windows.ps1' para detener el servidor primero," -ForegroundColor Yellow
    Write-Host "o usa 'restart-server-windows.ps1' para reiniciar." -ForegroundColor Yellow
    Write-Host ""
    Exit 1
}

# Cambiar al directorio del proyecto
Write-Host "Cambiando al directorio del proyecto..." -ForegroundColor Yellow
Set-Location -Path "C:\ServiceLayer"
Write-Host "  ✓ Directorio: $(Get-Location)" -ForegroundColor Green

# Iniciar el servidor
Write-Host "Iniciando servidor..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\ServiceLayer; Write-Host 'Servidor Node.js iniciado' -ForegroundColor Green; node src/index.js" -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host "  ✓ Servidor iniciado en una nueva ventana" -ForegroundColor Green

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  ✓ SERVIDOR INICIADO" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El servidor está corriendo en:" -ForegroundColor White
Write-Host "  - HTTPS: https://10.13.0.29:3443" -ForegroundColor Cyan
Write-Host "  - HTTP:  http://10.13.0.29:3000 (redirige a HTTPS)" -ForegroundColor Cyan
Write-Host ""
