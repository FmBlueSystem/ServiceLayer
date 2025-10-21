# 🔄 Guía Completa: Migración a Windows Server

## 📋 Información del Proyecto Actual

**Estado actual:** Aplicación Node.js corriendo en Linux Ubuntu
**Componentes:**
- Node.js v22.19.0
- PostgreSQL 16.10
- Redis
- HTTPS (puerto 3443) + HTTP redirect (puerto 3000)
- Certificados SSL auto-firmados

**Directorio actual:** `/home/bluesystem/Documents/ServiceLayer/my-app/my-app`

---

## 🎯 Objetivo de Migración

Migrar la aplicación SAP Service Layer a Windows Server manteniendo:
- ✅ Toda la funcionalidad actual
- ✅ Base de datos PostgreSQL con todos los datos
- ✅ Sistema de permisos y autenticación
- ✅ Certificados SSL
- ✅ Configuración de Redis
- ✅ Servicio ejecutándose 24/7 como servicio de Windows

---

## 🛠️ FASE 1: Preparación del Servidor Windows

### 1.1 Requisitos Mínimos del Servidor

```yaml
Sistema Operativo: Windows Server 2019/2022
RAM: Mínimo 8GB (Recomendado 16GB)
Disco: 100GB libres
CPU: 4 cores
Red: IP estática
Firewall: Acceso a puertos 3000, 3443, 5432, 6379, 22 (SSH)
```

### 1.2 Software Base a Instalar

**Ejecutar PowerShell como Administrador:**

```powershell
# ==============================================
# PASO 1: Instalar Chocolatey (Gestor de paquetes)
# ==============================================
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Cerrar y reabrir PowerShell como administrador

# ==============================================
# PASO 2: Instalar dependencias principales
# ==============================================

# Node.js LTS (v20.x o superior)
choco install nodejs-lts -y

# PostgreSQL 16
choco install postgresql16 --params '/Password:TU_PASSWORD_AQUI' -y

# Redis (versión para Windows)
choco install redis-64 -y

# Git
choco install git -y

# Herramientas adicionales
choco install nano -y
choco install curl -y
choco install wget -y
choco install 7zip -y

# NSSM (para crear servicios de Windows)
choco install nssm -y

# Verificar instalaciones
node --version
npm --version
psql --version
redis-server --version
git --version
```

### 1.3 Configurar OpenSSH Server (Para acceso remoto de Claude)

```powershell
# Instalar OpenSSH Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Iniciar servicio SSH
Start-Service sshd

# Configurar inicio automático
Set-Service -Name sshd -StartupType 'Automatic'

# Configurar firewall para SSH
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22

# Verificar que está corriendo
Get-Service sshd
```

**Credenciales SSH para Claude:**
- Usuario: `[PENDIENTE]`
- Contraseña: `[PENDIENTE]`
- IP/Hostname: `[PENDIENTE]`
- Puerto: `22`

### 1.4 Configurar Firewall de Windows

```powershell
# ==============================================
# Abrir puertos necesarios para la aplicación
# ==============================================

# HTTP (puerto 3000)
New-NetFirewallRule -DisplayName "SAP ServiceLayer HTTP" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# HTTPS (puerto 3443)
New-NetFirewallRule -DisplayName "SAP ServiceLayer HTTPS" -Direction Inbound -LocalPort 3443 -Protocol TCP -Action Allow

# PostgreSQL (puerto 5432)
New-NetFirewallRule -DisplayName "PostgreSQL Database" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Allow

# Redis (puerto 6379)
New-NetFirewallRule -DisplayName "Redis Cache" -Direction Inbound -LocalPort 6379 -Protocol TCP -Action Allow

# Verificar reglas
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*SAP*" -or $_.DisplayName -like "*PostgreSQL*" -or $_.DisplayName -like "*Redis*"}
```

---

## 📦 FASE 2: Backup y Exportación desde Linux

### 2.1 Exportar Base de Datos PostgreSQL

**En el servidor Linux actual:**

