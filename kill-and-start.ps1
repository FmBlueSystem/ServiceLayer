# Script para detener Node.js zombie y reiniciar el servidor
# Este script intentara detener el proceso y reiniciar

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  LIMPIEZA Y REINICIO SERVIDOR" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Intentar detener Node.js
Write-Host "Intentando detener procesos Node.js..." -ForegroundColor Yellow

try {
    Stop-Process -Name node -Force -ErrorAction Stop
    Write-Host "  Procesos detenidos exitosamente" -ForegroundColor Green
} catch {
    Write-Host "  No se pudo detener con PowerShell normal" -ForegroundColor Red
    Write-Host "  Intentando con taskkill..." -ForegroundColor Yellow

    $result = cmd /c "taskkill /F /IM node.exe /T 2>&1"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Procesos detenidos con taskkill" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: No se pudieron detener los procesos" -ForegroundColor Red
        Write-Host "  Necesitas ejecutar este script como Administrador" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
        Write-Host "  Luego ejecuta: .\kill-and-start.ps1" -ForegroundColor Cyan
        Exit 1
    }
}

Start-Sleep -Seconds 3

# Verificar que no hay procesos Node.js
$remaining = Get-Process -Name node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "  Aun hay procesos Node.js corriendo. Ejecuta como Administrador." -ForegroundColor Red
    Exit 1
}

Write-Host ""
Write-Host "Iniciando servidor..." -ForegroundColor Yellow
Set-Location -Path "C:\Projects\ServiceLayer"

# Iniciar servidor en nueva ventana
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Projects\ServiceLayer; Write-Host 'Servidor Node.js' -ForegroundColor Green; node src/index.js" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  SERVIDOR INICIADO" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El servidor deberia estar corriendo en:" -ForegroundColor White
Write-Host "  - HTTPS: https://10.13.0.29:3443" -ForegroundColor Cyan
Write-Host "  - HTTP:  http://10.13.0.29:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Espera 10 segundos y verifica en tu navegador" -ForegroundColor Yellow
Write-Host ""
