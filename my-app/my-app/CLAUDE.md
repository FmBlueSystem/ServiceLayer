# 📋 INSTRUCCIONES PARA CLAUDE

Este archivo contiene instrucciones permanentes para Claude al trabajar en este proyecto.

---

## 🆕 AGREGAR NUEVAS PÁGINAS AL SISTEMA

**IMPORTANTE:** Cada vez que se cree una **nueva página HTML** en el directorio `public/`, se deben completar **TODOS** los siguientes pasos automáticamente:

### ✅ Checklist Obligatorio para Nuevas Páginas

#### 1. Crear el archivo HTML
- Ubicación: `/public/nombre-pagina.html`
- Debe incluir:
  - Sistema de autenticación (`checkAuth()`)
  - Session Manager (`/js/sessionManager.js`)
  - Usar `fetchWithAutoRenewal()` en lugar de `fetch()` para llamadas SAP
  - Menú de navegación estándar
  - Estilos del tema (`/css/app-theme.css`)

#### 2. Crear migración SQL
- Ubicación: `/database/migrations/XXX_add_nombre_pagina.sql`
- Formato del archivo:

```sql
-- =====================================================
-- AGREGAR PÁGINA: NOMBRE DE LA PÁGINA
-- =====================================================
-- Fecha: YYYY-MM-DD
-- Descripción: Breve descripción de la funcionalidad

-- Insertar la nueva página
INSERT INTO pages (name, path, icon, description, display_order, is_active) VALUES
('Nombre Visible', '/nombre-pagina.html', 'fas fa-icono', 'Descripción de la funcionalidad', <ORDER>, true)
ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Asignar la página al rol super_admin (id = 1)
INSERT INTO role_pages (role_id, page_id, granted_by)
SELECT 1, id, 'system'
FROM pages
WHERE path = '/nombre-pagina.html'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Verificar la inserción
SELECT
    p.id,
    p.name,
    p.path,
    p.icon,
    p.description,
    p.display_order,
    p.is_active,
    CASE
        WHEN EXISTS (SELECT 1 FROM role_pages rp WHERE rp.page_id = p.id AND rp.role_id = 1)
        THEN 'Asignado a super_admin'
        ELSE 'NO asignado'
    END as permission_status
FROM pages
WHERE path = '/nombre-pagina.html';
```

#### 3. Ejecutar la migración
```bash
node scripts/run-migration.js XXX_add_nombre_pagina.sql
```

#### 4. Verificar la integración
```bash
node scripts/verify-pages.js
```

#### 5. Verificar en API
```bash
curl -k -s https://10.13.1.83:3443/api/admin/menu/my-pages -H "x-sap-username: stifmolina2"
```

La nueva página debe aparecer en el JSON retornado.

---

## 🔑 GUÍA DE ICONOS FONT AWESOME

Usar iconos apropiados según la funcionalidad:

| Funcionalidad | Icono | Clase |
|--------------|-------|-------|
| Dashboard/Inicio | 🏠 | `fas fa-home` |
| Inventario/Almacén | 🏭 | `fas fa-warehouse` |
| Artículos/Productos | 📦 | `fas fa-box` |
| Ventas | 🛒 | `fas fa-shopping-cart` |
| Ofertas/Cotizaciones | 📄 | `fas fa-file-invoice` |
| Reportes/Gráficos | 📊 | `fas fa-chart-bar` |
| Configuración | ⚙️ | `fas fa-cog` |
| Usuarios/Permisos | 🛡️ | `fas fa-user-shield` |
| Documentos | 📋 | `fas fa-clipboard-list` |
| Finanzas | 💵 | `fas fa-dollar-sign` |
| Herramientas | 🔧 | `fas fa-wrench` |
| Pruebas/Test | 🧪 | `fas fa-vial` |

Ver más iconos en: https://fontawesome.com/icons

---

## 📊 ORDEN DE VISUALIZACIÓN (display_order)

El campo `display_order` determina el orden en que aparecen las páginas en el dashboard.

**Convención actual:**
- 1-10: Dashboards principales
- 11-20: Dashboards secundarios
- 21-30: Catálogos y consultas
- 31-50: Transacciones (ventas, compras)
- 51-70: Reportes
- 71-80: Herramientas
- 81-90: Pruebas/Diagnóstico
- 91-100: Administración y configuración

