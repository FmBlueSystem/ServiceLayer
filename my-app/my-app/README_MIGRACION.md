# 📦 Paquete Completo de Migración a Windows Server

## 📋 Resumen Ejecutivo

Este paquete contiene **toda la documentación, scripts y herramientas** necesarias para migrar exitosamente la aplicación SAP Service Layer de Linux Ubuntu a Windows Server.

**Estado actual:** ✅ Documentación completa - Pendiente de servidor Windows

---

## 📚 Documentación Incluida

### 1. **MIGRACION_WINDOWS_SERVER.md** (30KB - **DOCUMENTO PRINCIPAL**)
   - Guía completa paso a paso de la migración
   - 11 fases detalladas con comandos PowerShell
   - Solución de problemas comunes
   - Scripts de instalación y configuración
   - Checklist final de verificación

### 2. **REQUISITOS_INFRAESTRUCTURA_WINDOWS.md** (13KB)
   - Especificaciones de hardware necesarias
   - Software y dependencias requeridas
   - Configuración de red y puertos
   - Requisitos de seguridad

### 3. **CHECKLIST_MIGRACION_WINDOWS.md** (12KB)
   - Lista de verificación paso a paso
   - Puntos de control críticos
   - Validaciones en cada fase

### 4. **IMPLEMENTACION_PERMISOS.md** (11KB)
   - Sistema RBAC implementado
   - Gestión de roles y grupos
   - Asignación de páginas y permisos
   - Auditoría de cambios

### 5. **RENOVACION_AUTOMATICA_SESION.md** (11KB)
   - Sistema de renovación automática de sesión SAP
   - Manejo de credenciales encriptadas
   - Frontend y backend integration
   - Ejemplos de uso

---

## 🛠️ Scripts de Windows Incluidos

### Scripts PowerShell (ubicación: `scripts/windows/`)

#### **check-status.ps1**
Verifica el estado completo del sistema:
- ✅ Servicio principal
- ✅ PostgreSQL
- ✅ Redis
- ✅ Puertos (3000, 3443, 5432, 6379)
- ✅ Uso de recursos (CPU, RAM, Disco)
- ✅ Procesos Node.js
- ✅ Logs recientes
- ✅ Test de conectividad

**Uso:**
```powershell
.\scripts\windows\check-status.ps1
```

#### **backup-database.ps1**
Backup automático de PostgreSQL:
- 💾 Backup en formato custom (.dump)
- 🗜️ Compresión automática (.zip)
- 🗑️ Limpieza de backups antiguos (>30 días)
- 📊 Estadísticas de espacio
- 📝 Log detallado

**Uso:**
```powershell
# Backup por defecto
.\scripts\windows\backup-database.ps1

# Personalizado
.\scripts\windows\backup-database.ps1 -BackupDir "D:\backups" -RetentionDays 60
```

### Scripts Batch (raíz del proyecto)

#### **install-service-windows.bat**
Instala la aplicación como servicio de Windows usando NSSM
- Configura servicio automático
- Establece logs
- Configura reinicio en fallas

#### **start-windows.bat**
Inicia el servicio SAP-ServiceLayer

#### **stop-windows.bat**
Detiene el servicio SAP-ServiceLayer

---

## 📂 Estructura del Proyecto

```
my-app/
├── src/                          # Código fuente de la aplicación
│   ├── index.js                  # Punto de entrada
│   ├── config/                   # Configuración
│   ├── routes/                   # Rutas API
│   ├── services/                 # Lógica de negocio
│   └── middleware/               # Middleware Express
│
├── public/                       # Archivos estáticos
│   ├── *.html                    # Páginas web
│   ├── js/                       # JavaScript frontend
│   └── css/                      # Estilos
│
├── database/                     # Migraciones y schemas
│   └── migrations/               # Scripts SQL
│
├── docker/                       # Configuración Docker
│   └── ssl/                      # Certificados SSL
│       ├── server.key            # Clave privada
│       └── server.crt            # Certificado
│
├── scripts/                      # Scripts de utilidad
│   └── windows/                  # Scripts PowerShell
│       ├── check-status.ps1
│       ├── backup-database.ps1
│       └── [otros scripts]
│
├── logs/                         # Logs de aplicación (creado en runtime)
├── backups/                      # Backups BD (creado en runtime)
│
├── package.json                  # Dependencias npm
├── .env                          # Variables de entorno (crear desde .env.template)
├── .env.template                 # Plantilla de variables
│
└── Documentación:
    ├── README_MIGRACION.md       ← ESTE ARCHIVO
    ├── MIGRACION_WINDOWS_SERVER.md    ← GUÍA PRINCIPAL
    ├── REQUISITOS_INFRAESTRUCTURA_WINDOWS.md
    ├── CHECKLIST_MIGRACION_WINDOWS.md
    ├── IMPLEMENTACION_PERMISOS.md
    └── RENOVACION_AUTOMATICA_SESION.md
```

