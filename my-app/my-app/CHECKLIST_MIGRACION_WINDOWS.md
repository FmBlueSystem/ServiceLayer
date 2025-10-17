# CHECKLIST DE MIGRACIÓN A WINDOWS SERVER

**Aplicación:** Service Layer Integration (SAP)
**Fecha:** 2025-10-16
**Responsable:** _______________

---

## FASE 1: PRE-INSTALACIÓN (Infraestructura)

### Servidor Windows
- [ ] Windows Server 2019/2022 instalado y actualizado
- [ ] 8 vCPU, 16 GB RAM, 200 GB SSD confirmado
- [ ] IP estática asignada: ________________
- [ ] Acceso de administrador configurado

### Software Base
- [ ] Node.js 22.19.0 LTS instalado
- [ ] npm 10.x verificado (`npm --version`)
- [ ] PostgreSQL 16 instalado
- [ ] Redis 7.x instalado
- [ ] Git for Windows instalado (opcional)

### Verificación de Instalaciones
```powershell
# Ejecutar en PowerShell para verificar
node --version    # Debe mostrar v22.x.x
npm --version     # Debe mostrar 10.x.x
pg_config --version  # Debe mostrar PostgreSQL 16.x
redis-cli --version  # Debe mostrar Redis 7.x
```

---

## FASE 2: CONFIGURACIÓN DE RED

### Firewall de Windows
- [ ] Puerto 3000 TCP abierto (INBOUND) - HTTP redirect
- [ ] Puerto 3443 TCP abierto (INBOUND) - HTTPS principal

**Comandos PowerShell (ejecutar como Administrador):**
```powershell
New-NetFirewallRule -DisplayName "Service Layer - HTTP" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Service Layer - HTTPS" -Direction Inbound -LocalPort 3443 -Protocol TCP -Action Allow
```

### Conectividad Externa (CRÍTICO)
- [ ] Proxy/Firewall corporativo permite acceso a:
  - `https://sap-stiacmzdr-sl.skyinone.net:50000/`
- [ ] DNS configurado correctamente
- [ ] Ping a SAP Service Layer exitoso

**Prueba de conectividad:**
```powershell
Test-NetConnection -ComputerName sap-stiacmzdr-sl.skyinone.net -Port 50000
```

---

## FASE 3: TRANSFERENCIA DE ARCHIVOS

### Desde Linux a Windows
- [ ] Crear carpeta: `C:\Apps\my-app\`
- [ ] Copiar carpeta completa `src/`
- [ ] Copiar carpeta completa `public/`
- [ ] Copiar carpeta `docker/ssl/` (certificados)
- [ ] Copiar archivo `package.json`
- [ ] Copiar archivo `package-lock.json`
- [ ] Copiar archivo `.env` (IMPORTANTE: Ajustar después)

**Métodos de transferencia:**
- Usar WinSCP, FileZilla, o compartir carpeta en red
- Comprimir en .zip en Linux y descomprimir en Windows

### Estructura final en Windows
```
C:\Apps\my-app\
├── src\
├── public\
├── docker\ssl\
│   ├── cert.pem
│   └── key.pem
├── package.json
├── package-lock.json
├── .env
├── start-windows.bat
├── stop-windows.bat
└── install-service-windows.bat
```

---

## FASE 4: CONFIGURACIÓN DE APLICACIÓN

### Instalación de Dependencias
- [ ] Abrir PowerShell/CMD en `C:\Apps\my-app\`
- [ ] Ejecutar: `npm install --production`
- [ ] Verificar que `node_modules\` se creó correctamente

### Configuración de .env
- [ ] Abrir `C:\Apps\my-app\.env` con editor de texto
- [ ] Actualizar las siguientes variables:

```env
# Variables a MODIFICAR para Windows:
NODE_ENV=production

# PostgreSQL - Ajustar password
POSTGRES_HOST=localhost
POSTGRES_PASSWORD=[CAMBIAR - Password seguro]

# Redis - Opcional: agregar password
REDIS_HOST=localhost
REDIS_PASSWORD=[OPCIONAL]

# Seguridad - GENERAR NUEVOS VALORES
JWT_SECRET=[GENERAR - 64 caracteres aleatorios]
SESSION_SECRET=[GENERAR - 64 caracteres aleatorios]

# SAP - Verificar que sean correctos
SAP_ENDPOINT=https://sap-stiacmzdr-sl.skyinone.net:50000/
SAP_USERNAME=stifmolina2
SAP_PASSWORD=FmDiosMio1

# Rate Limiting - Ya configurado correctamente
RATE_LIMIT_MAX_REQUESTS=500
```

**Generar secretos seguros (PowerShell):**
```powershell
# JWT Secret
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})

# Session Secret
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

---

## FASE 5: CONFIGURACIÓN DE POSTGRESQL

### Crear Base de Datos
- [ ] Abrir pgAdmin o psql
- [ ] Crear base de datos `myapp`

