# 🚀 GU

ÍA DE MIGRACIÓN A WINDOWS SERVER

**Servidor Destino:** SERVI-25 (10.13.0.29)
**Sistema Operativo:** Windows Server 2022 Standard
**Fecha:** 2025-10-20

---

## 📋 REQUISITOS PREVIOS

### ✅ Ya Configurado:
- ✅ OpenSSH Server instalado y funcionando
- ✅ Usuario `fmolinam` con permisos de administrador
- ✅ Firewall configurado para SSH (puerto 22)
- ✅ Conectividad entre servidores Linux ↔ Windows

### ❌ Pendiente de Instalar:
- ❌ Node.js LTS
- ❌ PostgreSQL 16
- ❌ Git

---

## 🎯 PASO 1: INSTALAR DEPENDENCIAS

### Descargar Script de Instalación

En el servidor Windows, abre **PowerShell como Administrador** y ejecuta:

```powershell
# Descargar script de instalación
Invoke-WebRequest -Uri "https://10.13.1.83:3443/install-windows-dependencies.ps1" -OutFile "C:\Temp\install-dependencies.ps1" -SkipCertificateCheck

# Ejecutar script
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
C:\Temp\install-dependencies.ps1
```

Este script instalará automáticamente:
- ✅ Chocolatey (gestor de paquetes)
- ✅ Node.js LTS (última versión estable)
- ✅ PostgreSQL 16
- ✅ Git
- ✅ Reglas de firewall necesarias

**⏱ Tiempo estimado:** 15-20 minutos

---

## 🎯 PASO 2: CREAR BASE DE DATOS

Una vez instalado PostgreSQL, ejecuta:

```powershell
# Conectar a PostgreSQL
$env:PGPASSWORD='FmDiosMio1'
psql -U postgres -h localhost

# En el prompt de PostgreSQL, ejecuta:
CREATE DATABASE myapp;
CREATE USER myapp_user WITH PASSWORD 'FmDiosMio1';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
ALTER DATABASE myapp OWNER TO myapp_user;
\q
```

---

## 🎯 PASO 3: TRANSFER ARCHIVOS

Desde el servidor Linux, voy a transferir todos los archivos automáticamente via SSH.

**Archivos a transferir:**
```
📁 C:\ServiceLayer\
├── 📁 src/                  (Código fuente backend)
├── 📁 public/              (Frontend HTML/CSS/JS)
├── 📁 database/            (Migraciones SQL)
├── 📁 scripts/             (Scripts de utilidad)
├── 📁 docker/              (Certificados SSL)
├── 📄 package.json
├── 📄 .env
└── 📄 start-windows.bat
```

---

## 🎯 PASO 4: CONFIGURAR VARIABLES DE ENTORNO

El archivo `.env` será creado con esta configuración:

```env
# Servidor
NODE_ENV=production
PORT=3000
HTTPS_PORT=3443
HOST=0.0.0.0
ENABLE_HTTPS=true

# Base de Datos PostgreSQL
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

# Sesión Renewal (Single-Database)
SESSION_RENEWAL_ENABLED=true

# Windows SSH (para control remoto)
WINDOWS_SSH_PASSWORD=Fmvidayo28@

# Seguridad
JWT_SECRET=your-super-secret-key-change-this-in-production
BCRYPT_SALT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://10.13.0.29:3443
CORS_CREDENTIALS=true

# Logs
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## 🎯 PASO 5: INSTALAR DEPENDENCIAS NPM

```powershell
cd C:\ServiceLayer
npm install
```

**⏱ Tiempo estimado:** 5-10 minutos

---

## 🎯 PASO 6: EJECUTAR MIGRACIONES DE BASE DE DATOS

```powershell
# Ejecutar todas las migraciones
cd C:\ServiceLayer
node scripts/run-all-migrations.js
```

---

## 🎯 PASO 7: GENERAR CERTIFICADOS SSL (SI NO EXISTEN)

```powershell
# Verificar si existen certificados
if (-not (Test-Path "C:\ServiceLayer\docker\ssl\cert.pem")) {
    Write-Host "Generando certificados SSL..." -ForegroundColor Yellow

    # Instalar OpenSSL si no está
    choco install openssl -y

    # Crear directorio
    New-Item -ItemType Directory -Path "C:\ServiceLayer\docker\ssl" -Force

    # Generar certificados
    openssl req -x509 -newkey rsa:4096 -keyout "C:\ServiceLayer\docker\ssl\key.pem" -out "C:\ServiceLayer\docker\ssl\cert.pem" -days 365 -nodes -subj "/CN=10.13.0.29"

    Write-Host "✓ Certificados generados" -ForegroundColor Green
} else {
    Write-Host "✓ Certificados SSL ya existen" -ForegroundColor Green
}
```

---

## 🎯 PASO 8: PROBAR LA APLICACIÓN

### Iniciar manualmente primero:

```powershell
cd C:\ServiceLayer
node src/index.js
```

Verifica en el navegador:
- **HTTP:**  http://10.13.0.29:3000 (redirige a HTTPS)
- **HTTPS:** https://10.13.0.29:3443

---

## 🎯 PASO 9: CONFIGURAR SERVICIO WINDOWS

Para que la aplicación se inicie automáticamente con el servidor:

```powershell
# Instalar node-windows-service
npm install -g node-windows