```bash
# Ubicación actual
cd /home/bluesystem/Documents/ServiceLayer/my-app/my-app

# Crear directorio para backups
mkdir -p backups

# Backup completo de la base de datos
pg_dump -U postgres -d myapp -F c -b -v -f backups/myapp_backup.dump

# Backup alternativo en formato SQL
pg_dump -U postgres -d myapp > backups/myapp_backup.sql

# Backup de esquema solamente (para verificación)
pg_dump -U postgres -d myapp --schema-only > backups/myapp_schema.sql

# Verificar tamaño del backup
ls -lh backups/

# Comprimir backups
tar -czvf backups/database_backups.tar.gz backups/*.dump backups/*.sql

echo "✅ Backup de base de datos completado"
```

### 2.2 Preparar Archivos del Proyecto

```bash
# Limpiar archivos innecesarios
rm -rf node_modules/
rm -rf logs/*.log
rm -f .env.stifmolina2

# Crear archivo .env de plantilla (sin datos sensibles)
cat > .env.template << 'EOF'
# Base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=CAMBIAR_AQUI

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Session
SESSION_SECRET=GENERAR_NUEVO_SECRET_AQUI

# Encriptación para session renewal
SESSION_ENCRYPTION_KEY=GENERAR_NUEVA_KEY_AQUI

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Puerto
PORT=3000
HTTPS_PORT=3443
EOF

# Crear paquete completo del proyecto
cd ..
tar -czvf my-app-windows-migration.tar.gz \
  my-app/src/ \
  my-app/public/ \
  my-app/database/ \
  my-app/docker/ssl/ \
  my-app/scripts/ \
  my-app/package.json \
  my-app/package-lock.json \
  my-app/.env.template \
  my-app/*.md \
  my-app/*.bat

echo "✅ Proyecto empaquetado en: my-app-windows-migration.tar.gz"
```

### 2.3 Información a Exportar/Documentar

Crear archivo con información importante:

```bash
cat > migration-info.txt << EOF
INFORMACIÓN DE MIGRACIÓN
========================

Base de Datos:
- Nombre: myapp
- Usuario: postgres
- Puerto: 5432
- Tablas principales:
  * users (usuarios sincronizados desde SAP)
  * roles (grupos de permisos)
  * permissions (permisos granulares)
  * pages (páginas del sistema)
  * role_pages (asignación de páginas a roles)
  * user_roles (asignación de usuarios a roles)
  * config_audit (auditoría de cambios)
  * system_config (configuración del sistema)

Redis:
- Puerto: 6379
- Uso: Rate limiting, cache de sesiones

Certificados SSL:
- Ubicación: docker/ssl/
- server.key (clave privada)
- server.crt (certificado)
- Son auto-firmados, válidos para desarrollo/producción interna

Usuarios Administrativos:
- stifmolina2 (usuario principal con todos los permisos)

IP Actual:
- $(hostname -I | awk '{print $1}')

Fecha de Backup:
- $(date)

EOF

cat migration-info.txt
```

---

## 📤 FASE 3: Transferencia de Archivos a Windows

### Opción A: Usando WinSCP (Recomendado - GUI)

1. Descargar WinSCP: https://winscp.net/
2. Conectar al servidor Linux:
   - Host: IP del servidor Linux actual
   - Usuario: bluesystem
   - Contraseña: [tu contraseña]
3. Descargar:
   - `my-app-windows-migration.tar.gz`
   - `backups/database_backups.tar.gz`
   - `migration-info.txt`
4. Subir al servidor Windows en: `C:\proyecto\`

### Opción B: Usando SCP desde Windows

```powershell
# Si tienen SSH configurado en ambos servidores
scp bluesystem@IP_LINUX:/home/bluesystem/Documents/ServiceLayer/my-app-windows-migration.tar.gz C:\proyecto\
scp bluesystem@IP_LINUX:/home/bluesystem/Documents/ServiceLayer/backups/database_backups.tar.gz C:\proyecto\
```

### Opción C: Usando Git (Si el proyecto está en GitHub)

```powershell
# En Windows Server
cd C:\proyecto
git clone https://github.com/FmBlueSystem/ServiceLayer.git
cd ServiceLayer\my-app
```

---

## ⚙️ FASE 4: Instalación en Windows Server

### 4.1 Descomprimir y Preparar Proyecto

```powershell
# Crear directorio del proyecto
New-Item -Path "C:\proyecto\sap-servicelayer" -ItemType Directory -Force

