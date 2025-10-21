# ============================================
# REINICIAR SERVIDOR NODE.JS EN WINDOWS
# ============================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  REINICIANDO SERVIDOR NODE.JS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detener procesos Node.js existentes
Write-Host "[1/4] Deteniendo procesos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "  ✓ Procesos Node.js detenidos: $($nodeProcesses.Count)" -ForegroundColor Green
} else {
    Write-Host "  ℹ No se encontraron procesos Node.js en ejecución" -ForegroundColor Gray
}

# 2. Esperar a que los procesos terminen completamente
Write-Host "[2/4] Esperando 3 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "  ✓ Listo" -ForegroundColor Green

# 3. Cambiar al directorio del proyecto
Write-Host "[3/4] Cambiando al directorio del proyecto..." -ForegroundColor Yellow
Set-Location -Path "C:\ServiceLayer"
Write-Host "  ✓ Directorio actual: $(Get-Location)" -ForegroundColor Green

# 4. Iniciar el servidor
Write-Host "[4/4] Iniciando servidor..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\ServiceLayer; node src/index.js" -WindowStyle Normal
Write-Host "  ✓ Servidor iniciado en una nueva ventana" -ForegroundColor Green

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  ✓ SERVIDOR REINICIADO" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El servidor está corriendo en:" -ForegroundColor White
Write-Host "  - HTTPS: https://10.13.0.29:3443" -ForegroundColor Cyan
Write-Host "  - HTTP:  http://10.13.0.29:3000 (redirige a HTTPS)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