**SQL:**
```sql
CREATE DATABASE myapp;
CREATE USER myapp_user WITH ENCRYPTED PASSWORD 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
```

### Migrar Datos desde Linux (si aplica)
- [ ] En Linux: `pg_dump -U postgres -d myapp -F c -f myapp_backup.dump`
- [ ] Transferir archivo a Windows
- [ ] En Windows: `pg_restore -U postgres -d myapp myapp_backup.dump`

**O iniciar desde cero:**
- [ ] La aplicación creará las tablas automáticamente al iniciar

---

## FASE 6: CONFIGURACIÓN DE REDIS

### Configuración Básica
- [ ] Redis corriendo en localhost:6379
- [ ] (Opcional) Configurar password en `redis.conf`
- [ ] Verificar conexión: `redis-cli ping` → debe responder `PONG`

### Configuración de Persistencia
- [ ] Editar `C:\Program Files\Redis\redis.windows.conf`
- [ ] Verificar: `save 900 1` (guardar cada 15 min si hay 1 cambio)
- [ ] Verificar: `appendonly yes` (activar AOF)

---

## FASE 7: PRUEBA INICIAL

### Iniciar Aplicación Manualmente
- [ ] Abrir PowerShell en `C:\Apps\my-app\`
- [ ] Ejecutar: `.\start-windows.bat`
- [ ] Verificar que NO hay errores en la consola

### Salida esperada:
```
🚀 Starting application initialization...
✅ Database connected successfully
✅ Redis connected successfully
✅ Application initialized successfully
🔀 HTTP redirect server started { port: 3000 }
🔒 HTTPS server started successfully { port: 3443 }
```

### Verificaciones
- [ ] Navegar a: `https://localhost:3443/health`
  - Debe responder con JSON: `{"status":"ok",...}`
- [ ] Navegar a: `https://localhost:3443/login`
  - Debe mostrar página de login
- [ ] Verificar logs en: `C:\Apps\my-app\logs\`

---

## FASE 8: VALIDACIÓN DE CONECTIVIDAD SAP

### Test de Conexión
- [ ] Login en la aplicación (usuario: stifmolina2)
- [ ] Navegar a cualquier módulo
- [ ] Verificar que se conecta a SAP Service Layer

### Verificación Manual (PowerShell):
```powershell
$headers = @{
    "Content-Type" = "application/json"
}
Invoke-WebRequest -Uri "https://localhost:3443/api/sap-validation/databases/validate" -Method GET -Headers $headers
```

### Bases de datos esperadas:
- [ ] SBO_GT_STIA_PROD (Guatemala) - Conectado
- [ ] SBO_HO_STIA_PROD (Honduras) - Conectado
- [ ] SBO_PA_STIA_PROD (Panamá) - Conectado
- [ ] SBO_STIACR_PROD (Costa Rica) - Conectado

---

## FASE 9: INSTALACIÓN COMO SERVICIO DE WINDOWS

### Instalar NSSM
- [ ] Descargar NSSM desde: https://nssm.cc/download
- [ ] Extraer `nssm.exe` a `C:\Windows\System32\`
- [ ] Verificar: `nssm version`

### Instalar Servicio
- [ ] Detener aplicación manual (Ctrl+C en PowerShell)
- [ ] Ejecutar como Administrador: `.\install-service-windows.bat`
- [ ] Verificar instalación exitosa

### Verificar Servicio
- [ ] Abrir: `services.msc`
- [ ] Buscar: "Service Layer Integration"
- [ ] Verificar:
  - Estado: En ejecución
  - Tipo de inicio: Automático
  - Recuperación: Reiniciar el servicio en fallos

### Comandos de Servicio:
```powershell
# Ver estado
nssm status ServiceLayerApp

# Iniciar
nssm start ServiceLayerApp

# Detener
nssm stop ServiceLayerApp

# Reiniciar
nssm restart ServiceLayerApp

# Ver logs en tiempo real
Get-Content C:\Apps\my-app\logs\service-stdout.log -Wait -Tail 50
```

---

## FASE 10: PRUEBAS FUNCIONALES COMPLETAS

### Test de Funcionalidades
- [ ] Login con credenciales: stifmolina2 / FmDiosMio1
- [ ] Dashboard se carga correctamente
- [ ] Módulo Artículos: consulta SAP exitosa
- [ ] Módulo Órdenes de Venta: consulta SAP exitosa
- [ ] Módulo Ofertas de Venta: consulta SAP exitosa
- [ ] Módulo Tipos de Cambio: datos se cargan correctamente
- [ ] Verificar banderas de países visibles: 🇨🇷 🇭🇳 🇬🇹 🇵🇦
- [ ] Actualizar tipos de cambio: funcional
- [ ] Módulo Fichas Técnicas: funcional

### Test desde Otra Máquina
- [ ] Desde otra PC en la red: `https://[IP_SERVIDOR]:3443/login`
- [ ] Certificado SSL: aceptar advertencia (si es autofirmado)
- [ ] Login funcional
- [ ] Consultas a SAP funcionan