# Crear servicio
cd C:\ServiceLayer
node scripts/install-service-windows.js
```

### Verificar servicio:

```powershell
# Ver estado
Get-Service "ServiceLayer" | Select-Object Name, Status, StartType

# Iniciar manualmente
Start-Service "ServiceLayer"

# Detener
Stop-Service "ServiceLayer"

# Logs del servicio
Get-Content C:\ServiceLayer\logs\service.log -Tail 50
```

---

## 🎯 PASO 10: VERIFICACIÓN FINAL

### Checklist de Verificación:

```powershell
# === SCRIPT DE VERIFICACIÓN ===

Write-Host "`n=== VERIFICACIÓN DE INSTALACIÓN ===" -ForegroundColor Cyan

# 1. Node.js
Write-Host "`n1. Node.js:" -ForegroundColor White
node --version
npm --version

# 2. PostgreSQL
Write-Host "`n2. PostgreSQL:" -ForegroundColor White
$env:PGPASSWORD='FmDiosMio1'
psql -U postgres -c "SELECT version();"

# 3. Base de datos
Write-Host "`n3. Base de Datos myapp:" -ForegroundColor White
psql -U myapp_user -d myapp -c "\dt"

# 4. Archivos
Write-Host "`n4. Archivos de la aplicación:" -ForegroundColor White
Test-Path "C:\ServiceLayer\src\index.js"
Test-Path "C:\ServiceLayer\package.json"
Test-Path "C:\ServiceLayer\.env"

# 5. Certificados SSL
Write-Host "`n5. Certificados SSL:" -ForegroundColor White
Test-Path "C:\ServiceLayer\docker\ssl\cert.pem"
Test-Path "C:\ServiceLayer\docker\ssl\key.pem"

# 6. Puerto 3443 escuchando
Write-Host "`n6. Puerto 3443:" -ForegroundColor White
netstat -an | Select-String ":3443"

# 7. Servicio Windows
Write-Host "`n7. Servicio ServiceLayer:" -ForegroundColor White
Get-Service "ServiceLayer" -ErrorAction SilentlyContinue

Write-Host "`n=== FIN DE VERIFICACIÓN ===" -ForegroundColor Cyan
```

---

## 🔥 TROUBLESHOOTING

### Problema 1: "Puerto 3443 ya en uso"

```powershell
# Encontrar qué proceso usa el puerto
netstat -ano | findstr :3443

# Detener el proceso (reemplaza PID)
taskkill /PID <PID> /F
```

### Problema 2: "No se puede conectar a PostgreSQL"

```powershell
# Verificar servicio PostgreSQL
Get-Service postgresql*

# Iniciar servicio
Start-Service postgresql-x64-16

# Verificar puerto
netstat -an | findstr :5432
```

### Problema 3: "Certificados SSL inválidos"

```powershell
# Regenerar certificados
cd C:\ServiceLayer\docker\ssl
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=10.13.0.29"

# Reiniciar aplicación
Restart-Service "ServiceLayer"
```

### Problema 4: "Error al ejecutar migraciones"

```powershell
# Verificar conexión a BD
$env:PGPASSWORD='FmDiosMio1'
psql -U myapp_user -d myapp -c "SELECT 1;"

# Ejecutar migraciones una por una
cd C:\ServiceLayer
node scripts/run-migration.js database/migrations/001_initial_schema.sql
```

---

## 📊 MONITOREO POST-MIGRACIÓN

### Logs en tiempo real:

```powershell
# Logs de la aplicación
Get-Content C:\ServiceLayer\logs\app.log -Wait -Tail 50

# Logs del servicio Windows
Get-Content C:\ServiceLayer\logs\service.log -Wait -Tail 50

# Event Viewer (errores de aplicación)
Get-EventLog -LogName Application -Source "ServiceLayer" -Newest 20
```

### Reiniciar aplicación:

```powershell
# Si está como servicio
Restart-Service "ServiceLayer"

# Si está corriendo manualmente
# Presiona Ctrl+C y vuelve a ejecutar
cd C:\ServiceLayer
node src/index.js
```

---

## 🎯 PRÓXIMOS PASOS DESPUÉS DE LA MIGRACIÓN

1. **Actualizar DNS/Registros** (si aplica)
2. **Configurar backups automáticos** de la base de datos
3. **Configurar monitoreo** con el dashboard `/windows-management.html`
4. **Documentar credenciales** en lugar seguro
5. **Probar failover** entre servidores

---

## 📞 SOPORTE

Si tienes problemas durante la migración, revisa:
- `/CONFIGURACION_SSH_WINDOWS.md` - Setup SSH
- `/CLAUDE.md` - Instrucciones generales
- Logs en `C:\ServiceLayer\logs\`

---

**Última actualización:** 2025-10-20
**Versión:** 1.0
**Autor:** Claude Code + BlueSystem Team