**Páginas actuales:**
```
10  - Dashboard principal
11  - Dashboard Inventario
20  - Artículos
30  - Fichas Técnicas
40  - Ofertas de Venta
50  - Órdenes de Venta
60  - Tipos de Cambio
70  - Reportes EEFF
80  - Test UDOs
90  - Admin Permisos
100 - Config Sistema
```

---

## 🔐 SISTEMA DE ROLES Y PERMISOS

### Roles Predefinidos

1. **super_admin** (ID: 1)
   - Acceso total al sistema
   - Todas las páginas nuevas se asignan automáticamente a este rol

2. **admin** (ID: 2)
   - Acceso administrativo limitado

3. **user** (ID: 3)
   - Usuario estándar

4. **Servicio Tecnico** (ID: 4)
   - Rol específico para técnicos

### Asignación de Permisos

**Por defecto:** Todas las páginas nuevas se asignan al rol `super_admin`.

**Para asignar a otros roles:**
```sql
INSERT INTO role_pages (role_id, page_id, granted_by)
SELECT <ROLE_ID>, id, 'system'
FROM pages
WHERE path = '/nombre-pagina.html'
ON CONFLICT (role_id, page_id) DO NOTHING;
```

---

## 🛠️ SCRIPTS ÚTILES

### 1. Ejecutar migración
```bash
node scripts/run-migration.js <archivo.sql>
```

### 2. Verificar páginas
```bash
node scripts/verify-pages.js
```

### 3. Crear backup de base de datos (Windows)
```powershell
.\scripts\windows\backup-database.ps1
```

### 4. Verificar estado del sistema (Windows)
```powershell
.\scripts\windows\check-status.ps1
```

---

## 📝 PLANTILLA DE PÁGINA HTML

Al crear una nueva página, usar esta estructura base:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nombre de la Página - SAP Service Layer</title>

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <!-- App Theme -->
    <link rel="stylesheet" href="/css/app-theme.css">

    <!-- Session Manager -->
    <script src="/js/sessionManager.js"></script>

    <!-- Inactivity Manager - Auto logout después de 15 minutos -->
    <script src="/js/inactivityManager.js"></script>
</head>
<body>
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <a class="navbar-brand" href="/dashboard.html">
                <i class="fas fa-industry"></i> SAP Service Layer
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <span class="navbar-text text-light me-3">
                            <i class="fas fa-user"></i>
                            <span id="displayUsername">Usuario</span>
                        </span>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/dashboard.html">
                            <i class="fas fa-home"></i> Dashboard
                        </a>
                    </li>
                    <li class="nav-item">
                        <button class="btn btn-outline-light btn-sm" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="container-fluid mt-4">
        <h1><i class="fas fa-icono"></i> Nombre de la Página</h1>

        <!-- Contenido específico de la página -->

    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Scripts -->
    <script>
        // Verificar autenticación
        function checkAuth() {
            const username = localStorage.getItem('username');
            const sessionId = localStorage.getItem('sessionId');

            if (!username || !sessionId) {
                window.location.href = '/login-simple.html';
                return false;
            }

            document.getElementById('displayUsername').textContent = username;
            return true;
        }

        // Logout
        function logout() {
            localStorage.clear();
            window.location.href = '/login-simple.html';
        }

        // Inicializar
        document.addEventListener('DOMContentLoaded', function() {
            if (!checkAuth()) return;

            // Inicializar funcionalidades específicas de la página
        });
    </script>
