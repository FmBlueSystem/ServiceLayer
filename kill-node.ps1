# Script para detener todos los procesos Node.js
# EJECUTAR COMO ADMINISTRADOR

Write-Host "Deteniendo todos los procesos Node.js..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    foreach ($process in $nodeProcesses) {
        Write-Host "  Deteniendo PID: $($process.Id)" -ForegroundColor Red
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "Procesos Node.js detenidos" -ForegroundColor Green
} else {
    Write-Host "No hay procesos Node.js corriendo" -ForegroundColor Green
}

Write-Host ""
Write-Host "Ahora puedes iniciar el servidor con: .\start-server.ps1" -ForegroundColor Cyan
