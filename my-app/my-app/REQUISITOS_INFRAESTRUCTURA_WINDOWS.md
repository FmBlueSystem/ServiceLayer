# REQUISITOS DE INFRAESTRUCTURA - SERVIDOR WINDOWS
## Aplicación: Service Layer Integration (SAP)

**Fecha de solicitud:** 2025-10-16
**Solicitado por:** BlueSystemIO
**Ambiente:** Producción

---

## 1. ESPECIFICACIONES DEL SERVIDOR WINDOWS

### 1.1 Sistema Operativo
- **OS:** Windows Server 2019/2022 (64-bit)
- **Edición:** Standard o Datacenter
- **Licencia:** Activada y actualizada

### 1.2 Recursos de Hardware (Mínimos)
- **CPU:** 4 vCPU / Cores
- **RAM:** 8 GB (recomendado: 16 GB)
- **Disco:** 100 GB SSD
- **Red:** 1 Gbps

### 1.3 Recursos de Hardware (Recomendados para Producción)
- **CPU:** 8 vCPU / Cores
- **RAM:** 16 GB
- **Disco:** 200 GB SSD (NVMe preferible)
- **Red:** 1 Gbps

---

## 2. SOFTWARE REQUERIDO

### 2.1 Runtime y Lenguajes
| Software | Versión Mínima | Versión Recomendada | Descarga |
|----------|---------------|---------------------|----------|
| Node.js | 18.0.0 LTS | 22.19.0 LTS | https://nodejs.org/ |
| npm | 8.0.0 | 10.x | (incluido con Node.js) |

### 2.2 Bases de Datos y Caché
| Software | Versión | Puerto | Notas |
|----------|---------|--------|-------|
| PostgreSQL | 16.10 | 5432 | Base de datos principal |
| Redis | 7.x | 6379 | Caché y sesiones |

### 2.3 Herramientas de Desarrollo (Opcionales)
| Software | Propósito |
|----------|-----------|
| Git for Windows | Control de versiones |
| Visual Studio Code | Editor de código |
| Postman | Testing de APIs |
| pgAdmin 4 | Administración PostgreSQL |
| RedisInsight | Administración Redis |

### 2.4 Certificados SSL
- **Certificados autofirmados:** Ya incluidos en `/docker/ssl/`
- **Certificados de producción:** Solicitar a equipo de seguridad si es necesario
- **Archivos requeridos:**
  - `cert.pem` (certificado público)
  - `key.pem` (clave privada)

---

## 3. CONFIGURACIÓN DE RED

### 3.1 Puertos a Abrir en Firewall de Windows

#### Puertos de la Aplicación (INBOUND)
| Puerto | Protocolo | Servicio | Origen | Descripción |
|--------|-----------|----------|--------|-------------|
| 3000 | TCP | HTTP | Red corporativa | Redirección HTTP → HTTPS |
| 3443 | TCP | HTTPS | Red corporativa | Aplicación web principal |
| 9229 | TCP | Debug | 127.0.0.1 | Node.js debugger (solo local) |

#### Puertos de Servicios (LOCALHOST)
| Puerto | Protocolo | Servicio | Acceso |
|--------|-----------|----------|--------|
| 5432 | TCP | PostgreSQL | Solo local (127.0.0.1) |
| 6379 | TCP | Redis | Solo local (127.0.0.1) |

### 3.2 Reglas de Firewall PowerShell

```powershell
# Reglas para la aplicación
New-NetFirewallRule -DisplayName "Service Layer - HTTP Redirect" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Service Layer - HTTPS" -Direction Inbound -LocalPort 3443 -Protocol TCP -Action Allow
```

### 3.3 IP Estática Requerida
- **Dirección IP estática:** SÍ (para configuración de DNS)
- **IP actual (Linux):** 10.13.1.83
- **IP solicitada (Windows):** _[A definir por infraestructura]_
- **Subnet:** 10.13.x.x
- **Gateway:** _[A definir por infraestructura]_

