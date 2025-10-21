# =====================================================
# INSTALACION RAPIDA DE REDIS EN WINDOWS
# Script optimizado para Windows Server
# =====================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALACION REDIS PARA WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar permisos de administrador
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Ejecuta PowerShell como Administrador" -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 1: INSTALAR CHOCOLATEY (si no existe)
# =====================================================
Write-Host "[1/4] Verificando Chocolatey..." -ForegroundColor Yellow

if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "  Instalando Chocolatey..." -ForegroundColor Gray

    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

    try {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        Write-Host "OK: Chocolatey instalado" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: No se pudo instalar Chocolatey" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "OK: Chocolatey ya esta instalado" -ForegroundColor Green
}

# =====================================================
# PASO 2: INSTALAR REDIS
# =====================================================
Write-Host ""
Write-Host "[2/4] Instalando Redis..." -ForegroundColor Yellow
Write-Host "  Esto puede tomar 2-3 minutos..." -ForegroundColor Gray

try {
    choco install redis-64 -y --force

    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: Redis instalado" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Codigo de salida: $LASTEXITCODE" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Fallo la instalacion de Redis" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 3: CONFIGURAR SERVICIO REDIS
# =====================================================
Write-Host ""
Write-Host "[3/4] Configurando servicio Redis..." -ForegroundColor Yellow

# Esperar a que el servicio se registre
Start-Sleep -Seconds 3

try {
    # Buscar el servicio Redis
    $service = Get-Service -Name "Redis" -ErrorAction SilentlyContinue

    if ($service) {
        Write-Host "  Servicio encontrado: $($service.Name)" -ForegroundColor Gray

        # Asegurar que este corriendo
        if ($service.Status -ne "Running") {
            Start-Service $service.Name
            Write-Host "  Servicio iniciado" -ForegroundColor Gray
        } else {
            Write-Host "  Servicio ya esta corriendo" -ForegroundColor Gray
        }

        # Configurar auto-inicio
        Set-Service $service.Name -StartupType Automatic

        Write-Host "OK: Servicio configurado" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Servicio no encontrado, intentando iniciar manualmente..." -ForegroundColor Yellow

        # Intentar iniciar Redis manualmente
        $redisPath = "C:\Program Files\Redis\redis-server.exe"
        if (Test-Path $redisPath) {
            Start-Process -FilePath $redisPath -WindowStyle Hidden
            Write-Host "OK: Redis iniciado manualmente" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "AVISO: Error configurando servicio" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

# =====================================================
# PASO 4: CONFIGURAR FIREWALL
# =====================================================
Write-Host ""
Write-Host "[4/4] Configurando firewall..." -ForegroundColor Yellow

try {
    # Verificar si la regla ya existe
    $existingRule = Get-NetFirewallRule -DisplayName "Redis Server" -ErrorAction SilentlyContinue

    if ($existingRule) {
        Write-Host "  Regla de firewall ya existe" -ForegroundColor Gray
    } else {
        # Crear regla para Redis (puerto 6379)
        New-NetFirewallRule -DisplayName "Redis Server" `
                           -Direction Inbound `
                           -Protocol TCP `
                           -LocalPort 6379 `
                           -Action Allow `
                           -Profile Any `
                           -Enabled True | Out-Null

        Write-Host "OK: Regla de firewall creada (puerto 6379)" -ForegroundColor Green
    }
} catch {
    Write-Host "AVISO: Error configurando firewall (puede funcionar de todas formas)" -ForegroundColor Yellow
}

# =====================================================
# VERIFICACION
# =====================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Redis instalado en:" -ForegroundColor Green
Write-Host "  Ubicacion: C:\Program Files\Redis\" -ForegroundColor White
Write-Host "  Puerto: 6379 (por defecto)" -ForegroundColor White
Write-Host "  Host: localhost / 127.0.0.1" -ForegroundColor White
Write-Host ""

# Verificar que Redis funciona
Write-Host "Verificando instalacion..." -ForegroundColor Yellow

try {
    $redisCliPath = "C:\Program Files\Redis\redis-cli.exe"

    if (Test-Path $redisCliPath) {
        # Intentar hacer ping a Redis
        $pingResult = & $redisCliPath ping 2>&1

        if ($pingResult -like "*PONG*") {
            Write-Host "OK: Redis responde correctamente (PONG)" -ForegroundColor Green
        } else {
            Write-Host "AVISO: Redis instalado pero no responde aun" -ForegroundColor Yellow
            Write-Host "  Espera unos segundos y verifica con: redis-cli ping" -ForegroundColor Gray
        }
    } else {
        Write-Host "AVISO: redis-cli no encontrado en la ruta esperada" -ForegroundColor Yellow
    }
} catch {
    Write-Host "AVISO: No se pudo verificar Redis (puede funcionar de todas formas)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PROXIMOS PASOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Reiniciar la aplicacion Node.js:" -ForegroundColor Yellow
Write-Host "   cd C:\ServiceLayer" -ForegroundColor Gray
Write-Host "   node src/index.js" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verificar que Redis funciona:" -ForegroundColor Yellow
Write-Host "   redis-cli ping" -ForegroundColor Gray
Write-Host "   (deberia responder: PONG)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Ver informacion de Redis:" -ForegroundColor Yellow
Write-Host "   redis-cli info" -ForegroundColor Gray
Write-Host ""

Write-Host "Presiona ENTER para continuar..." -ForegroundColor Cyan
Read-Host
