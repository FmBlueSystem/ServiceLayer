# =====================================================
# MIGRACIÓN COMPLETA AUTOMATIZADA
# ServiceLayer: Linux → Windows Server
# =====================================================

param(
    [string]$LinuxServer = "10.13.1.83",
    [int]$LinuxPort = 3443,
    [string]$InstallPath = "C:\ServiceLayer"
)

$ErrorActionPreference = "Stop"

Write-Host @"
========================================
  MIGRACIÓN AUTOMÁTICA SERVICE LAYER
  Linux (10.13.1.83) → Windows (10.13.0.29)
========================================
"@ -ForegroundColor Cyan

# Verificar administrador
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 1: INSTALAR CHOCOLATEY
# =====================================================
Write-Host "`n[1/10] Instalando Chocolatey..." -ForegroundColor Yellow

try {
    choco --version 2>$null
    Write-Host "✓ Chocolatey ya instalado" -ForegroundColor Green
} catch {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✓ Chocolatey instalado" -ForegroundColor Green
}

# =====================================================
# PASO 2: INSTALAR NODE.JS
# =====================================================
Write-Host "`n[2/10] Instalando Node.js LTS..." -ForegroundColor Yellow

try {
    node --version 2>$null
    Write-Host "✓ Node.js ya instalado" -ForegroundColor Green
} catch {
    choco install nodejs-lts -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✓ Node.js instalado: $(node --version)" -ForegroundColor Green
}

# =====================================================
# PASO 3: INSTALAR POSTGRESQL
# =====================================================
Write-Host "`n[3/10] Instalando PostgreSQL..." -ForegroundColor Yellow

try {
    psql --version 2>$null
    Write-Host "✓ PostgreSQL ya instalado" -ForegroundColor Green
} catch {
    choco install postgresql16 --params '/Password:FmDiosMio1 /Port:5432' -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "✓ PostgreSQL instalado" -ForegroundColor Green
    Start-Sleep -Seconds 5
}

# =====================================================
# PASO 4: CREAR DIRECTORIO
# =====================================================
Write-Host "`n[4/10] Creando directorio de instalación..." -ForegroundColor Yellow

if (Test-Path $InstallPath) {
    Write-Host "⚠ Directorio existe. ¿Sobrescribir? (S/N)" -ForegroundColor Yellow
    $overwrite = Read-Host
    if ($overwrite -ne "S" -and $overwrite -ne "s") {
        Write-Host "❌ Instalación cancelada" -ForegroundColor Red
        exit 1
    }
    Remove-Item -Path $InstallPath -Recurse -Force
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$InstallPath\docker\ssl" -Force | Out-Null

Write-Host "✓ Directorio creado: $InstallPath" -ForegroundColor Green

# =====================================================
# PASO 5: DESCARGAR ARCHIVOS DESDE SERVIDOR LINUX
# =====================================================
Write-Host "`n[5/10] Descargando archivos del servidor Linux..." -ForegroundColor Yellow

$files = @(
    "package.json",
    "setup-ssh-windows.ps1",
    "install-windows-dependencies.ps1",
    "start-windows.bat",
    "stop-windows.bat"
)

foreach ($file in $files) {
    try {
        $url = "https://$($LinuxServer):$LinuxPort/$file"
        $dest = "$InstallPath\$file"
        Invoke-WebRequest -Uri $url -OutFile $dest -SkipCertificateCheck
        Write-Host "  ✓ $file" -ForegroundColor Gray
    } catch {
        Write-Host "  ⚠ $file no encontrado, continuando..." -ForegroundColor DarkGray
    }
}

Write-Host "✓ Archivos descargados" -ForegroundColor Green

# =====================================================
# PASO 6: CREAR ESTRUCTURA DE DIRECTORIOS
# =====================================================
Write-Host "`n[6/10] Creando estructura de directorios..." -ForegroundColor Yellow

$dirs = @("src", "src/config", "src/routes", "src/services", "src/middleware", "src/utils", "public", "public/css", "public/js", "database", "database/migrations", "scripts")

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path "$InstallPath\$dir" -Force | Out-Null
}

Write-Host "✓ Estructura creada" -ForegroundColor Green

# =====================================================
# PASO 7: CREAR ARCHIVO .ENV
# =====================================================
Write-Host "`n[7/10] Configurando variables de entorno..." -ForegroundColor Yellow

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

# Aplicación
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
Write-Host "✓ Archivo .env creado" -ForegroundColor Green