cd C:\proyecto

# Descomprimir proyecto (si está en .tar.gz)
# Usar 7zip instalado anteriormente
7z x my-app-windows-migration.tar.gz
7z x my-app-windows-migration.tar
Move-Item -Path my-app\* -Destination C:\proyecto\sap-servicelayer\

# O si se clonó con Git, copiar archivos
cd C:\proyecto\sap-servicelayer
```

### 4.2 Configurar Variables de Entorno

```powershell
cd C:\proyecto\sap-servicelayer

# Copiar plantilla
Copy-Item .env.template .env

# Editar .env (usar Notepad o nano)
notepad .env

# IMPORTANTE: Configurar estos valores
# DB_PASSWORD=tu_password_postgresql
# SESSION_SECRET=generar_con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# SESSION_ENCRYPTION_KEY=generar_con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generar secrets seguros:**

```powershell
# En PowerShell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.3 Instalar Dependencias npm

```powershell
cd C:\proyecto\sap-servicelayer

# Instalar dependencias
npm install

# Esto instalará todos los paquetes de package.json
# Puede tomar varios minutos

# Verificar que se instaló correctamente
npm list --depth=0
```

### 4.4 Configurar PostgreSQL

```powershell
# Iniciar servicio PostgreSQL
Start-Service postgresql-x64-16

# Configurar inicio automático
Set-Service -Name postgresql-x64-16 -StartupType Automatic

# Crear base de datos
psql -U postgres
```

**Dentro de psql:**

```sql
-- Crear base de datos
CREATE DATABASE myapp;

-- Crear usuario (opcional, o usar postgres)
-- CREATE USER myapp_user WITH PASSWORD 'password_seguro';
-- GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;

-- Salir
\q
```

**Restaurar backup:**

```powershell
# Opción 1: Restaurar desde formato custom (.dump)
pg_restore -U postgres -d myapp -v C:\proyecto\backups\myapp_backup.dump

# Opción 2: Restaurar desde SQL
psql -U postgres -d myapp -f C:\proyecto\backups\myapp_backup.sql

# Verificar restauración
psql -U postgres -d myapp -c "\dt"
psql -U postgres -d myapp -c "SELECT COUNT(*) FROM users;"
```

### 4.5 Configurar Redis

```powershell
# Redis debería estar corriendo automáticamente
# Verificar
Get-Service redis

# Si no está corriendo
Start-Service redis
Set-Service -Name redis -StartupType Automatic

# Probar conexión
redis-cli ping
# Debería responder: PONG
```

### 4.6 Ajustar Rutas en Código (Si es necesario)

```powershell
# Verificar rutas en src/config/database.js y otros archivos de configuración
# Las rutas absolutas de Linux deben cambiarse a Windows
# Ejemplo: /home/user/logs -> C:\proyecto\sap-servicelayer\logs

# Los archivos deberían usar variables de entorno, por lo que no debería ser necesario
```

---

## 🧪 FASE 5: Pruebas Iniciales

### 5.1 Probar Aplicación Manualmente

```powershell
cd C:\proyecto\sap-servicelayer

# Ejecutar en modo desarrollo (para ver logs en tiempo real)
node src/index.js
```

**Verificar en los logs:**
- ✅ "Database connected successfully"
- ✅ "Redis connected successfully"
- ✅ "HTTPS server started successfully"
- ✅ Puerto 3443 (HTTPS) y 3000 (HTTP redirect)

**En otra ventana de PowerShell, probar endpoints:**

```powershell
# Probar health check
curl -k https://localhost:3443/health

# Probar login (ajustar credenciales)
curl -k -X POST https://localhost:3443/api/sap/login-all `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"stifmolina2\",\"password\":\"TU_PASSWORD\"}'
```

### 5.2 Verificar Base de Datos

```powershell
psql -U postgres -d myapp

# Verificar tablas
\dt

# Verificar usuarios
SELECT username, email, is_active FROM users LIMIT 5;

# Verificar roles
SELECT * FROM roles;