---

## 🚀 Inicio Rápido

### Cuando el Servidor Windows esté listo:

1. **Preparación del Servidor**
   ```powershell
   # Leer e implementar:
   - REQUISITOS_INFRAESTRUCTURA_WINDOWS.md (preparar servidor)
   - MIGRACION_WINDOWS_SERVER.md (FASE 1: instalación de software)
   ```

2. **Backup desde Linux**
   ```bash
   # En el servidor Linux actual:
   cd /home/bluesystem/Documents/ServiceLayer/my-app/my-app

   # Seguir MIGRACION_WINDOWS_SERVER.md - FASE 2
   # - Backup de PostgreSQL
   # - Empaquetar proyecto
   ```

3. **Transferencia**
   ```powershell
   # Usar WinSCP, SCP o Git
   # Ver MIGRACION_WINDOWS_SERVER.md - FASE 3
   ```

4. **Instalación en Windows**
   ```powershell
   cd C:\proyecto\sap-servicelayer

   # Seguir MIGRACION_WINDOWS_SERVER.md - FASE 4
   # - Descomprimir archivos
   # - Configurar .env
   # - Instalar dependencias: npm install
   # - Restaurar base de datos
   ```

5. **Configurar Servicio**
   ```powershell
   # Seguir MIGRACION_WINDOWS_SERVER.md - FASE 6
   # Opción A: Usar NSSM (ejecutar install-service-windows.bat)
   # Opción B: Usar PM2
   ```

6. **Validación**
   ```powershell
   # Ejecutar script de validación
   .\scripts\windows\check-status.ps1

   # Seguir MIGRACION_WINDOWS_SERVER.md - FASE 7
   ```

---

## 🔐 Información Necesaria para Migración

### Del Servidor Linux Actual

✅ **Base de Datos PostgreSQL**
- Host: localhost
- Puerto: 5432
- Database: myapp
- Usuario: postgres
- Backup: Se creará durante FASE 2

✅ **Aplicación Node.js**
- Versión Node: v22.19.0
- Puerto HTTP: 3000
- Puerto HTTPS: 3443
- Directorio: `/home/bluesystem/Documents/ServiceLayer/my-app/my-app`

✅ **Redis**
- Host: localhost
- Puerto: 6379
- Sin contraseña

### Para el Servidor Windows (A completar)

❓ **Servidor**
- IP/Hostname: [PENDIENTE]
- Usuario Windows: [PENDIENTE]
- Contraseña: [PENDIENTE]
- Versión Windows: [PENDIENTE]

❓ **PostgreSQL**
- Contraseña postgres: [PENDIENTE]

❓ **Acceso SSH (para Claude)**
- Usuario SSH: [PENDIENTE]
- Contraseña/Key: [PENDIENTE]
- Puerto SSH: 22 (default)

---

## 🔧 Componentes de la Aplicación

### Tecnologías