</body>
</html>
```

---

## 🔄 SESSION RENEWAL

**IMPORTANTE:** Todas las llamadas al API de SAP deben usar `fetchWithAutoRenewal()`:

```javascript
// ❌ INCORRECTO
const response = await fetch('/api/sap/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

// ✅ CORRECTO
const response = await fetchWithAutoRenewal('/api/sap/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
```

Esto asegura que si la sesión SAP expira, se renueve automáticamente sin que el usuario tenga que volver a iniciar sesión.

---

## ⏱️ AUTO-LOGOUT POR INACTIVIDAD

**IMPORTANTE:** El sistema incluye un gestor de inactividad que cierra automáticamente la sesión después de 15 minutos sin actividad del usuario.

### Características

- **Tiempo de Inactividad**: 15 minutos (configurable)
- **Advertencia**: Se muestra una notificación 2 minutos antes del logout (a los 13 minutos)
- **Eventos Monitoreados**: Mouse, teclado, scroll, touch, clicks
- **Auto-inicialización**: Se activa automáticamente en todas las páginas excepto login

### Configuración Personalizada (Opcional)

```javascript
// Personalizar tiempos en una página específica
document.addEventListener('DOMContentLoaded', function() {
    // Configurar 30 minutos de inactividad en lugar de 15
    InactivityManager.configure({
        inactivityMinutes: 30,  // Tiempo total hasta logout
        warningMinutes: 28,     // Tiempo hasta mostrar advertencia
        loginUrl: '/login-simple.html',  // URL de redirección
        debug: false  // Desactivar logs en producción
    });
});
```

### Deshabilitar en Páginas Específicas

```javascript
// Detener el manager de inactividad (si es necesario)
InactivityManager.stop();
```

### Notificaciones

1. **Advertencia (13 minutos)**: Modal animado con opción "Mantener Sesión Activa"
2. **Logout (15 minutos)**: Notificación de cierre de sesión y redirección automática

El sistema limpia completamente el localStorage y sessionStorage antes de redirigir al login.

---

## 📦 ESTRUCTURA DEL PROYECTO

```
my-app/
├── public/                    # Páginas HTML del frontend
│   ├── dashboard.html
│   ├── articulos.html
│   ├── dashboard-inventario.html
│   └── ...
├── src/
│   ├── index.js              # Punto de entrada
│   ├── routes/               # Rutas del API
│   │   ├── api.js
│   │   ├── sap.js
│   │   └── admin.js
│   ├── services/             # Lógica de negocio
│   │   ├── sapService.js
│   │   ├── sessionRenewalService.js
│   │   └── permissionService.js
│   └── middleware/           # Middleware Express
├── database/
│   └── migrations/           # Scripts SQL de migración
├── scripts/                  # Scripts de utilidad
│   ├── run-migration.js
│   ├── verify-pages.js
│   └── windows/             # Scripts PowerShell para Windows
└── docs/                     # Documentación adicional
```

---

## 🚨 ERRORES COMUNES AL AGREGAR PÁGINAS

### 1. ❌ No agregar la página a la base de datos
**Resultado:** La página existe pero no aparece en el dashboard dinámico.

**Solución:** Crear y ejecutar la migración SQL.

### 2. ❌ No asignar permisos a ningún rol
**Resultado:** La página existe pero nadie puede verla.

**Solución:** Asignar al menos al rol `super_admin`.

### 3. ❌ No incluir sessionManager.js
**Resultado:** La sesión expira y el usuario debe volver a loguearse.

**Solución:** Incluir `<script src="/js/sessionManager.js"></script>` y usar `fetchWithAutoRenewal()`.

### 4. ❌ No verificar autenticación
**Resultado:** Usuarios no autenticados pueden acceder a la página.

**Solución:** Incluir función `checkAuth()` y llamarla en `DOMContentLoaded`.

### 5. ❌ Usar display_order duplicado
**Resultado:** Orden impredecible en el dashboard.

**Solución:** Consultar las páginas existentes y elegir un número único según la convención.

---

## 📚 DOCUMENTACIÓN RELACIONADA

- **Sistema de Permisos:** `/IMPLEMENTACION_PERMISOS.md`
- **Renovación de Sesión Single-Database:** `/RENOVACION_AUTOMATICA_SESION.md`
- **Renovación de Sesión Multi-Database:** `/RENOVACION_MULTI_DATABASE.md`
- **Migración a Windows:** `/MIGRACION_WINDOWS_SERVER.md`
- **Guía de Ofertas:** `/OFERTAS_VENTA_GUIA_INTEGRACION.md`

---

## 🎯 RESUMEN: PROCESO COMPLETO

Cuando se te pida crear una nueva página:

1. ✅ **Crear** el archivo HTML en `/public/`
2. ✅ **Incluir** Session Manager y autenticación
3. ✅ **Crear** migración SQL en `/database/migrations/`
4. ✅ **Ejecutar** migración con `node scripts/run-migration.js`
5. ✅ **Verificar** con `node scripts/verify-pages.js`
6. ✅ **Probar** endpoint `/api/admin/menu/my-pages`
7. ✅ **Confirmar** que aparece en el dashboard

**NO OMITIR NINGÚN PASO.**

---

**Última actualización:** 2025-10-20
**Versión:** 1.0
**Autor:** Claude Code + BlueSystem Team
