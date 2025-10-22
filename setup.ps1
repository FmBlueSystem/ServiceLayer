# ============================================
# SETUP COMPLETO DEL SERVIDOR
# ============================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACIÓN INICIAL" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
Set-Location -Path "C:\Projects\ServiceLayer"
Write-Host "Directorio de trabajo: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Instalar dependencias
Write-Host "Instalando dependencias de Node.js..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Dependencias instaladas exitosamente" -ForegroundColor Green
} else {
    Write-Host "  ✗ Error instalando dependencias" -ForegroundColor Red
    Exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  ✓ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para iniciar el servidor, ejecuta:" -ForegroundColor White
Write-Host "  .\start-server.ps1" -ForegroundColor Cyan
Write-Host "O simplemente:" -ForegroundColor White
Write-Host "  node src/index.js" -ForegroundColor Cyan
Write-Host ""
