# ============================================================================
# Script para instalar WSL 2 con Ubuntu en Windows
# ============================================================================
# Ejecutar como Administrador
# Autor: BlueSystem
# Fecha: 2025-10-21
# ============================================================================

# Verificar si se está ejecutando como Administrador
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pasos:" -ForegroundColor Yellow
    Write-Host "1. Clic derecho en PowerShell" -ForegroundColor White
    Write-Host "2. Seleccionar 'Ejecutar como Administrador'" -ForegroundColor White
    Write-Host "3. Ejecutar este script nuevamente" -ForegroundColor White
    Write-Host ""
    Write-Host "Presiona cualquier tecla para salir..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR DE WSL 2 CON UBUNTU" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Función para escribir mensajes con formato
function Write-Step {
    param($message)
    Write-Host "[INFO] $message" -ForegroundColor Green
}

function Write-Warning-Step {
    param($message)
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Error-Step {
    param($message)
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# Paso 1: Verificar versión de Windows
Write-Step "Verificando versión de Windows..."
$osVersion = [System.Environment]::OSVersion.Version
Write-Host "  Version: Windows $($osVersion.Major).$($osVersion.Minor) Build $($osVersion.Build)" -ForegroundColor White

if ($osVersion.Build -lt 19041) {
    Write-Error-Step "WSL 2 requiere Windows 10 version 2004 (Build 19041) o superior"
    Write-Host "  Tu versión actual: Build $($osVersion.Build)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor actualiza Windows antes de continuar." -ForegroundColor Yellow
    Write-Host "Presiona cualquier tecla para salir..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Step "Versión de Windows compatible ✓"
Write-Host ""

# Paso 2: Verificar si WSL ya está instalado
Write-Step "Verificando si WSL ya está instalado..."
$wslInstalled = $false
try {
    $wslVersion = wsl --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $wslInstalled = $true
        Write-Host "  WSL ya está instalado:" -ForegroundColor Green
        Write-Host $wslVersion
        Write-Host ""
    }
} catch {
    $wslInstalled = $false
}

if (-not $wslInstalled) {
    Write-Step "WSL no está instalado. Procediendo con la instalación..."
    Write-Host ""

    # Paso 3: Instalar WSL con Ubuntu (método moderno)
    Write-Step "Instalando WSL 2 con Ubuntu..."
    Write-Host "  Esto puede tardar varios minutos..." -ForegroundColor Yellow
    Write-Host ""

    try {
        # Método simple en Windows 10/11 moderno
        wsl --install -d Ubuntu

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Step "WSL 2 con Ubuntu instalado correctamente ✓"
            Write-Host ""
            Write-Warning-Step "IMPORTANTE: Se requiere reiniciar el sistema"
            Write-Host ""
            Write-Host "Después de reiniciar:" -ForegroundColor Cyan
            Write-Host "  1. Abre 'Ubuntu' desde el menú Inicio" -ForegroundColor White
            Write-Host "  2. Configura tu usuario y contraseña de Ubuntu" -ForegroundColor White
            Write-Host "  3. Ejecuta: sudo apt update && sudo apt upgrade -y" -ForegroundColor White
            Write-Host ""

            $restart = Read-Host "¿Deseas reiniciar ahora? (S/N)"
            if ($restart -eq "S" -or $restart -eq "s") {
                Write-Host ""
                Write-Step "Reiniciando sistema en 10 segundos..."
                Start-Sleep -Seconds 10
                Restart-Computer -Force
            } else {
                Write-Host ""
                Write-Warning-Step "Recuerda reiniciar el sistema manualmente para completar la instalación"
                Write-Host ""
            }
        } else {
            throw "Error al instalar WSL"
        }
    } catch {
        Write-Error-Step "Error en instalación automática. Intentando método manual..."
        Write-Host ""

        # Método manual (para versiones antiguas de Windows)
        Write-Step "Habilitando características de Windows necesarias..."

        # Habilitar WSL
        Write-Host "  - Habilitando WSL..." -ForegroundColor White
        dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

        # Habilitar Plataforma de Máquina Virtual
        Write-Host "  - Habilitando Plataforma de Máquina Virtual..." -ForegroundColor White
        dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

        Write-Host ""
        Write-Step "Características habilitadas ✓"
        Write-Host ""
        Write-Warning-Step "IMPORTANTE: Se requiere reiniciar el sistema"
        Write-Host ""
        Write-Host "Después de reiniciar, ejecuta estos comandos:" -ForegroundColor Cyan
        Write-Host "  1. wsl --set-default-version 2" -ForegroundColor White
        Write-Host "  2. wsl --install -d Ubuntu" -ForegroundColor White
        Write-Host ""

        $restart = Read-Host "¿Deseas reiniciar ahora? (S/N)"
        if ($restart -eq "S" -or $restart -eq "s") {
            Write-Host ""
            Write-Step "Reiniciando sistema en 10 segundos..."
            Start-Sleep -Seconds 10
            Restart-Computer -Force
        }
    }
} else {
    Write-Step "WSL ya está instalado ✓"
    Write-Host ""

    # Verificar si Ubuntu está instalado
    Write-Step "Verificando distribuciones instaladas..."
    $distros = wsl --list --verbose
    Write-Host $distros
    Write-Host ""

    if ($distros -notmatch "Ubuntu") {
        Write-Warning-Step "Ubuntu no está instalado"
        Write-Host ""
        Write-Step "Instalando Ubuntu..."
        wsl --install -d Ubuntu

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Step "Ubuntu instalado correctamente ✓"
            Write-Host ""
            Write-Host "Para configurar Ubuntu:" -ForegroundColor Cyan
            Write-Host "  1. Ejecuta: wsl" -ForegroundColor White
            Write-Host "  2. Configura tu usuario y contraseña" -ForegroundColor White
            Write-Host "  3. Ejecuta: sudo apt update && sudo apt upgrade -y" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Error-Step "Error al instalar Ubuntu"
        }
    } else {
        Write-Step "Ubuntu ya está instalado ✓"
        Write-Host ""

        # Verificar versión de WSL
        if ($distros -match "VERSION 1") {
            Write-Warning-Step "Ubuntu está usando WSL 1. Se recomienda actualizar a WSL 2"
            Write-Host ""
            $upgrade = Read-Host "¿Deseas actualizar Ubuntu a WSL 2? (S/N)"
            if ($upgrade -eq "S" -or $upgrade -eq "s") {
                Write-Step "Actualizando Ubuntu a WSL 2..."
                wsl --set-version Ubuntu 2

                if ($LASTEXITCODE -eq 0) {
                    Write-Host ""
                    Write-Step "Ubuntu actualizado a WSL 2 ✓"
                } else {
                    Write-Error-Step "Error al actualizar a WSL 2"
                }
            }
        } else {
            Write-Step "Ubuntu está usando WSL 2 ✓"
        }
    }
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  COMANDOS ÚTILES DE WSL" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  wsl                          - Iniciar Ubuntu" -ForegroundColor White
Write-Host "  wsl --list --verbose         - Listar distribuciones instaladas" -ForegroundColor White
Write-Host "  wsl --set-default Ubuntu     - Establecer Ubuntu como predeterminado" -ForegroundColor White
Write-Host "  wsl --shutdown               - Apagar todas las instancias de WSL" -ForegroundColor White
Write-Host "  wsl --terminate Ubuntu       - Apagar solo Ubuntu" -ForegroundColor White
Write-Host "  wsl --unregister Ubuntu      - Desinstalar Ubuntu (ELIMINA DATOS)" -ForegroundColor White
Write-Host ""
Write-Host "  Dentro de Ubuntu:" -ForegroundColor Yellow
Write-Host "    sudo apt update            - Actualizar lista de paquetes" -ForegroundColor White
Write-Host "    sudo apt upgrade -y        - Actualizar paquetes instalados" -ForegroundColor White
Write-Host "    cd /mnt/c/ServiceLayer     - Acceder a archivos de Windows" -ForegroundColor White
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Crear script de configuración inicial para Ubuntu
Write-Step "Creando script de configuración inicial..."

$ubuntuSetupScript = @'
#!/bin/bash
# Script de configuración inicial para Ubuntu en WSL
# Ejecutar este script la primera vez que inicies Ubuntu

echo ""
echo "============================================================================"
echo "  CONFIGURACIÓN INICIAL DE UBUNTU EN WSL"
echo "============================================================================"
echo ""

# Actualizar sistema
echo "[INFO] Actualizando sistema..."
sudo apt update
sudo apt upgrade -y

# Instalar herramientas esenciales
echo ""
echo "[INFO] Instalando herramientas esenciales..."
sudo apt install -y \
    build-essential \
    curl \
    wget \
    git \
    vim \
    nano \
    net-tools \
    ca-certificates \
    gnupg \
    lsb-release

# Instalar Node.js (versión LTS)
echo ""
echo "[INFO] Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalaciones
echo ""
echo "============================================================================"
echo "  VERSIONES INSTALADAS"
echo "============================================================================"
echo ""
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Git: $(git --version)"
echo ""

# Configurar Git
echo "[INFO] Configurando Git..."
read -p "Ingresa tu nombre para Git: " git_name
read -p "Ingresa tu email para Git: " git_email
git config --global user.name "$git_name"
git config --global user.email "$git_email"

echo ""
echo "============================================================================"
echo "  CONFIGURACIÓN COMPLETADA ✓"
echo "============================================================================"
echo ""
echo "Para acceder a tus archivos de Windows:"
echo "  cd /mnt/c/ServiceLayer"
echo ""
echo "Para actualizar Ubuntu en el futuro:"
echo "  sudo apt update && sudo apt upgrade -y"
echo ""
'@

$setupScriptPath = "C:\ServiceLayer\ubuntu-setup.sh"
$ubuntuSetupScript | Set-Content -Path $setupScriptPath -Encoding UTF8
Write-Host "  Script guardado en: $setupScriptPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Para ejecutarlo en Ubuntu:" -ForegroundColor Yellow
Write-Host "    wsl" -ForegroundColor White
Write-Host "    bash /mnt/c/ServiceLayer/ubuntu-setup.sh" -ForegroundColor White
Write-Host ""

Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