---

## 4. CONECTIVIDAD EXTERNA REQUERIDA

### 4.1 Acceso a SAP Service Layer (CRÍTICO)
- **URL:** `https://sap-stiacmzdr-sl.skyinone.net:50000/`
- **Puerto:** 50000 (HTTPS)
- **Protocolo:** HTTPS/REST API
- **Verificación SSL:** Deshabilitada (certificado autofirmado SAP)
- **Timeout:** 10 segundos
- **Credenciales:** Configuradas en .env (encriptadas)

**Bases de datos SAP accedidas:**
- `SBO_GT_STIA_PROD` (Guatemala)
- `SBO_HO_STIA_PROD` (Honduras)
- `SBO_PA_STIA_PROD` (Panamá)
- `SBO_STIACR_PROD` (Costa Rica)

### 4.2 Acceso a Banco Central de Costa Rica (Opcional)
- **URL:** API BCCR para tipos de cambio
- **Puerto:** 443 (HTTPS)
- **Protocolo:** HTTPS/SOAP
- **Frecuencia:** Consultas periódicas (1-2 por hora)

### 4.3 Whitelist de URLs
Solicitar que las siguientes URLs estén permitidas en el proxy/firewall corporativo:
```
https://sap-stiacmzdr-sl.skyinone.net:50000/
https://*.bccr.fi.cr/ (Banco Central Costa Rica)
https://api.exchangerate-api.com/ (Opcional - tipos de cambio backup)
```

---

## 5. CONFIGURACIÓN DE SERVICIOS DE WINDOWS

### 5.1 Servicio de Windows para la Aplicación Node.js

Se recomienda instalar la aplicación como un servicio de Windows usando **NSSM** (Non-Sucking Service Manager) o **PM2** para Windows.

#### Opción 1: NSSM (Recomendado)
```powershell
# Descargar NSSM desde https://nssm.cc/download
nssm install "ServiceLayerApp" "C:\Program Files\nodejs\node.exe" "C:\Apps\my-app\src\index.js"
nssm set "ServiceLayerApp" AppDirectory "C:\Apps\my-app"
nssm set "ServiceLayerApp" AppEnvironmentExtra "NODE_ENV=production"
nssm set "ServiceLayerApp" DisplayName "Service Layer Integration"
nssm set "ServiceLayerApp" Description "SAP Service Layer Integration Application"
nssm set "ServiceLayerApp" Start SERVICE_AUTO_START
nssm start "ServiceLayerApp"
```

#### Opción 2: PM2 para Windows
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
cd C:\Apps\my-app
pm2 start src/index.js --name "service-layer-app"
pm2 save
```

### 5.2 Servicios de PostgreSQL y Redis
Ambos deben configurarse para:
- **Inicio automático** con Windows
- **Recuperación automática** en caso de fallo
- **Logs de errores** habilitados

---

## 6. ESTRUCTURA DE DIRECTORIOS

### 6.1 Ubicación de la Aplicación
```
C:\Apps\
└── my-app\
    ├── src\                 # Código fuente
    ├── public\              # Archivos estáticos (HTML, CSS, JS)
    ├── logs\                # Logs de la aplicación
    ├── data\                # Datos de PostgreSQL y Redis
    │   ├── postgres\
    │   └── redis\
    ├── docker\
    │   └── ssl\             # Certificados SSL
    │       ├── cert.pem
    │       └── key.pem
    ├── node_modules\        # Dependencias (npm install)
    ├── .env                 # Variables de entorno
    ├── package.json
    └── start-windows.bat    # Script de inicio
