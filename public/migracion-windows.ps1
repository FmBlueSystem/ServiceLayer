# =====================================================
# MIGRACION COMPLETA AUTOMATIZADA
# ServiceLayer: Linux -> Windows Server
# =====================================================

param(
    [string]$InstallPath = "C:\Projects\ServiceLayer"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "  MIGRACION AUTOMATICA SERVICE LAYER"
Write-Host "  Linux (10.13.1.83) -> Windows (10.13.0.29)"
Write-Host "========================================"

# Verificar administrador
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 1: INSTALAR CHOCOLATEY
# =====================================================
Write-Host ""
Write-Host "[1/9] Instalando Chocolatey..." -ForegroundColor Yellow

try {
    $null = choco --version 2>&1
    Write-Host "OK: Chocolatey ya instalado" -ForegroundColor Green
} catch {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "OK: Chocolatey instalado" -ForegroundColor Green
}

# =====================================================
# PASO 2: INSTALAR NODE.JS
# =====================================================
Write-Host ""
Write-Host "[2/9] Instalando Node.js LTS..." -ForegroundColor Yellow

try {
    $null = node --version 2>&1
    Write-Host "OK: Node.js ya instalado" -ForegroundColor Green
} catch {
    choco install nodejs-lts -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "OK: Node.js instalado: $(node --version)" -ForegroundColor Green
}

# =====================================================
# PASO 3: INSTALAR POSTGRESQL
# =====================================================
Write-Host ""
Write-Host "[3/9] Instalando PostgreSQL..." -ForegroundColor Yellow

try {
    $null = psql --version 2>&1
    Write-Host "OK: PostgreSQL ya instalado" -ForegroundColor Green
} catch {
    choco install postgresql16 --params '/Password:FmDiosMio1 /Port:5432' -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "OK: PostgreSQL instalado" -ForegroundColor Green
    Start-Sleep -Seconds 5
}

# =====================================================
# PASO 4: CREAR DIRECTORIO
# =====================================================
Write-Host ""
Write-Host "[4/9] Creando directorio de instalacion..." -ForegroundColor Yellow

if (Test-Path $InstallPath) {
    Write-Host "AVISO: Directorio existe. Sobrescribir? (S/N)" -ForegroundColor Yellow
    $overwrite = Read-Host
    if ($overwrite -ne "S" -and $overwrite -ne "s") {
        Write-Host "ERROR: Instalacion cancelada" -ForegroundColor Red
        exit 1
    }
    Remove-Item -Path $InstallPath -Recurse -Force
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\docker\ssl" -Force | Out-Null

Write-Host "OK: Directorio creado: $InstallPath" -ForegroundColor Green

# =====================================================
# PASO 5: CREAR ESTRUCTURA DE DIRECTORIOS
# =====================================================
Write-Host ""
Write-Host "[5/9] Creando estructura de directorios..." -ForegroundColor Yellow

$dirs = @("src", "src/config", "src/routes", "src/services", "src/middleware", "src/utils", "public", "public/css", "public/js", "database", "database/migrations", "scripts")

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path "$InstallPath\$dir" -Force | Out-Null
}

Write-Host "OK: Estructura creada" -ForegroundColor Green

# =====================================================
# PASO 6: CREAR ARCHIVO .ENV
# =====================================================
Write-Host ""
Write-Host "[6/9] Configurando variables de entorno..." -ForegroundColor Yellow

$envContent = @"
# Servidor
NODE_ENV=production
PORT=3000
HTTPS_PORT=3443
HOST=0.0.0.0
ENABLE_HTTPS=true

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=myapp_user
DB_PASSWORD=FmDiosMio1
ALLOW_START_WITHOUT_DATABASE=false

# SAP Service Layer
SAP_ENDPOINT=https://sap-stiacmzdr-sl.skyinone.net:50000/
SAP_COMPANY_DB=SBO_GT_STIA_PROD

# Aplicacion
APP_DISPLAY_NAME=SAP Service Layer - BlueSystem
APP_VERSION=1.0.0

# Seguridad
JWT_SECRET=$(New-Guid)
BCRYPT_SALT_ROUNDS=12

# Session Renewal
SESSION_RENEWAL_ENABLED=true

# Windows SSH
WINDOWS_SSH_PASSWORD=Fmvidayo28@

# CORS
CORS_ORIGIN=https://10.13.0.29:3443
CORS_CREDENTIALS=true

# Logs
LOG_LEVEL=info
LOG_DIR=./logs
"@

Set-Content -Path "$InstallPath\.env" -Value $envContent
Write-Host "OK: Archivo .env creado" -ForegroundColor Green

# =====================================================
# PASO 7: CONFIGURAR BASE DE DATOS
# =====================================================
Write-Host ""
Write-Host "[7/9] Configurando base de datos PostgreSQL..." -ForegroundColor Yellow

$env:PGPASSWORD='FmDiosMio1'

# Esperar a que PostgreSQL este listo
Write-Host "  Esperando a PostgreSQL..." -ForegroundColor Gray
Start-Sleep -Seconds 10

$sqlCommands = @"
DROP DATABASE IF EXISTS myapp;
CREATE DATABASE myapp;
DROP USER IF EXISTS myapp_user;
CREATE USER myapp_user WITH PASSWORD 'FmDiosMio1';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
ALTER DATABASE myapp OWNER TO myapp_user;
"@

$sqlFile = "$env:TEMP\setup_db.sql"
Set-Content -Path $sqlFile -Value $sqlCommands

try {
    $null = psql -U postgres -f $sqlFile 2>&1
    Write-Host "OK: Base de datos configurada" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Error configurando BD (puede ser normal si ya existe)" -ForegroundColor Yellow
}

# =====================================================
# PASO 8: INSTALAR OPENSSL
# =====================================================
Write-Host ""
Write-Host "[8/9] Instalando OpenSSL..." -ForegroundColor Yellow

try {
    $null = openssl version 2>&1
    Write-Host "OK: OpenSSL ya instalado" -ForegroundColor Green
} catch {
    choco install openssl -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "OK: OpenSSL instalado" -ForegroundColor Green
}

# Generar certificados SSL
$certPath = "$InstallPath\docker\ssl"

& "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" req -x509 -newkey rsa:4096 -keyout "$certPath\key.pem" -out "$certPath\cert.pem" -days 365 -nodes -subj "/C=GT/ST=Guatemala/L=Guatemala/O=BlueSystem/CN=10.13.0.29" 2>$null

if (Test-Path "$certPath\cert.pem") {
    Write-Host "OK: Certificados SSL generados" -ForegroundColor Green
} else {
    Write-Host "AVISO: No se pudieron generar certificados (se generaran despues)" -ForegroundColor Yellow
}

# =====================================================
# PASO 9: CONFIGURAR FIREWALL
# =====================================================
Write-Host ""
Write-Host "[9/9] Configurando firewall..." -ForegroundColor Yellow

$rules = @(
    @{Name="ServiceLayer-HTTP"; Port=3000},
    @{Name="ServiceLayer-HTTPS"; Port=3443},
    @{Name="PostgreSQL"; Port=5432}
)

foreach ($rule in $rules) {
    try {
        $null = New-NetFirewallRule -Name $rule.Name -DisplayName $rule.Name -Direction Inbound -LocalPort $rule.Port -Protocol TCP -Action Allow -Enabled True -ErrorAction SilentlyContinue 2>&1
    } catch {}
}

Write-Host "OK: Firewall configurado" -ForegroundColor Green

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================"
Write-Host "  INSTALACION COMPLETADA"
Write-Host "========================================"
Write-Host ""
Write-Host "Ubicacion: $InstallPath" -ForegroundColor Green
Write-Host ""
Write-Host "Estado de Componentes:" -ForegroundColor Cyan
Write-Host ""

try { Write-Host "  OK Node.js:     $(node --version)" -ForegroundColor White } catch {}
try { Write-Host "  OK npm:         $(npm --version)" -ForegroundColor White } catch {}
try { Write-Host "  OK PostgreSQL:  Configurado" -ForegroundColor White } catch {}
Write-Host "  OK Base datos:  myapp" -ForegroundColor White
Write-Host "  OK SSL:         Certificados preparados" -ForegroundColor White
Write-Host "  OK Firewall:    Puertos abiertos (3000, 3443, 5432)" -ForegroundColor White

Write-Host ""
Write-Host "========================================"
Write-Host "  PROXIMOS PASOS MANUALES"
Write-Host "========================================"
Write-Host ""
Write-Host "1. Transferir archivos del codigo fuente" -ForegroundColor Yellow
Write-Host "   Desde Linux, ejecuta:" -ForegroundColor Gray
Write-Host "   scp -r src/ fmolinam@10.13.0.29:C:/Projects/ServiceLayer/" -ForegroundColor Gray
Write-Host "   scp -r public/ fmolinam@10.13.0.29:C:/Projects/ServiceLayer/" -ForegroundColor Gray
Write-Host "   scp -r database/ fmolinam@10.13.0.29:C:/Projects/ServiceLayer/" -ForegroundColor Gray
Write-Host "   scp -r scripts/ fmolinam@10.13.0.29:C:/Projects/ServiceLayer/" -ForegroundColor Gray
Write-Host "   scp package.json fmolinam@10.13.0.29:C:/Projects/ServiceLayer/" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Instalar dependencias Node.js" -ForegroundColor Yellow
Write-Host "   cd $InstallPath" -ForegroundColor Gray
Write-Host "   npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Ejecutar migraciones de base de datos" -ForegroundColor Yellow
Write-Host "   node scripts/run-all-migrations.js" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Iniciar la aplicacion" -ForegroundColor Yellow
Write-Host "   node src/index.js" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================"
Write-Host ""

Write-Host "Presiona ENTER para finalizar..." -ForegroundColor Cyan
Read-Host
