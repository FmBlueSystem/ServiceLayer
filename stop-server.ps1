# ============================================
# DETENER SERVIDOR NODE.JS EN WINDOWS
# ============================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  DETENIENDO SERVIDOR NODE.JS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Buscar y detener procesos Node.js
Write-Host "Buscando procesos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Se encontraron $($nodeProcesses.Count) proceso(s) Node.js" -ForegroundColor White
    Write-Host ""

    foreach ($process in $nodeProcesses) {
        Write-Host "  PID: $($process.Id) | CPU: $($process.CPU) | Memoria: $([math]::Round($process.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "Deteniendo procesos..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2

    Write-Host "  ✓ Todos los procesos Node.js han sido detenidos" -ForegroundColor Green
} else {
    Write-Host "  ℹ No se encontraron procesos Node.js en ejecución" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  ✓ SERVIDOR DETENIDO" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
