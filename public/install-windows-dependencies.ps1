# =====================================================
# INSTALACIÓN DE DEPENDENCIAS PARA WINDOWS SERVER
# =====================================================
# Este script instala Node.js, PostgreSQL y configura el entorno

param(
    [string]$InstallPath = "C:\Projects\ServiceLayer"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSTALACIÓN DE DEPENDENCIAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que se ejecuta como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Ejecutando como Administrador" -ForegroundColor Green
Write-Host ""

# =====================================================
# INSTALAR CHOCOLATEY (Package Manager)
# =====================================================
Write-Host "=== Instalando Chocolatey ===" -ForegroundColor Cyan

try {
    choco --version 2>$null
    Write-Host "✓ Chocolatey ya está instalado" -ForegroundColor Green
} catch {
    Write-Host "Instalando Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "✓ Chocolatey instalado" -ForegroundColor Green
}
Write-Host ""

# =====================================================
# INSTALAR NODE.JS
# =====================================================
Write-Host "=== Instalando Node.js ===" -ForegroundColor Cyan

try {
    $nodeVersion = node --version 2>$null
    Write-Host "✓ Node.js ya está instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Instalando Node.js LTS..." -ForegroundColor Yellow
    choco install nodejs-lts -y

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    $nodeVersion = node --version
    Write-Host "✓ Node.js instalado: $nodeVersion" -ForegroundColor Green
}

try {
    $npmVersion = npm --version
    Write-Host "✓ npm instalado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ npm no encontrado" -ForegroundColor Yellow
}
Write-Host ""

# =====================================================
# INSTALAR POSTGRESQL
# =====================================================
Write-Host "=== Instalando PostgreSQL ===" -ForegroundColor Cyan

try {
    psql --version 2>$null
    Write-Host "✓ PostgreSQL ya está instalado" -ForegroundColor Green
} catch {
    Write-Host "Instalando PostgreSQL 16..." -ForegroundColor Yellow
    choco install postgresql16 --params '/Password:FmDiosMio1 /Port:5432' -y

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "✓ PostgreSQL instalado" -ForegroundColor Green
    Write-Host "  Usuario: postgres" -ForegroundColor White
    Write-Host "  Contraseña: FmDiosMio1" -ForegroundColor White
    Write-Host "  Puerto: 5432" -ForegroundColor White
}
Write-Host ""

# =====================================================
# INSTALAR GIT
# =====================================================
Write-Host "=== Instalando Git ===" -ForegroundColor Cyan

try {
    git --version 2>$null
    Write-Host "✓ Git ya está instalado" -ForegroundColor Green
} catch {
    Write-Host "Instalando Git..." -ForegroundColor Yellow
    choco install git -y

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "✓ Git instalado" -ForegroundColor Green
}
Write-Host ""

# =====================================================
# CREAR DIRECTORIO DE APLICACIÓN
# =====================================================
Write-Host "=== Creando directorio de aplicación ===" -ForegroundColor Cyan

if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "✓ Directorio creado: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "✓ Directorio ya existe: $InstallPath" -ForegroundColor Green
}
Write-Host ""

# =====================================================
# CONFIGURAR FIREWALL PARA NODE.JS
# =====================================================
Write-Host "=== Configurando Firewall ===" -ForegroundColor Cyan

$rules = @(
    @{Name="ServiceLayer-HTTP"; Port=3000; DisplayName="ServiceLayer HTTP"},
    @{Name="ServiceLayer-HTTPS"; Port=3443; DisplayName="ServiceLayer HTTPS"},
    @{Name="PostgreSQL"; Port=5432; DisplayName="PostgreSQL Database"}
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -Name $rule.Name -ErrorAction SilentlyContinue

    if ($existing) {
        Write-Host "✓ Regla de firewall ya existe: $($rule.DisplayName)" -ForegroundColor Green
    } else {
        New-NetFirewallRule -Name $rule.Name `
            -DisplayName $rule.DisplayName `
            -Direction Inbound `
            -LocalPort $rule.Port `
            -Protocol TCP `
            -Action Allow `
            -Enabled True
        Write-Host "✓ Regla de firewall creada: $($rule.DisplayName)" -ForegroundColor Green
    }
}
Write-Host ""

# =====================================================
# RESUMEN
# =====================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE INSTALACIÓN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Verificando instalaciones..." -ForegroundColor Yellow
Write-Host ""

# Node.js
try {
    $nodeVer = node --version
    Write-Host "✓ Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js: No instalado" -ForegroundColor Red
}

# npm
try {
    $npmVer = npm --version
    Write-Host "✓ npm: $npmVer" -ForegroundColor Green
} catch {
    Write-Host "❌ npm: No instalado" -ForegroundColor Red
}

# PostgreSQL
try {
    $pgVer = psql --version
    Write-Host "✓ PostgreSQL: $pgVer" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL: No instalado" -ForegroundColor Red
}

# Git
try {
    $gitVer = git --version
    Write-Host "✓ Git: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "❌ Git: No instalado" -ForegroundColor Red
}

Write-Host ""
Write-Host "📁 Directorio de instalación: $InstallPath" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ INSTALACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "1. Transferir archivos de la aplicación a: $InstallPath" -ForegroundColor White
Write-Host "2. Ejecutar: cd $InstallPath && npm install" -ForegroundColor White
Write-Host "3. Configurar archivo .env" -ForegroundColor White
Write-Host "4. Crear base de datos PostgreSQL" -ForegroundColor White
Write-Host "5. Ejecutar migraciones" -ForegroundColor White
Write-Host "6. Iniciar aplicación" -ForegroundColor White
Write-Host ""

Write-Host "Presiona ENTER para continuar..." -ForegroundColor Yellow
Read-Host