- **Backend:** Node.js + Express
- **Base de Datos:** PostgreSQL 16
- **Cache:** Redis
- **Autenticación:** SAP Service Layer + Session-based
- **SSL/TLS:** Certificados auto-firmados (o Let's Encrypt)

### Funcionalidades Principales

1. **Autenticación Multi-Database SAP**
   - Login simultáneo a 5 bases de datos SAP
   - Renovación automática de sesiones
   - Gestión de credenciales encriptadas

2. **Sistema de Permisos RBAC**
   - Roles personalizables
   - Permisos granulares (recursos + acciones)
   - Asignación de páginas a grupos
   - Auditoría de cambios

3. **Gestión de Usuarios**
   - Sincronización desde SAP
   - Activación/Desactivación
   - Asignación de roles

4. **Dashboard Dinámico**
   - Páginas según permisos de usuario
   - Ordenamiento configurable (drag & drop)
   - Cards dinámicas con iconos

5. **Configuración del Sistema**
   - Configuración dinámica sin reinicio
   - Gestión de grupos y páginas
   - Auditoría de configuración

### Endpoints Críticos

```
GET  /health                          # Health check
POST /api/sap/login-all              # Login multi-database
POST /api/sap/renew-session          # Renovación automática
GET  /api/admin/pages                # Listar páginas
PUT  /api/admin/pages/reorder        # Reordenar páginas
GET  /api/admin/roles                # Listar roles
GET  /api/admin/users                # Listar usuarios
GET  /api/admin/menu/my-pages        # Páginas del usuario
```

---

## 📊 Base de Datos

### Tablas Principales

```sql
users              -- Usuarios del sistema (sincronizados desde SAP)
roles              -- Roles/Grupos de permisos
permissions        -- Permisos granulares (resource:action)
pages              -- Páginas disponibles en el sistema
role_pages         -- Asignación de páginas a roles
user_roles         -- Asignación de usuarios a roles
role_permissions   -- Asignación de permisos a roles
system_config      -- Configuración del sistema
config_audit       -- Auditoría de cambios de configuración
```

### Datos Importantes a Migrar

- ~10 páginas del sistema
- Roles/grupos configurados
- Usuarios sincronizados desde SAP
- Configuración del sistema
- Historial de auditoría

---

## 🔍 Validación Post-Migración

### Checklist Rápido

```powershell
# 1. Verificar servicios
Get-Service "SAP-ServiceLayer", "postgresql-x64-16", "redis"

# 2. Verificar puertos
Test-NetConnection -ComputerName localhost -Port 3443
Test-NetConnection -ComputerName localhost -Port 3000

# 3. Test de conectividad
curl -k https://localhost:3443/health

# 4. Verificar base de datos
psql -U postgres -d myapp -c "SELECT COUNT(*) FROM users;"

# 5. Ejecutar script completo
.\scripts\windows\check-status.ps1
```

---

## 🆘 Soporte y Contacto

### Cuando el Servidor esté Listo

1. ✅ Completar información del servidor en MIGRACION_WINDOWS_SERVER.md - FASE 11
2. ✅ Configurar acceso SSH
3. ✅ Notificar a Claude con:
   - IP del servidor
   - Credenciales SSH
   - Estado de instalación actual

### Claude ejecutará:

```bash
# Conexión SSH
ssh usuario@IP_SERVIDOR

# Verificación de estado
cd C:\proyecto\sap-servicelayer
.\scripts\windows\check-status.ps1

# Asistencia con cualquier problema encontrado
```

---

## 📅 Timeline Estimado

| Fase | Descripción | Tiempo Estimado |
|------|-------------|----------------|
| 1 | Preparación servidor Windows | 2-3 horas |
| 2 | Backup y empaquetado (Linux) | 30 minutos |
| 3 | Transferencia de archivos | 15-30 minutos |
| 4 | Instalación en Windows | 1-2 horas |
| 5 | Pruebas iniciales | 30 minutos |
| 6 | Configurar servicio | 30 minutos |
| 7 | Validación completa | 1 hora |
| 8 | Backups automáticos | 30 minutos |
| 9 | Monitoreo | 30 minutos |
| 10 | Seguridad | 1 hora |
| **TOTAL** | | **6-9 horas** |

---

## ⚠️ Notas Importantes

1. **Backup:** Hacer backup completo de PostgreSQL antes de migrar
2. **Contraseñas:** Cambiar todas las contraseñas de ejemplo por contraseñas seguras
3. **Secrets:** Generar nuevos SESSION_SECRET y SESSION_ENCRYPTION_KEY
4. **Certificados:** Considerar certificados SSL válidos para producción
5. **Testing:** Probar exhaustivamente antes de poner en producción
6. **Documentación:** Mantener actualizada con IPs y credenciales reales
7. **Acceso SSH:** Fundamental para supervisión remota de Claude

---

## 📁 Archivos de Configuración Importantes

### .env (Variables de Entorno)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=[CAMBIAR]

REDIS_HOST=localhost
REDIS_PORT=6379

SESSION_SECRET=[GENERAR NUEVO]
SESSION_ENCRYPTION_KEY=[GENERAR NUEVO]

LOG_LEVEL=info
NODE_ENV=production

PORT=3000
HTTPS_PORT=3443
```

### Generar Secrets
```powershell
# SESSION_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🎯 Estado Actual

**✅ COMPLETADO:**
- [x] Documentación completa de migración
- [x] Scripts de Windows (PowerShell)
- [x] Scripts de backup automático
- [x] Scripts de monitoreo
- [x] Documentación de funcionalidades
- [x] Checklist de validación

**⏳ PENDIENTE:**
- [ ] Servidor Windows disponible
- [ ] Instalación de software base
- [ ] Transferencia de archivos
- [ ] Configuración del servicio
- [ ] Pruebas en producción
- [ ] Configuración de acceso SSH para Claude

---

## 📞 Próximos Pasos

Cuando el servidor Windows esté listo:

1. **Revisar:** REQUISITOS_INFRAESTRUCTURA_WINDOWS.md
2. **Ejecutar:** MIGRACION_WINDOWS_SERVER.md paso a paso
3. **Validar:** check-status.ps1 en cada fase
4. **Contactar:** Claude con credenciales SSH para supervisión

---

**Fecha de preparación:** 2025-10-20
**Versión de documentación:** 1.0
**Estado:** ✅ Listo para migración - Esperando servidor Windows
**Preparado por:** Claude Code + BlueSystem Team

---

🎯 **Esta documentación contiene TODO lo necesario para una migración exitosa. Cuando el servidor esté listo, retomamos desde aquí.**
