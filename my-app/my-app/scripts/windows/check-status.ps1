# check-status.ps1
# Script para verificar el estado del sistema SAP Service Layer en Windows

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SAP SERVICE LAYER - STATUS CHECK         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Servicio Principal
Write-Host "🚀 Servicio Principal:" -ForegroundColor Yellow
$service = Get-Service "SAP-ServiceLayer" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "   Status: " -NoNewline
    if ($service.Status -eq "Running") {
        Write-Host "RUNNING" -ForegroundColor Green
    } else {
        Write-Host $service.Status -ForegroundColor Red
    }
    Write-Host "   Start Type: $($service.StartType)"
    Write-Host "   Display Name: $($service.DisplayName)"
} else {
    Write-Host "   NOT FOUND" -ForegroundColor Red
}

# PostgreSQL
Write-Host "`n💾 PostgreSQL:" -ForegroundColor Yellow
$pg = Get-Service "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pg) {
    Write-Host "   Status: " -NoNewline
    if ($pg.Status -eq "Running") {
        Write-Host "RUNNING" -ForegroundColor Green
    } else {
        Write-Host $pg.Status -ForegroundColor Red
    }
} else {
    Write-Host "   NOT FOUND" -ForegroundColor Red
}

# Redis
Write-Host "`n🔴 Redis:" -ForegroundColor Yellow
$redis = Get-Service "redis" -ErrorAction SilentlyContinue
if ($redis) {
    Write-Host "   Status: " -NoNewline
    if ($redis.Status -eq "Running") {
        Write-Host "RUNNING" -ForegroundColor Green
    } else {
        Write-Host $redis.Status -ForegroundColor Red
    }
} else {
    Write-Host "   NOT FOUND" -ForegroundColor Red
}

# Puertos
Write-Host "`n🔌 Puertos:" -ForegroundColor Yellow
$ports = @(
    @{Port=3000; Name="HTTP"},
    @{Port=3443; Name="HTTPS"},
    @{Port=5432; Name="PostgreSQL"},
    @{Port=6379; Name="Redis"}
)

foreach ($portInfo in $ports) {
    $result = Test-NetConnection -ComputerName localhost -Port $portInfo.Port -InformationLevel Quiet -WarningAction SilentlyContinue
    Write-Host "   $($portInfo.Name) ($($portInfo.Port)): " -NoNewline
    if ($result) {
        Write-Host "OPEN" -ForegroundColor Green
    } else {
        Write-Host "CLOSED" -ForegroundColor Red
    }
}

# Uso de recursos
Write-Host "`n📊 Recursos del Sistema:" -ForegroundColor Yellow
$cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 1
Write-Host "   CPU Usage: $([math]::Round($cpu.CounterSamples.CookedValue, 2))%"

$mem = Get-Counter '\Memory\Available MBytes' -SampleInterval 1 -MaxSamples 1
$totalMem = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum / 1MB
$usedMem = $totalMem - $mem.CounterSamples.CookedValue
$memPercent = [math]::Round(($usedMem / $totalMem) * 100, 2)
Write-Host "   Memory Usage: $memPercent% ($([math]::Round($usedMem, 0))MB / $([math]::Round($totalMem, 0))MB)"

# Espacio en disco
$disk = Get-PSDrive C
$diskPercent = [math]::Round((($disk.Used / ($disk.Used + $disk.Free)) * 100), 2)
Write-Host "   Disk Usage (C:): $diskPercent% ($([math]::Round($disk.Used/1GB, 2))GB / $([math]::Round(($disk.Used + $disk.Free)/1GB, 2))GB)"

# Procesos Node.js
Write-Host "`n⚙️  Procesos Node.js:" -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        $memMB = [math]::Round($proc.WorkingSet64/1MB, 2)
        Write-Host "   PID $($proc.Id): Memory = $memMB MB"
    }
} else {
    Write-Host "   No Node.js processes running" -ForegroundColor Gray
}

# Últimas líneas del log
Write-Host "`n📝 Últimas líneas del log:" -ForegroundColor Yellow
$logFile = "C:\proyecto\sap-servicelayer\logs\combined.log"
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   Log file not found: $logFile" -ForegroundColor Red
}

# Test rápido de conectividad
Write-Host "`n🌐 Test de Conectividad:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://localhost:3443/health" -UseBasicParsing -SkipCertificateCheck -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   Health endpoint: " -NoNewline
    if ($response.StatusCode -eq 200) {
        Write-Host "OK (200)" -ForegroundColor Green
    } else {
        Write-Host "Status $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Health endpoint: " -NoNewline
    Write-Host "FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n════════════════════════════════════════════`n" -ForegroundColor Cyan
