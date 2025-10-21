# =====================================================
# SCRIPT DE TRANSFERENCIA DE CODIGO FUENTE
# Descarga y descomprime todo el codigo desde Linux
# =====================================================

param(
    [string]$LinuxServer = "10.13.1.83",
    [int]$LinuxPort = 3443,
    [string]$InstallPath = "C:\ServiceLayer"
)

Write-Host "========================================"
Write-Host "  TRANSFERENCIA DE CODIGO FUENTE"
Write-Host "========================================"
Write-Host ""

# Configurar SSL
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# =====================================================
# PASO 1: DESCARGAR ARCHIVO COMPRIMIDO
# =====================================================
Write-Host "[1/4] Descargando codigo fuente (200 KB)..." -ForegroundColor Yellow

$url = "https://$LinuxServer:$LinuxPort/servicelayer-code.tar.gz"
$outputFile = "$env:TEMP\servicelayer-code.tar.gz"

try {
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($url, $outputFile)

    $fileSize = (Get-Item $outputFile).Length / 1KB
    Write-Host "OK: Archivo descargado ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo descargar el archivo" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 2: VERIFICAR TAR EN WINDOWS
# =====================================================
Write-Host ""
Write-Host "[2/4] Verificando herramienta de descompresion..." -ForegroundColor Yellow

$tarExists = Get-Command tar -ErrorAction SilentlyContinue

if ($tarExists) {
    Write-Host "OK: tar.exe disponible (Windows 10+)" -ForegroundColor Green
} else {
    Write-Host "ERROR: tar.exe no disponible" -ForegroundColor Red
    Write-Host "  Necesitas Windows 10 build 17063+ o instalar 7-Zip" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# PASO 3: DESCOMPRIMIR ARCHIVOS
# =====================================================
Write-Host ""
Write-Host "[3/4] Descomprimiendo archivos en $InstallPath..." -ForegroundColor Yellow

try {
    # Cambiar al directorio de instalacion
    Set-Location $InstallPath

    # Extraer archivos
    tar -xzf $outputFile

    Write-Host "OK: Archivos descomprimidos" -ForegroundColor Green

    # Limpiar archivo temporal
    Remove-Item $outputFile -Force

} catch {
    Write-Host "ERROR: Fallo la descompresion" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# =====================================================
# PASO 4: VERIFICAR ESTRUCTURA
# =====================================================
Write-Host ""
Write-Host "[4/4] Verificando estructura de archivos..." -ForegroundColor Yellow

$directories = @("src", "public", "database", "scripts")
$allOk = $true

foreach ($dir in $directories) {
    $path = Join-Path $InstallPath $dir
    if (Test-Path $path) {
        $fileCount = (Get-ChildItem $path -Recurse -File).Count
        Write-Host "  OK $dir ($fileCount archivos)" -ForegroundColor Gray
    } else {
        Write-Host "  ERROR: Directorio $dir no encontrado" -ForegroundColor Red
        $allOk = $false
    }
}

if (-not $allOk) {
    Write-Host ""
    Write-Host "ERROR: Estructura de archivos incompleta" -ForegroundColor Red
    exit 1
}

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================"
Write-Host "  TRANSFERENCIA COMPLETADA"
Write-Host "========================================"
Write-Host ""

Write-Host "Archivos instalados en: $InstallPath" -ForegroundColor Green
Write-Host ""

# Listar archivos principales
Write-Host "Archivos principales:" -ForegroundColor Cyan
if (Test-Path "$InstallPath\src\index.js") {
    Write-Host "  OK src/index.js" -ForegroundColor White
}
if (Test-Path "$InstallPath\package.json") {
    Write-Host "  OK package.json" -ForegroundColor White
}
if (Test-Path "$InstallPath\.env") {
    Write-Host "  OK .env" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================"
Write-Host "  PROXIMOS PASOS"
Write-Host "========================================"
Write-Host ""
Write-Host "1. Instalar dependencias:" -ForegroundColor Yellow
Write-Host "   cd $InstallPath" -ForegroundColor Gray
Write-Host "   npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Configurar PostgreSQL (cuando termine de instalar)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Ejecutar migraciones:" -ForegroundColor Yellow
Write-Host "   node scripts/run-all-migrations.js" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Iniciar aplicacion:" -ForegroundColor Yellow
Write-Host "   node src/index.js" -ForegroundColor Gray
Write-Host ""

Write-Host "Presiona ENTER para continuar..." -ForegroundColor Cyan
Read-Host
