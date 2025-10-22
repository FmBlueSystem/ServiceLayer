# =====================================================
# SETUP STAGING ENVIRONMENT
# =====================================================
# Crea un entorno de staging para pruebas

$ErrorActionPreference = "Stop"
$StagingPath = "C:\Projects\ServiceLayer-Staging"
$ProductionPath = "C:\Projects\ServiceLayer"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAR ENTORNO STAGING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# PASO 1: CLONAR REPOSITORIO
# =====================================================
Write-Host "[1/5] Clonando repositorio..." -ForegroundColor Yellow

if (Test-Path $StagingPath) {
    Write-Host "ADVERTENCIA: El directorio ya existe" -ForegroundColor Yellow
    $overwrite = Read-Host "¿Sobrescribir? (S/N)"
    if ($overwrite -eq "S" -or $overwrite -eq "s") {
        Remove-Item -Path $StagingPath -Recurse -Force
    } else {
        Write-Host "Setup cancelado" -ForegroundColor Gray
        exit 0
    }
}

cd C:\Projects
git clone $ProductionPath $StagingPath
cd $StagingPath

Write-Host "OK: Repositorio clonado" -ForegroundColor Green

# =====================================================
# PASO 2: CREAR RAMA DEVELOPMENT
# =====================================================
Write-Host ""
Write-Host "[2/5] Configurando rama development..." -ForegroundColor Yellow

git checkout -b development
Write-Host "OK: Rama 'development' creada" -ForegroundColor Green

# =====================================================
# PASO 3: CONFIGURAR .ENV PARA STAGING
# =====================================================
Write-Host ""
Write-Host "[3/5] Configurando variables de entorno..." -ForegroundColor Yellow

# Leer .env de producción
$envContent = Get-Content "$ProductionPath\.env" -Raw

# Modificar puertos
$envContent = $envContent -replace "PORT=3000", "PORT=3001"
$envContent = $envContent -replace "HTTPS_PORT=3443", "HTTPS_PORT=3444"

# Agregar indicador de staging
$envContent = $envContent + "`nNODE_ENV=staging`n"

Set-Content -Path "$StagingPath\.env" -Value $envContent
Write-Host "OK: .env configurado para staging" -ForegroundColor Green
Write-Host "   Puerto HTTP:  3001" -ForegroundColor Gray
Write-Host "   Puerto HTTPS: 3444" -ForegroundColor Gray

# =====================================================
# PASO 4: INSTALAR DEPENDENCIAS
# =====================================================
Write-Host ""
Write-Host "[4/5] Instalando dependencias..." -ForegroundColor Yellow

npm install
Write-Host "OK: Dependencias instaladas" -ForegroundColor Green

# =====================================================
# PASO 5: CONFIGURAR FIREWALL
# =====================================================
Write-Host ""
Write-Host "[5/5] Configurando firewall..." -ForegroundColor Yellow

$rules = @(
    @{Name="ServiceLayer-Staging-HTTP"; Port=3001},
    @{Name="ServiceLayer-Staging-HTTPS"; Port=3444}
)

foreach ($rule in $rules) {
    try {
        $existing = Get-NetFirewallRule -Name $rule.Name -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "Regla ya existe: $($rule.Name)" -ForegroundColor Gray
        } else {
            New-NetFirewallRule -Name $rule.Name `
                -DisplayName $rule.Name `
                -Direction Inbound `
                -LocalPort $rule.Port `
                -Protocol TCP `
                -Action Allow `
                -Enabled True | Out-Null
            Write-Host "Regla creada: $($rule.Name)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "ADVERTENCIA: No se pudo crear regla de firewall" -ForegroundColor Yellow
    }
}

Write-Host "OK: Firewall configurado" -ForegroundColor Green

# =====================================================
# CREAR SCRIPT DE INICIO PARA STAGING
# =====================================================
$startScript = @"
cd C:\Projects\ServiceLayer-Staging
node src/index.js
"@

Set-Content -Path "$StagingPath\start-staging.bat" -Value $startScript

# =====================================================
# RESUMEN
# =====================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STAGING CONFIGURADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ubicación: $StagingPath" -ForegroundColor White
Write-Host ""
Write-Host "URLs de Staging:" -ForegroundColor Cyan
Write-Host "  HTTPS: https://10.13.0.29:3444" -ForegroundColor White
Write-Host "  HTTP:  http://10.13.0.29:3001" -ForegroundColor White
Write-Host ""
Write-Host "URLs de Producción:" -ForegroundColor Cyan
Write-Host "  HTTPS: https://10.13.0.29:3443" -ForegroundColor White
Write-Host "  HTTP:  http://10.13.0.29:3000" -ForegroundColor White
Write-Host ""
Write-Host "Para iniciar staging:" -ForegroundColor Yellow
Write-Host "  cd $StagingPath" -ForegroundColor Gray
Write-Host "  .\start-staging.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "Para trabajar:" -ForegroundColor Yellow
Write-Host "  1. Hacer cambios en: $StagingPath" -ForegroundColor Gray
Write-Host "  2. Probar en: https://10.13.0.29:3444" -ForegroundColor Gray
Write-Host "  3. Si funciona, commitear:" -ForegroundColor Gray
Write-Host "       git add ." -ForegroundColor DarkGray
Write-Host "       git commit -m 'mensaje'" -ForegroundColor DarkGray
Write-Host "  4. Desplegar a producción:" -ForegroundColor Gray
Write-Host "       cd $ProductionPath" -ForegroundColor DarkGray
Write-Host "       git checkout windows" -ForegroundColor DarkGray
Write-Host "       git merge development" -ForegroundColor DarkGray
Write-Host "       .\scripts\deploy-to-production.ps1" -ForegroundColor DarkGray
Write-Host ""