---

## FASE 11: CONFIGURACIÓN DE RESPALDOS

### PostgreSQL Backup Automático
- [ ] Crear script: `C:\Apps\scripts\backup-db.bat`

**Contenido del script:**
```batch
@echo off
set BACKUP_DIR=C:\Backups\myapp
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
set BACKUP_FILE=%BACKUP_DIR%\myapp_backup_%TIMESTAMP%.dump

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

pg_dump -U postgres -d myapp -F c -f "%BACKUP_FILE%"

forfiles /p "%BACKUP_DIR%" /m *.dump /d -30 /c "cmd /c del @path"
```

- [ ] Configurar Tarea Programada en Windows:
  - Abrir: `taskschd.msc`
  - Crear tarea básica: "Backup PostgreSQL MyApp"
  - Trigger: Diario a las 2:00 AM
  - Acción: Ejecutar `C:\Apps\scripts\backup-db.bat`

---

## FASE 12: MONITOREO

### Configurar Monitoreo de Salud
- [ ] Configurar Nagios/Zabbix/PRTG para monitorear:
  - Endpoint: `https://[IP]:3443/health`
  - Intervalo: 5 minutos
  - Alerta: Si falla por más de 2 minutos

### Logs
- [ ] Configurar rotación de logs (ya incluido en servicio NSSM)
- [ ] Verificar carpeta: `C:\Apps\my-app\logs\`
  - `service-stdout.log`
  - `service-stderr.log`
  - `app.log` (logs de aplicación)

### Alertas de Recursos
- [ ] CPU: Alerta si > 80% por 5 minutos
- [ ] RAM: Alerta si > 80% por 5 minutos
- [ ] Disco: Alerta si < 10 GB libres

---

## FASE 13: DOCUMENTACIÓN

### Documentar Configuración Final
- [ ] IP del servidor: _______________
- [ ] Hostname: _______________
- [ ] Contraseñas documentadas en: _______________
- [ ] Ubicación de respaldos: _______________
- [ ] Contactos de soporte:
  - Infraestructura: _______________
  - Desarrollo: _______________
  - SAP Team: _______________

### Crear Runbook
- [ ] Procedimiento de inicio/parada
- [ ] Procedimiento de reinicio
- [ ] Troubleshooting común
- [ ] Contactos de escalamiento

---

## FASE 14: DESCOMISIONAMIENTO DE SERVIDOR LINUX (Opcional)

**⚠️ SOLO después de validar 100% que Windows funciona correctamente**

- [ ] Mantener servidor Linux por 2 semanas como respaldo
- [ ] Redirigir DNS/tráfico a nuevo servidor Windows
- [ ] Validar que no hay errores por 1 semana
- [ ] Backup final de Linux
- [ ] Apagar servidor Linux
- [ ] Documentar descomisionamiento

---

## CHECKLIST DE VALIDACIÓN FINAL

### Funcionalidad
- [x] Aplicación inicia automáticamente con Windows
- [x] HTTPS funcional en puerto 3443
- [x] Conexión a SAP Service Layer exitosa (4 bases de datos)
- [x] PostgreSQL y Redis operativos
- [x] Todos los módulos funcionales
- [x] Rate limiting configurado correctamente (500 req/15min)

### Seguridad
- [x] Firewall configurado
- [x] Certificados SSL instalados
- [x] Contraseñas fuertes generadas
- [x] Acceso restringido (solo usuarios autorizados)

### Operaciones
- [x] Servicio de Windows configurado
- [x] Respaldos automatizados
- [x] Monitoreo activo
- [x] Logs rotando correctamente
- [x] Documentación completa

---

## NOTAS IMPORTANTES

**Comandos Útiles PowerShell:**
```powershell
# Ver logs en tiempo real
Get-Content C:\Apps\my-app\logs\service-stdout.log -Wait -Tail 50

# Reiniciar servicio
Restart-Service ServiceLayerApp

# Ver procesos de Node.js
Get-Process -Name node

# Verificar puertos en uso
netstat -ano | findstr "3000 3443 5432 6379"

# Test de conectividad
Test-NetConnection localhost -Port 3443
```

**Resolución de Problemas Comunes:**

1. **Error: "EADDRINUSE" (puerto en uso)**
   ```powershell
   netstat -ano | findstr "3443"
   taskkill /PID [PID] /F
   ```

2. **Error: PostgreSQL no conecta**
   - Verificar servicio: `services.msc` → "postgresql-x64-16"
   - Verificar password en .env
   - Verificar puerto: `netstat -ano | findstr "5432"`

3. **Error: No puede conectar a SAP**
   - Verificar conectividad: `Test-NetConnection sap-stiacmzdr-sl.skyinone.net -Port 50000`
   - Verificar firewall corporativo
   - Verificar credenciales en .env

---

**Fecha de inicio:** _______________
**Fecha de finalización:** _______________
**Responsable:** _______________
**Aprobado por:** _______________

---

**Completado:** [ ]
