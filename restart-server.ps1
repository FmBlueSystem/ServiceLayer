# Reinicio Rapido del Servidor
# ServiceLayer - STIA Multi-Regional

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  REINICIO RAPIDO DEL SERVIDOR" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Detener procesos Node.js en puerto 3443
Write-Host "[1/3] Deteniendo servidor..." -ForegroundColor Yellow

$port = 3443
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess | Where-Object { $_ -gt 4 } | Sort-Object -Unique

    if ($processIds) {
        Write-Host "  - Procesos encontrados: $processIds" -ForegroundColor Gray

        foreach ($pid in $processIds) {
            Write-Host "  - Deteniendo proceso PID: $pid" -ForegroundColor Gray
            taskkill /F /PID $pid 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    OK Proceso $pid detenido" -ForegroundColor Green
            } else {
                Write-Host "    ERROR al detener proceso $pid" -ForegroundColor Yellow
            }
        }

        Write-Host "  - Esperando 3 segundos..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
    } else {
        Write-Host "  - Solo procesos del sistema en puerto $port" -ForegroundColor Gray
    }
} else {
    Write-Host "  - No hay procesos corriendo en puerto $port" -ForegroundColor Gray
}

# Paso 2: Verificar que el puerto este libre
Write-Host ""
Write-Host "[2/3] Verificando puerto 3443..." -ForegroundColor Yellow

$maxAttempts = 5
$attempt = 0
$portFree = $false

while ($attempt -lt $maxAttempts -and -not $portFree) {
    $attempt++
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

    if (-not $connection) {
        Write-Host "  - Puerto 3443 esta libre" -ForegroundColor Green
        $portFree = $true
    } else {
        Write-Host "  - Puerto aun ocupado, esperando... (intento $attempt/$maxAttempts)" -ForegroundColor Gray
        Start-Sleep -Seconds 1
    }
}

if (-not $portFree) {
    Write-Host ""
    Write-Host "ERROR: El puerto 3443 sigue ocupado" -ForegroundColor Red
    Write-Host "Ejecuta este script como Administrador" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Paso 3: Iniciar servidor
Write-Host ""
Write-Host "[3/3] Iniciando servidor..." -ForegroundColor Yellow

Set-Location -Path "C:\Projects\ServiceLayer"

if (-not (Test-Path "package.json")) {
    Write-Host ""
    Write-Host "ERROR: No se encuentra package.json" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "  - Ejecutando: npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SERVIDOR INICIANDO..." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

npm start