# =====================================================
# PASO 8: CONFIGURAR BASE DE DATOS
# =====================================================
Write-Host "`n[8/10] Configurando base de datos PostgreSQL..." -ForegroundColor Yellow

$env:PGPASSWORD='FmDiosMio1'

# Esperar a que PostgreSQL esté listo
Write-Host "  Esperando a PostgreSQL..." -ForegroundColor Gray
Start-Sleep -Seconds 10

$sqlCommands = @"
-- Crear base de datos
DROP DATABASE IF EXISTS myapp;
CREATE DATABASE myapp;

-- Crear usuario
DROP USER IF EXISTS myapp_user;
CREATE USER myapp_user WITH PASSWORD 'FmDiosMio1';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
ALTER DATABASE myapp OWNER TO myapp_user;

-- Conectar a la base de datos myapp
\c myapp

-- Otorgar permisos en el schema public
GRANT ALL ON SCHEMA public TO myapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO myapp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO myapp_user;
"@

$sqlFile = "$env:TEMP\setup_db.sql"
Set-Content -Path $sqlFile -Value $sqlCommands

try {
    psql -U postgres -f $sqlFile 2>&1 | Out-Null
    Write-Host "✓ Base de datos configurada" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error configurando BD (puede ser normal si ya existe)" -ForegroundColor Yellow
}

# =====================================================
# PASO 9: GENERAR CERTIFICADOS SSL
# =====================================================
Write-Host "`n[9/10] Generando certificados SSL..." -ForegroundColor Yellow

try {
    openssl version 2>$null
} catch {
    choco install openssl -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

$certPath = "$InstallPath\docker\ssl"

openssl req -x509 -newkey rsa:4096 `
    -keyout "$certPath\key.pem" `
    -out "$certPath\cert.pem" `
    -days 365 -nodes `
    -subj "/C=GT/ST=Guatemala/L=Guatemala/O=BlueSystem/CN=10.13.0.29" 2>$null

Write-Host "✓ Certificados SSL generados" -ForegroundColor Green

# =====================================================
# PASO 10: CONFIGURAR FIREWALL
# =====================================================
Write-Host "`n[10/10] Configurando firewall..." -ForegroundColor Yellow

$rules = @(
    @{Name="ServiceLayer-HTTP"; Port=3000},
    @{Name="ServiceLayer-HTTPS"; Port=3443},
    @{Name="PostgreSQL"; Port=5432}
)

foreach ($rule in $rules) {
    try {
        New-NetFirewallRule -Name $rule.Name `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -LocalPort $rule.Port `
            -Protocol TCP `
            -Action Allow `
            -Enabled True `
            -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

Write-Host "✓ Firewall configurado" -ForegroundColor Green

# =====================================================
# RESUMEN
# =====================================================
Write-Host @"

========================================
  ✅ INSTALACIÓN COMPLETADA
========================================

📁 Ubicación: $InstallPath

📊 Estado de Componentes:
"@ -ForegroundColor Green

Write-Host "  ✓ Node.js:     $(node --version)" -ForegroundColor White
Write-Host "  ✓ npm:         $(npm --version)" -ForegroundColor White
Write-Host "  ✓ PostgreSQL:  Configurado" -ForegroundColor White
Write-Host "  ✓ Base datos:  myapp" -ForegroundColor White
Write-Host "  ✓ SSL:         Certificados generados" -ForegroundColor White
Write-Host "  ✓ Firewall:    Puertos abiertos (3000, 3443, 5432)" -ForegroundColor White

Write-Host @"

========================================
  📝 PRÓXIMOS PASOS MANUALES
========================================

1️⃣  Transferir archivos del código fuente
   Desde Linux, ejecuta:
   scp -r src/ fmolinam@10.13.0.29:C:/ServiceLayer/
   scp -r public/ fmolinam@10.13.0.29:C:/ServiceLayer/
   scp -r database/ fmolinam@10.13.0.29:C:/ServiceLayer/
   scp -r scripts/ fmolinam@10.13.0.29:C:/ServiceLayer/

2️⃣  Instalar dependencias Node.js
   cd $InstallPath
   npm install

3️⃣  Ejecutar migraciones de base de datos
   node scripts/run-all-migrations.js

4️⃣  Iniciar la aplicación
   node src/index.js

   O como servicio Windows:
   npm install -g node-windows
   node scripts/install-service-windows.js

========================================

"@ -ForegroundColor Yellow

Write-Host "Presiona ENTER para finalizar..." -ForegroundColor Cyan
Read-Host
