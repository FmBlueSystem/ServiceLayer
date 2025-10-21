# ============================================================================
# INSTALADOR SIMPLE DE WSL CON UBUNTU
# ============================================================================
# Ejecutar como Administrador
# ============================================================================

# Verificar permisos de administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host ""
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    Write-Host "Clic derecho en PowerShell > Ejecutar como Administrador" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  INSTALANDO WSL CON UBUNTU" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Instalar WSL con Ubuntu (comando simple de Windows 11/10 22H2+)
Write-Host "Instalando WSL y Ubuntu..." -ForegroundColor Green
Write-Host "Esto puede tardar 5-10 minutos..." -ForegroundColor Yellow
Write-Host ""

wsl --install -d Ubuntu

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  INSTALACIÓN COMPLETADA" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANTE: Reinicia Windows ahora" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Después del reinicio:" -ForegroundColor Cyan
    Write-Host "  1. Busca 'Ubuntu' en el menú Inicio" -ForegroundColor White
    Write-Host "  2. Crea tu usuario y contraseña de Ubuntu" -ForegroundColor White
    Write-Host "  3. Ejecuta: bash /mnt/c/ServiceLayer/setup-servicelayer-wsl.sh" -ForegroundColor White
    Write-Host ""

    $restart = Read-Host "¿Reiniciar ahora? (S/N)"
    if ($restart -eq "S" -or $restart -eq "s") {
        Write-Host "Reiniciando en 5 segundos..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        Restart-Computer -Force
    }
} else {
    Write-Host ""
    Write-Host "Error en la instalación" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica:" -ForegroundColor Yellow
    Write-Host "  - Que Windows esté actualizado" -ForegroundColor White
    Write-Host "  - Que la virtualización esté habilitada en BIOS" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
pause