```

### 6.2 Permisos de Carpetas
- **Aplicación:** Usuario del servicio con permisos de lectura/ejecución
- **Logs:** Usuario del servicio con permisos de escritura
- **Data:** Usuario del servicio con permisos de lectura/escritura
- **SSL:** Solo administradores y servicio (protegidos)

---

## 7. VARIABLES DE ENTORNO (.env)

Las siguientes variables deben configurarse en el servidor Windows:

### Variables Críticas (Modificar para Windows)
```env
# Aplicación
NODE_ENV=production
HTTP_PORT=3000
HTTPS_PORT=3443
ENABLE_HTTPS=true

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=myapp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=[A DEFINIR - CONTRASEÑA SEGURA]
POSTGRES_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=[A DEFINIR - OPCIONAL]

# SAP Service Layer
SAP_ENDPOINT=https://sap-stiacmzdr-sl.skyinone.net:50000/
SAP_USERNAME=stifmolina2
SAP_PASSWORD=FmDiosMio1
SAP_VERIFY_SSL=false

# Seguridad
JWT_SECRET=[A DEFINIR - GENERAR CONTRASEÑA ALEATORIA FUERTE]
SESSION_SECRET=[A DEFINIR - GENERAR CONTRASEÑA ALEATORIA FUERTE]
BCRYPT_SALT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 8. RESPALDOS Y MONITOREO

### 8.1 Política de Respaldos
| Componente | Frecuencia | Retención | Ubicación |
|------------|-----------|-----------|-----------|
| Base de datos PostgreSQL | Diaria (automática) | 30 días | Servidor de respaldos |
| Archivos de configuración (.env) | Manual (cambios) | Permanente | Repositorio seguro |
| Logs de aplicación | Rotación diaria | 7 días | C:\Apps\my-app\logs |
| Datos de Redis | No crítico | - | (Caché temporal) |

### 8.2 Monitoreo Requerido
- **Disponibilidad:** Ping al endpoint `/health` cada 5 minutos
- **Uso de CPU/RAM:** Alertas si supera 80% por más de 5 minutos
- **Uso de disco:** Alertas si queda menos de 10 GB libre
- **Logs de error:** Monitoreo de logs para errores críticos
- **Conectividad SAP:** Alertas si falla conexión a SAP Service Layer

---

## 9. SEGURIDAD

### 9.1 Actualizaciones de Windows
- **Windows Updates:** Configurar actualizaciones automáticas de seguridad
- **Antivirus:** Excluir carpetas de Node.js, PostgreSQL, Redis del escaneo en tiempo real para evitar degradación de rendimiento

### 9.2 Usuarios y Permisos
- **Usuario del servicio:** Crear usuario dedicado con permisos limitados
- **Contraseñas:** Generar contraseñas fuertes para PostgreSQL, Redis, JWT
- **Acceso RDP:** Solo personal autorizado de TI

### 9.3 SSL/TLS
- **Certificados:** Instalar certificados SSL de producción si es ambiente productivo
- **TLS 1.2+:** Habilitar solo protocolos seguros

---

## 10. MIGRACIÓN DESDE LINUX

### 10.1 Archivos a Transferir
```
my-app/
├── src/                    # TODO el código fuente
├── public/                 # Archivos HTML/CSS/JS
├── docker/ssl/             # Certificados SSL
├── package.json            # Dependencias
├── package-lock.json       # Versiones exactas
└── .env                    # Variables de entorno (ACTUALIZAR IPs)
```

### 10.2 Base de Datos PostgreSQL
**Opción 1: Dump SQL**
```bash
# En Linux (origen)
pg_dump -U postgres -d myapp -F c -f myapp_backup.dump

# En Windows (destino)
pg_restore -U postgres -d myapp myapp_backup.dump
```

**Opción 2: Nueva instalación**
Si la base de datos está vacía o solo tiene configuración:
- Ejecutar scripts de inicialización en Windows
- Migrar manualmente datos críticos

