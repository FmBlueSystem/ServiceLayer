# Sistema de Permisos - Implementación

## 📋 Resumen

Sistema de permisos RBAC (Role-Based Access Control) que:
- ✅ Usa usuarios de SAP (sin duplicación)
- ✅ Autenticación contra Service Layer
- ✅ Autorización en PostgreSQL (rápida y local)
- ✅ Control granular por compañía y módulo
- ✅ Auditoría completa de acciones

---

## 🔄 Flujo del Sistema

### 1. **Sincronización de Usuarios** (Periódica/Manual)
```
Admin → Sincronizar Usuarios
          ↓
    SAP Costa Rica (OUSR)
          ↓
    PostgreSQL (sap_users)
```

### 2. **Configuración de Permisos** (Admin)
```
Admin → Asignar Roles a Usuarios
          ↓
    PostgreSQL (user_roles)
```

### 3. **Login de Usuario**
```
Usuario → Credenciales
    ↓
Service Layer (Multi-compañía)
    ↓
PostgreSQL (cargar permisos)
    ↓
Frontend (mostrar solo módulos permitidos)
```

### 4. **Cada Acción del Usuario**
```
Usuario → Click en Módulo
    ↓
Frontend: Verifica si tiene el botón/módulo
    ↓
Backend: Middleware verifica permiso (1-5ms)
    ↓
Si OK: Ejecuta acción en SAP
    ↓
Log de Auditoría
```

---

## 🚀 Instalación

### Paso 1: Crear Base de Datos
```bash
# Ejecutar migración SQL
psql -U postgres -d myapp -f database/migrations/001_create_permissions_tables.sql
```

### Paso 2: Inicializar Sistema
```bash
# Ejecutar script de inicialización
node scripts/init-permissions.js
```

Esto creará:
- ✅ Tablas: `sap_users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_log`
- ✅ 8 roles predefinidos
- ✅ 30+ permisos de recursos
- ✅ Usuario `stifmolina2` como `super_admin` con acceso total

### Paso 3: Registrar Rutas de Admin
```javascript
// En src/index.js o donde configures tus rutas

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
```

### Paso 4: Actualizar Login para Cargar Permisos

Modificar `src/routes/sap.js` en el endpoint `/login-all`:

```javascript
const permissionService = require('../services/permissionService');

router.post('/login-all', async (req, res) => {
    try {
        const { username, password, databases } = req.body;

        // Tu código actual de autenticación SAP...
        // ...

        if (loginResult.success) {
            // NUEVO: Cargar permisos del usuario
            const permissions = await permissionService.getUserPermissions(username);
            const authorizedCompanies = await permissionService.getUserAuthorizedCompanies(username);

            // Guardar en sesión
            req.session.sapUsername = username;
            req.session.sapSessions = loginResult.sessions;

            res.json({
                success: true,
                username,
                sessions: loginResult.sessions,
                permissions,           // NUEVO
                authorizedCompanies    // NUEVO
            });
        }
    } catch (error) {
        // ...
    }
});
```

---

## 📚 Uso en Rutas

### Ejemplo: Proteger Ruta de Tipos de Cambio

```javascript
// src/routes/sap.js

const { checkPermission, RESOURCES, ACTIONS } = require('../middleware/authorization');

// Ver tipos de cambio
router.post('/exchange-rates',
    checkPermission(RESOURCES.TIPOS_CAMBIO, ACTIONS.VIEW),
    async (req, res) => {
        // Tu lógica actual...
    }
);

// Actualizar tipos de cambio
router.post('/exchange-rates/update',
    checkPermission(RESOURCES.TIPOS_CAMBIO, ACTIONS.REFRESH),
    async (req, res) => {
        // Tu lógica actual...
    }
);
```

### Ejemplo: Proteger Rutas de Órdenes de Venta

```javascript
// Ver órdenes
router.post('/sales-orders',
    checkPermission(RESOURCES.ORDENES_VENTA, ACTIONS.VIEW),
    async (req, res) => {
        // Tu lógica...
    }
);

// Crear orden
router.post('/sales-orders/create',
    checkPermission(RESOURCES.ORDENES_VENTA, ACTIONS.CREATE),
    async (req, res) => {
        // Tu lógica...
    }
);
```

---

## 🎨 Frontend Dinámico

### Cargar Permisos en el Login

```javascript
// public/login.html o donde manejes el login

async function handleLogin(username, password) {
    const response = await fetch('/api/sap/login-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, databases })
    });

    const data = await response.json();

    if (data.success) {
        // Guardar permisos en localStorage
        localStorage.setItem('userPermissions', JSON.stringify(data.permissions));
        localStorage.setItem('authorizedCompanies', JSON.stringify(data.authorizedCompanies));

        window.location.href = '/dashboard';
    }
}
```

### Mostrar Solo Módulos Permitidos

```javascript
// public/dashboard.html

function hasPermission(resource, action) {
    const permissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    return permissions.some(p =>
        p.resource === resource && p.action === action
    );
}

function renderDashboard() {
    let html = '<div class="modules-grid">';

    // Tipos de Cambio
    if (hasPermission('tipos_cambio', 'view')) {
        html += `
            <a href="/tipos-cambio" class="module-card">
                <i class="fas fa-exchange-alt"></i>
                <h3>Tipos de Cambio</h3>
            </a>
        `;
    }

    // Órdenes de Venta
    if (hasPermission('ordenes_venta', 'view')) {
        html += `
            <a href="/ordenes-venta" class="module-card">
                <i class="fas fa-shopping-cart"></i>
                <h3>Órdenes de Venta</h3>
            </a>
        `;
    }

    // Administración (solo si tiene permiso)
    if (hasPermission('usuarios', 'view')) {
        html += `
            <a href="/admin/usuarios" class="module-card">
                <i class="fas fa-users-cog"></i>
                <h3>Administración</h3>
            </a>
        `;
    }

    html += '</div>';
    document.getElementById('modules').innerHTML = html;
}
```

