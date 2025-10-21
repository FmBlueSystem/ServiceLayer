# =====================================================
# INSTALACION RAPIDA DE POSTGRESQL 16
# Script optimizado para Windows Server
# =====================================================

Write-Host "========================================"
Write-Host "  INSTALACION POSTGRESQL 16"
Write-Host "========================================"
Write-Host ""

# Verificar permisos de administrador
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 1: DESCARGAR INSTALADOR
# =====================================================
Write-Host "[1/4] Descargando PostgreSQL 16..." -ForegroundColor Yellow

$installerUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
$installerPath = "$env:TEMP\postgresql-16-installer.exe"

try {
    Write-Host "  Descargando desde EnterpriseDB..." -ForegroundColor Gray

    # Configurar SSL
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($installerUrl, $installerPath)

    $fileSize = (Get-Item $installerPath).Length / 1MB
    Write-Host "OK: Descargado $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo descargar PostgreSQL" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 2: INSTALAR POSTGRESQL
# =====================================================
Write-Host ""
Write-Host "[2/4] Instalando PostgreSQL 16..." -ForegroundColor Yellow
Write-Host "  Esto puede tomar 3-5 minutos..." -ForegroundColor Gray

$installDir = "C:\Program Files\PostgreSQL\16"
$dataDir = "C:\Program Files\PostgreSQL\16\data"
$password = "FmDiosMio1"
$port = "5432"

# Parametros de instalacion silenciosa
$arguments = @(
    "--mode unattended",
    "--unattendedmodeui minimal",
    "--prefix `"$installDir`"",
    "--datadir `"$dataDir`"",
    "--superpassword `"$password`"",
    "--serverport $port",
    "--servicename postgresql-16",
    "--enable-components server,commandlinetools",
    "--disable-components pgAdmin,stackbuilder"
)

try {
    $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -eq 0) {
        Write-Host "OK: PostgreSQL instalado" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Codigo de salida: $($process.ExitCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Fallo la instalacion" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 3: CONFIGURAR SERVICIO
# =====================================================
Write-Host ""
Write-Host "[3/4] Configurando servicio..." -ForegroundColor Yellow

# Esperar a que el servicio se registre
Start-Sleep -Seconds 5

try {
    # Buscar el servicio
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($service) {
        Write-Host "  Servicio encontrado: $($service.Name)" -ForegroundColor Gray

        # Asegurar que este corriendo
        if ($service.Status -ne "Running") {
            Start-Service $service.Name
            Write-Host "  Servicio iniciado" -ForegroundColor Gray
        }

        # Configurar auto-inicio
        Set-Service $service.Name -StartupType Automatic

        Write-Host "OK: Servicio configurado" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Servicio no encontrado, pero PostgreSQL puede estar funcionando" -ForegroundColor Yellow
    }
} catch {
    Write-Host "AVISO: Error configurando servicio" -ForegroundColor Yellow
}

# =====================================================
# PASO 4: CONFIGURAR BASE DE DATOS
# =====================================================
Write-Host ""
Write-Host "[4/4] Configurando base de datos..." -ForegroundColor Yellow

# Agregar PostgreSQL al PATH
$pgBinPath = "$installDir\bin"
$env:Path += ";$pgBinPath"
$env:PGPASSWORD = $password

# Esperar a que PostgreSQL este listo
Write-Host "  Esperando a PostgreSQL..." -ForegroundColor Gray
Start-Sleep -Seconds 10

try {
    # SQL para crear base de datos
    $sqlCommands = @"
DROP DATABASE IF EXISTS myapp;
CREATE DATABASE myapp;
DROP USER IF EXISTS myapp_user;
CREATE USER myapp_user WITH PASSWORD '$password';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
ALTER DATABASE myapp OWNER TO myapp_user;
"@

    $sqlFile = "$env:TEMP\setup_db.sql"
    Set-Content -Path $sqlFile -Value $sqlCommands

    # Ejecutar SQL
    & "$pgBinPath\psql.exe" -U postgres -f $sqlFile 2>&1 | Out-Null

    Write-Host "OK: Base de datos myapp creada" -ForegroundColor Green

    # Limpiar
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
} catch {
    Write-Host "AVISO: Error configurando BD (puedes hacerlo manualmente)" -ForegroundColor Yellow
}

# Limpiar instalador
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================"
Write-Host "  INSTALACION COMPLETADA"
Write-Host "========================================"
Write-Host ""

Write-Host "PostgreSQL 16 instalado en:" -ForegroundColor Green
Write-Host "  Ubicacion: $installDir" -ForegroundColor White
Write-Host "  Puerto: $port" -ForegroundColor White
Write-Host "  Usuario: postgres" -ForegroundColor White
Write-Host "  Password: $password" -ForegroundColor White
Write-Host ""
Write-Host "Base de datos:" -ForegroundColor Green
Write-Host "  Nombre: myapp" -ForegroundColor White
Write-Host "  Usuario: myapp_user" -ForegroundColor White
Write-Host "  Password: $password" -ForegroundColor White
Write-Host ""

# Verificar que psql funciona
Write-Host "Verificando instalacion..." -ForegroundColor Yellow
try {
    $version = & "$pgBinPath\psql.exe" --version 2>&1
    Write-Host "OK: $version" -ForegroundColor Green
} catch {
    Write-Host "AVISO: No se pudo verificar (puede funcionar de todas formas)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================"
Write-Host "  PROXIMOS PASOS"
Write-Host "========================================"
Write-Host ""
Write-Host "1. Ejecutar migraciones:" -ForegroundColor Yellow
Write-Host "   cd C:\ServiceLayer" -ForegroundColor Gray
Write-Host "   node scripts/run-all-migrations.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Iniciar aplicacion:" -ForegroundColor Yellow
Write-Host "   node src/index.js" -ForegroundColor Gray
Write-Host ""

Write-Host "Presiona ENTER para continuar..." -ForegroundColor Cyan
Read-Host