### 10.3 Checklist de Migración
- [ ] Instalar software base (Node.js, PostgreSQL, Redis)
- [ ] Crear estructura de directorios
- [ ] Copiar archivos de aplicación
- [ ] Configurar .env con IPs y puertos de Windows
- [ ] Instalar dependencias: `npm install --production`
- [ ] Configurar certificados SSL
- [ ] Importar base de datos PostgreSQL
- [ ] Configurar servicios de Windows
- [ ] Configurar reglas de firewall
- [ ] Probar conectividad a SAP
- [ ] Iniciar aplicación como servicio
- [ ] Validar endpoints: /health, /login, /tipos-cambio
- [ ] Configurar monitoreo y respaldos
- [ ] Documentar IPs y credenciales en ubicación segura

---

## 11. SCRIPTS DE INICIO PARA WINDOWS

### start-windows.bat
```batch
@echo off
echo ====================================
echo  Service Layer Integration - START
echo ====================================
echo.

REM Cambiar al directorio de la aplicación
cd /d C:\Apps\my-app

REM Verificar que Node.js esté instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no está instalado o no está en el PATH
    pause
    exit /b 1
)

REM Verificar que PostgreSQL esté corriendo
pg_isready -h localhost -p 5432 >nul 2>&1
if errorlevel 1 (
    echo ADVERTENCIA: PostgreSQL no está corriendo o no es accesible
)

REM Verificar que Redis esté corriendo
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ADVERTENCIA: Redis no está corriendo o no es accesible
)

REM Iniciar la aplicación
echo Iniciando aplicación...
echo.
node src/index.js

pause
```

### stop-windows.bat
```batch
@echo off
echo ====================================
echo  Service Layer Integration - STOP
echo ====================================
echo.

REM Matar procesos de Node.js relacionados con la aplicación
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Service Layer*"

echo Aplicación detenida
pause
```

---

## 12. CONTACTOS Y SOPORTE

### 12.1 Escalamiento
| Nivel | Contacto | Responsabilidad |
|-------|----------|-----------------|
| L1 | Infraestructura | Instalación de software, configuración de red |
| L2 | Desarrollo (BlueSystemIO) | Configuración de aplicación, debugging |
| L3 | SAP Team | Conectividad SAP Service Layer |

### 12.2 Documentación Adicional
- Manual de instalación detallado: `/docs/INSTALLATION.md`
- Manual de troubleshooting: `/docs/TROUBLESHOOTING.md`
- API Documentation: Disponible en `/api-info`

---

## 13. VALIDACIÓN POST-INSTALACIÓN

### 13.1 Health Checks
```powershell
# Verificar que el servidor responde
Invoke-WebRequest -Uri "https://localhost:3443/health" -Method GET

# Verificar conectividad a SAP
Invoke-WebRequest -Uri "https://localhost:3443/api/sap-validation/databases/validate" -Method GET

# Verificar página de login
Invoke-WebRequest -Uri "https://localhost:3443/login" -Method GET
```

### 13.2 Criterios de Éxito
- ✅ Aplicación responde en puerto 3443
- ✅ PostgreSQL y Redis operativos
- ✅ Conexión exitosa a SAP Service Layer (4 bases de datos)
- ✅ Tipos de cambio se cargan correctamente
- ✅ Login funcional
- ✅ Certificados SSL válidos
- ✅ Rate limiting operativo
- ✅ Logs generándose correctamente

---

## RESUMEN EJECUTIVO

### Recursos Necesarios
- **Servidor:** Windows Server 2019/2022, 8 vCPU, 16 GB RAM, 200 GB SSD
- **Software:** Node.js 22.x, PostgreSQL 16, Redis 7.x
- **Puertos:** 3000 (HTTP), 3443 (HTTPS)
- **Conectividad:** SAP Service Layer en `https://sap-stiacmzdr-sl.skyinone.net:50000/`
- **Tiempo estimado de instalación:** 4-6 horas
- **Downtime estimado (migración):** 2-3 horas

### Prioridad
🔴 **ALTA** - Aplicación crítica para operaciones de negocio con SAP

---

**Preparado por:** Claude Code Assistant
**Fecha:** 2025-10-16
**Versión:** 1.0