# Verificar páginas
SELECT id, name, path, display_order FROM pages ORDER BY display_order;

\q
```

### 5.3 Verificar Redis

```powershell
redis-cli

# Verificar que está funcionando
PING

# Ver keys existentes
KEYS *

# Salir
exit
```

---

## 🚀 FASE 6: Configurar como Servicio de Windows

### Opción A: Usando NSSM (Recomendado)

```powershell
# Crear el servicio
nssm install "SAP-ServiceLayer" "C:\Program Files\nodejs\node.exe"

# Configurar parámetros del servicio
nssm set "SAP-ServiceLayer" AppDirectory "C:\proyecto\sap-servicelayer"
nssm set "SAP-ServiceLayer" AppParameters "src\index.js"
nssm set "SAP-ServiceLayer" DisplayName "SAP Service Layer"
nssm set "SAP-ServiceLayer" Description "Aplicación SAP Service Layer con Node.js"
nssm set "SAP-ServiceLayer" Start SERVICE_AUTO_START

# Configurar salida de logs
nssm set "SAP-ServiceLayer" AppStdout "C:\proyecto\sap-servicelayer\logs\service-stdout.log"
nssm set "SAP-ServiceLayer" AppStderr "C:\proyecto\sap-servicelayer\logs\service-stderr.log"

# Configurar reinicio automático en caso de fallo
nssm set "SAP-ServiceLayer" AppExit Default Restart
nssm set "SAP-ServiceLayer" AppRestartDelay 5000

# Variables de entorno (si no usa .env)
nssm set "SAP-ServiceLayer" AppEnvironmentExtra NODE_ENV=production

# Iniciar el servicio
nssm start "SAP-ServiceLayer"

# Verificar estado
nssm status "SAP-ServiceLayer"
Get-Service "SAP-ServiceLayer"
```

### Opción B: Usando PM2 (Alternativa)

```powershell
# Instalar PM2 globalmente
npm install -g pm2
npm install -g pm2-windows-service

# Instalar PM2 como servicio de Windows
pm2-service-install -n "PM2-SAP-ServiceLayer"

# Iniciar la aplicación
cd C:\proyecto\sap-servicelayer
pm2 start src/index.js --name "sap-servicelayer"

# Guardar configuración para que se inicie automáticamente
pm2 save

# Ver logs
pm2 logs sap-servicelayer

# Ver estado
pm2 status

# Comandos útiles
pm2 restart sap-servicelayer
pm2 stop sap-servicelayer
pm2 delete sap-servicelayer
```

---

## 🔍 FASE 7: Validación Post-Migración

### 7.1 Checklist de Validación

```powershell
# Script de validación
$validationResults = @()

# 1. Verificar servicio corriendo
$service = Get-Service "SAP-ServiceLayer" -ErrorAction SilentlyContinue
if ($service.Status -eq "Running") {
    $validationResults += "✅ Servicio SAP-ServiceLayer corriendo"
} else {
    $validationResults += "❌ Servicio SAP-ServiceLayer NO corriendo"
}

# 2. Verificar PostgreSQL
$pgService = Get-Service "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pgService.Status -eq "Running") {
    $validationResults += "✅ PostgreSQL corriendo"
} else {
    $validationResults += "❌ PostgreSQL NO corriendo"
}

# 3. Verificar Redis
$redisService = Get-Service "redis" -ErrorAction SilentlyContinue
if ($redisService.Status -eq "Running") {
    $validationResults += "✅ Redis corriendo"
} else {
    $validationResults += "❌ Redis NO corriendo"
}

# 4. Verificar puerto HTTPS
$httpsPort = Test-NetConnection -ComputerName localhost -Port 3443 -InformationLevel Quiet
if ($httpsPort) {
    $validationResults += "✅ Puerto HTTPS 3443 abierto"
} else {
    $validationResults += "❌ Puerto HTTPS 3443 cerrado"
}

# 5. Verificar puerto HTTP
$httpPort = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet
if ($httpPort) {
    $validationResults += "✅ Puerto HTTP 3000 abierto"
} else {
    $validationResults += "❌ Puerto HTTP 3000 cerrado"
}