### Ocultar Botones Según Permisos

```javascript
// public/ordenes-venta.html

function renderActions() {
    let html = '';

    if (hasPermission('ordenes_venta', 'create')) {
        html += `<button onclick="createOrder()" class="btn btn-primary">
            Nueva Orden
        </button>`;
    }

    if (hasPermission('ordenes_venta', 'export')) {
        html += `<button onclick="exportOrders()" class="btn btn-secondary">
            Exportar
        </button>`;
    }

    document.getElementById('actions').innerHTML = html;
}
```

---

## 👥 Administración de Usuarios

### 1. Sincronizar Usuarios desde SAP

```bash
# API Call
POST /api/admin/users/sync
{
    "companyDB": "SBO_STIACR_PROD"  # Opcional, por defecto Costa Rica
}

# Respuesta
{
    "success": true,
    "total": 25,
    "synced": 3,    # Nuevos usuarios
    "updated": 22   # Usuarios actualizados
}
```

### 2. Listar Usuarios

```bash
GET /api/admin/users?is_active=true&search=molina

# Respuesta
{
    "success": true,
    "users": [
        {
            "username": "stifmolina2",
            "full_name": "Administrator",
            "email": "admin@stia.com",
            "is_active": true,
            "roles": [
                {
                    "role": "super_admin",
                    "role_description": "Acceso total",
                    "company_db": "*"
                }
            ]
        }
    ]
}
```

### 3. Asignar Rol a Usuario

```bash
POST /api/admin/users/jperez/roles
{
    "roleId": 7,              # ID del rol 'user'
    "companyDB": "SBO_GT_STIA_PROD"  # Solo Guatemala
}
```

### 4. Remover Rol

```bash
DELETE /api/admin/users/jperez/roles/7?companyDB=SBO_GT_STIA_PROD
```

---

## 🔐 Roles Predefinidos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `super_admin` | Acceso total | TODOS |
| `admin_cr` | Admin Costa Rica | Todos excepto config |
| `admin_gt` | Admin Guatemala | Todos excepto config |
| `admin_hn` | Admin Honduras | Todos excepto config |
| `admin_pa` | Admin Panamá | Todos excepto config |
| `manager` | Gestor | Crear, editar, exportar |
| `user` | Usuario | Ver, crear órdenes, exportar |
| `viewer` | Solo lectura | Solo ver |

---

## 📊 Recursos y Acciones Disponibles

### Recursos

- `dashboard` - Dashboard principal
- `tipos_cambio` - Tipos de cambio
- `ordenes_venta` - Órdenes de venta
- `ofertas_venta` - Ofertas de venta
- `fichas_tecnicas` - Fichas técnicas
- `articulos` - Artículos
- `reportes_eeff` - Reportes financieros
- `udo_test` - Herramienta diagnóstico
- `usuarios` - Gestión de usuarios
- `configuracion` - Configuración del sistema
- `auditoria` - Logs de auditoría

### Acciones

- `view` - Ver/Consultar
- `create` - Crear
- `update` - Actualizar
- `delete` - Eliminar
- `export` - Exportar
- `manage` - Gestionar (admin)
- `sync` - Sincronizar
- `refresh` - Refrescar
- `cancel` - Cancelar

---

## 📝 Auditoría

Todas las acciones se registran automáticamente en `audit_log`:

```bash
GET /api/admin/audit-logs?username=stifmolina2&resource=ordenes_venta&limit=50

# Respuesta
{
    "success": true,
    "logs": [
        {
            "id": 1234,
            "username": "stifmolina2",
            "action": "create",
            "resource": "ordenes_venta",
            "company_db": "SBO_GT_STIA_PROD",
            "details": { "order_id": "SO-12345" },
            "ip_address": "10.13.1.49",
            "success": true,
            "created_at": "2025-10-16T10:30:00Z"
        }
    ]
}
```

---

## 🔧 Mantenimiento

### Ver Estado del Sistema

```sql
-- Total de usuarios
SELECT COUNT(*) FROM sap_users WHERE is_active = true;

-- Usuarios por rol
SELECT r.name, COUNT(ur.username) as users
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id
GROUP BY r.name
ORDER BY users DESC;

-- Últimas acciones
SELECT username, action, resource, created_at
FROM audit_log
ORDER BY created_at DESC
LIMIT 20;
```

### Resincronizar Usuarios

Se recomienda sincronizar usuarios cada semana o cuando:
- Se crea un nuevo usuario en SAP
- Se desactiva un usuario en SAP
- Cambian nombres o emails

---

## ⚡ Performance

- ✅ Verificación de permisos: **1-5ms** (PostgreSQL local)
- ✅ Sin impacto en SAP Service Layer
- ✅ Queries optimizados con índices
- ✅ Sin necesidad de cache

---

## 🛡️ Seguridad

1. **Doble validación**: Frontend (UX) + Backend (seguridad)
2. **Sesiones seguras**: Express session con Redis
3. **Auditoría completa**: Todas las acciones loggeadas
4. **Usuario inactivo**: Si `is_active=false` no puede entrar
5. **Roles inmutables**: `is_system_role=true` no se pueden eliminar

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs: `SELECT * FROM audit_log WHERE success = false`
2. Verificar permisos de un usuario: `GET /api/admin/users/{username}`
3. Revisar roles asignados: `SELECT * FROM user_roles WHERE username = 'xxx'`

---

Implementado por BlueSystemIO - 2025