# Mostrar resultados
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  RESULTADOS DE VALIDACIÓN" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
$validationResults | ForEach-Object { Write-Host $_ }
Write-Host "==================================" -ForegroundColor Cyan
```

### 7.2 Probar Endpoints Críticos

```powershell
# Health check
Write-Host "`n[Test] Health Check..." -ForegroundColor Yellow
curl -k https://localhost:3443/health

# Login
Write-Host "`n[Test] Login..." -ForegroundColor Yellow
$body = @{
    username = "stifmolina2"
    password = "TU_PASSWORD"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://localhost:3443/api/sap/login-all" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -SkipCertificateCheck

# Listar páginas (requiere autenticación previa)
Write-Host "`n[Test] Get Pages..." -ForegroundColor Yellow
curl -k https://localhost:3443/api/admin/pages `
    -H "x-sap-username: stifmolina2"
```

### 7.3 Verificar Logs

```powershell
# Ver logs de la aplicación
Get-Content C:\proyecto\sap-servicelayer\logs\combined.log -Tail 50

# Ver logs de errores
Get-Content C:\proyecto\sap-servicelayer\logs\error.log -Tail 20

# Ver logs del servicio NSSM
Get-Content C:\proyecto\sap-servicelayer\logs\service-stdout.log -Tail 30
```

---

## 🔧 FASE 8: Configuración de Backups Automáticos

### 8.1 Script de Backup de Base de Datos

Crear archivo `C:\proyecto\scripts\backup-database.ps1`:

```powershell
# backup-database.ps1
# Script para backup automático de PostgreSQL

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "C:\proyecto\backups"
$backupFile = "$backupDir\myapp_backup_$timestamp.dump"
$logFile = "$backupDir\backup_log.txt"

# Crear directorio si no existe
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# Ejecutar backup
Write-Output "$(Get-Date) - Iniciando backup..." | Out-File -Append $logFile
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -F c -b -v -f $backupFile myapp

if ($LASTEXITCODE -eq 0) {
    Write-Output "$(Get-Date) - Backup exitoso: $backupFile" | Out-File -Append $logFile

    # Comprimir backup
    Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip"
    Remove-Item $backupFile

    # Eliminar backups antiguos (más de 30 días)
    Get-ChildItem $backupDir -Filter "*.zip" |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item

    Write-Output "$(Get-Date) - Limpieza de backups antiguos completada" | Out-File -Append $logFile
} else {
    Write-Output "$(Get-Date) - ERROR en backup" | Out-File -Append $logFile
}
```

### 8.2 Programar Tarea de Backup

```powershell
# Crear tarea programada para backup diario a las 2:00 AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\proyecto\scripts\backup-database.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "SAP-ServiceLayer-Backup" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Backup diario de base de datos SAP Service Layer"

# Verificar tarea creada
Get-ScheduledTask -TaskName "SAP-ServiceLayer-Backup"
```

---

## 📊 FASE 9: Monitoreo y Mantenimiento

### 9.1 Script de Estado del Sistema

Crear `C:\proyecto\scripts\check-status.ps1`:

```powershell
# check-status.ps1
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
$ports = @(3000, 3443, 5432, 6379)
foreach ($port in $ports) {
    $result = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    Write-Host "   Port $port`: " -NoNewline
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

# Últimas líneas del log
Write-Host "`n📝 Últimas líneas del log:" -ForegroundColor Yellow
$logFile = "C:\proyecto\sap-servicelayer\logs\combined.log"
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   Log file not found" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Cyan
```

### 9.2 Comandos Útiles de Mantenimiento

```powershell
# Ver logs en tiempo real
Get-Content C:\proyecto\sap-servicelayer\logs\combined.log -Wait -Tail 50

# Reiniciar servicio
Restart-Service "SAP-ServiceLayer"

# Ver procesos de Node.js
Get-Process node

# Limpiar logs antiguos
Get-ChildItem C:\proyecto\sap-servicelayer\logs -Filter "*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item

# Verificar conexiones activas
netstat -ano | findstr ":3443"
netstat -ano | findstr ":3000"

# Ver uso de memoria del proceso
Get-Process node | Select-Object ProcessName, @{Name="Memory (MB)";Expression={[math]::Round($_.WorkingSet64/1MB, 2)}}
```

---

## 🔐 FASE 10: Seguridad

### 10.1 Hardening del Servidor

```powershell
# Deshabilitar servicios innecesarios
Get-Service | Where-Object {$_.StartType -eq "Automatic" -and $_.Status -eq "Running"} |
    Select-Object Name, DisplayName, Status

# Configurar Windows Update
# Usar GUI: Settings -> Windows Update -> Advanced Options

# Habilitar Windows Defender
Set-MpPreference -DisableRealtimeMonitoring $false

# Configurar exclusiones para mejor performance
Add-MpPreference -ExclusionPath "C:\proyecto\sap-servicelayer\node_modules"
Add-MpPreference -ExclusionPath "C:\proyecto\sap-servicelayer\logs"
```

### 10.2 Certificados SSL de Producción (Opcional)

Si necesitan certificados válidos (no auto-firmados):

```powershell
# Opción 1: Let's Encrypt con win-acme
choco install win-acme -y

# Opción 2: Comprar certificado comercial e importar
# Import-PfxCertificate -FilePath "C:\certs\certificate.pfx" -CertStoreLocation Cert:\LocalMachine\My

# Actualizar rutas en la aplicación
# Editar src/index.js para apuntar a nuevos certificados
```

---

## 📞 FASE 11: Acceso para Claude (Supervisión Remota)

### 11.1 Información Necesaria

Una vez completada la instalación, proporcionar a Claude:

```yaml
Servidor Windows:
  IP/Hostname: [COMPLETAR]
  Puerto SSH: 22
  Usuario: [COMPLETAR]
  Password/Key: [COMPLETAR]

Credenciales PostgreSQL:
  Host: localhost
  Port: 5432
  Database: myapp
  User: postgres
  Password: [COMPLETAR]

Credenciales Aplicación:
  Usuario Admin: stifmolina2
  URL: https://[IP_SERVIDOR]:3443

Rutas Importantes:
  Proyecto: C:\proyecto\sap-servicelayer
  Logs: C:\proyecto\sap-servicelayer\logs
  Backups: C:\proyecto\backups
  Scripts: C:\proyecto\scripts
```

### 11.2 Prueba de Acceso SSH

```bash
# Claude ejecutará esto para probar acceso
ssh usuario@IP_SERVIDOR

# Comandos a ejecutar para verificar
cd C:\proyecto\sap-servicelayer
dir
Get-Service "SAP-ServiceLayer"
node --version
npm --version
```

---

## 🚨 SOLUCIÓN DE PROBLEMAS COMUNES

### Problema 1: Servicio no inicia

```powershell
# Ver logs de error del servicio
Get-EventLog -LogName Application -Source "SAP-ServiceLayer" -Newest 20

# Ver logs de NSSM
Get-Content C:\proyecto\sap-servicelayer\logs\service-stderr.log -Tail 50

# Verificar permisos
icacls C:\proyecto\sap-servicelayer

# Ejecutar manualmente para ver errores
cd C:\proyecto\sap-servicelayer
node src/index.js
```

### Problema 2: No conecta a PostgreSQL

```powershell
# Verificar que PostgreSQL está corriendo
Get-Service postgresql-x64-16

# Probar conexión
psql -U postgres -d myapp

# Ver logs de PostgreSQL
Get-Content "C:\Program Files\PostgreSQL\16\data\log\*" -Tail 50

# Verificar pg_hba.conf (acceso local)
notepad "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
# Debe tener: host all all 127.0.0.1/32 md5
```

### Problema 3: Puertos ya en uso

```powershell
# Ver qué proceso está usando el puerto
netstat -ano | findstr ":3443"
netstat -ano | findstr ":3000"

# Matar proceso si es necesario (usar PID del comando anterior)
taskkill /PID [PID] /F

# Cambiar puerto en .env si es necesario
notepad C:\proyecto\sap-servicelayer\.env
```

### Problema 4: Errores de permisos

```powershell
# Dar permisos completos al directorio
icacls C:\proyecto\sap-servicelayer /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /T
icacls C:\proyecto\sap-servicelayer /grant "Administrators:(OI)(CI)F" /T

# Si el servicio corre con usuario específico
icacls C:\proyecto\sap-servicelayer /grant "USUARIO:(OI)(CI)F" /T
```

### Problema 5: Certificados SSL

```powershell
# Verificar que existen los certificados
Test-Path C:\proyecto\sap-servicelayer\docker\ssl\server.key
Test-Path C:\proyecto\sap-servicelayer\docker\ssl\server.crt

# Si no existen, copiar desde backup
# O generar nuevos con OpenSSL (si lo instalaron)
```

---

## 📋 CHECKLIST FINAL

Antes de dar por terminada la migración, verificar:

- [ ] Servidor Windows configurado con IP estática
- [ ] Node.js instalado y funcionando
- [ ] PostgreSQL instalado y restaurado
- [ ] Redis instalado y funcionando
- [ ] SSH Server configurado para acceso de Claude
- [ ] Firewall configurado (puertos 22, 3000, 3443, 5432, 6379)
- [ ] Proyecto copiado en C:\proyecto\sap-servicelayer
- [ ] Variables de entorno configuradas (.env)
- [ ] Dependencias npm instaladas
- [ ] Aplicación corre manualmente sin errores
- [ ] Servicio de Windows configurado (NSSM o PM2)
- [ ] Servicio inicia automáticamente
- [ ] Certificados SSL funcionando
- [ ] Endpoints responden correctamente
- [ ] Base de datos tiene todos los datos
- [ ] Sistema de permisos funciona
- [ ] Backups automáticos configurados
- [ ] Scripts de monitoreo creados
- [ ] Logs se están generando correctamente
- [ ] Documentación actualizada con IPs y credenciales
- [ ] Acceso SSH probado para Claude

---

## 📞 CONTACTO Y SOPORTE

**Cuando el servidor esté listo:**

1. Completar la información en la sección "FASE 11: Acceso para Claude"
2. Probar acceso SSH
3. Notificar a Claude con:
   - IP/Hostname del servidor
   - Credenciales SSH
   - Estado actual de la instalación

**Claude ejecutará:**
```bash
ssh usuario@IP_SERVIDOR
cd C:\proyecto\sap-servicelayer
.\scripts\check-status.ps1
```

---

## 📚 DOCUMENTOS ADICIONALES CREADOS

- `REQUISITOS_INFRAESTRUCTURA_WINDOWS.md` - Especificaciones del servidor
- `CHECKLIST_MIGRACION_WINDOWS.md` - Lista de verificación paso a paso
- `IMPLEMENTACION_PERMISOS.md` - Sistema de permisos RBAC
- `RENOVACION_AUTOMATICA_SESION.md` - Sistema de renovación de sesión
- `install-service-windows.bat` - Script rápido de instalación de servicio
- `start-windows.bat` - Iniciar servicio
- `stop-windows.bat` - Detener servicio

---

**Fecha de creación:** 2025-10-20
**Versión:** 1.0
**Estado:** Pendiente de ejecución - Esperando servidor Windows
**Última actualización:** [COMPLETAR AL FINALIZAR]

---

## ⚠️ NOTAS IMPORTANTES

1. **IMPORTANTE:** Cambiar todas las contraseñas de ejemplo por contraseñas seguras
2. **IMPORTANTE:** Generar nuevos secrets para SESSION_SECRET y SESSION_ENCRYPTION_KEY
3. **IMPORTANTE:** Configurar backup de base de datos en ubicación externa/red
4. **IMPORTANTE:** Documentar todas las credenciales en un gestor de contraseñas seguro
5. **IMPORTANTE:** Realizar pruebas exhaustivas antes de poner en producción
6. **IMPORTANTE:** Mantener logs por al menos 30 días para auditoría
7. **IMPORTANTE:** Configurar alertas para caídas de servicio
8. **RECOMENDADO:** Instalar certificado SSL válido para producción
9. **RECOMENDADO:** Configurar sistema de monitoreo (ej: Prometheus, Grafana)
10. **RECOMENDADO:** Implementar sistema de alertas por email/SMS

---

🎯 **Esta documentación será la guía completa para la migración. Cuando el servidor Windows esté listo, retomamos desde aquí.**
