# Configuración de Usuarios No Administradores
## Sistema Multi-Regional SAP Service Layer

---

## 📊 RESUMEN DE CONFIGURACIÓN

Se han configurado **4 usuarios no administradores** con acceso a **6 páginas** del sistema.

---

## 👥 USUARIOS CONFIGURADOS

| Usuario | Rol | Páginas | CompanyDB |
|---------|-----|---------|-----------|
| **Consultas** | user | 6 | SBO_STIACR_PROD |
| **stibmendez** | user | 6 | SBO_STIACR_PROD |
| **stieramirez** | user | 6 | SBO_STIACR_PROD |
| **stidrivas** | Servicio Tecnico | 7 | SBO_STIACR_PROD |

---

## 📄 PÁGINAS ACCESIBLES

Todos los usuarios no administradores tienen acceso a:

1. **Dashboard Inventario** (`/dashboard-inventario.html`)
   - Reportes de stock
   - Consultas de inventario
   - Movimientos de productos

2. **Artículos** (`/articulos.html`)
   - Consulta de catálogo
   - Búsqueda multi-compañía
   - Vista de detalles

3. **Fichas Técnicas** (`/fichas-tecnicas.html`)
   - Especificaciones de productos
   - Información técnica detallada
   - Búsqueda de artículos

4. **Ofertas de Venta** (`/ofertas-venta.html`)
   - Creación de ofertas
   - Búsqueda de clientes
   - Consulta de ofertas
   - Conversión a órdenes

5. **Órdenes de Venta** (`/ordenes-venta.html`)
   - Consulta de órdenes
   - Búsqueda por cliente
   - Filtros por fecha
   - Vista de detalles

6. **Tipos de Cambio** (`/tipos-cambio.html`)
   - Consulta de tasas
   - Histórico de cambios
   - Conversión de monedas

---

## 🔧 ESTRUCTURA DE LA CONFIGURACIÓN

### **Tabla: user_roles**

Almacena la asignación de usuarios SAP a roles:

```sql
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    company_db VARCHAR(100),
    granted_by VARCHAR(100),
    granted_at TIMESTAMP DEFAULT NOW()
);
```

**Usuarios configurados:**
```sql
INSERT INTO user_roles (username, role_id, company_db, granted_by)
VALUES
    ('Consultas', 7, 'SBO_STIACR_PROD', 'system'),
    ('stibmendez', 7, 'SBO_STIACR_PROD', 'system'),
    ('stieramirez', 7, 'SBO_STIACR_PROD', 'system'),
    ('stidrivas', 17, 'SBO_STIACR_PROD', 'system');
```

### **Tabla: role_pages**

Define qué páginas puede ver cada rol:

```sql
-- Páginas del rol 'user' (ID 7)
INSERT INTO role_pages (role_id, page_id)
VALUES
    (7, 11),  -- Dashboard Inventario
    (7, 6),   -- Artículos
    (7, 5),   -- Fichas Técnicas
    (7, 4),   -- Ofertas de Venta
    (7, 3),   -- Órdenes de Venta
    (7, 2);   -- Tipos de Cambio

-- Páginas del rol 'Servicio Tecnico' (ID 17)
INSERT INTO role_pages (role_id, page_id)
VALUES
    (17, 11), -- Dashboard Inventario
    (17, 6),  -- Artículos
    (17, 5),  -- Fichas Técnicas
    (17, 4),  -- Ofertas de Venta
    (17, 3),  -- Órdenes de Venta
    (17, 2);  -- Tipos de Cambio
```

---

## 🚀 CÓMO AGREGAR UN NUEVO USUARIO NO-ADMIN

### **Opción 1: Usar Rol Existente (Recomendado)**

Si el usuario debe tener las mismas páginas que los demás:

```sql
INSERT INTO user_roles (username, role_id, company_db, granted_by, granted_at)
VALUES ('[USERNAME_SAP]', 7, 'SBO_STIACR_PROD', 'system', NOW());
```

**Ejemplo:**
```sql
INSERT INTO user_roles (username, role_id, company_db, granted_by, granted_at)
VALUES ('nuevousuario', 7, 'SBO_STIACR_PROD', 'system', NOW());
```

### **Opción 2: Crear Rol Personalizado**

Si el usuario necesita permisos específicos:

1. **Crear el rol:**
```sql
INSERT INTO roles (name, description)
VALUES ('custom_role', 'Descripción del rol personalizado')
RETURNING id;
```

2. **Asignar páginas al rol:**
```sql
INSERT INTO role_pages (role_id, page_id)
VALUES
    ([ROLE_ID], 6),  -- Artículos
    ([ROLE_ID], 4);  -- Ofertas
```

3. **Asignar usuario al rol:**
```sql
INSERT INTO user_roles (username, role_id, company_db, granted_by)
VALUES ('[USERNAME]', [ROLE_ID], 'SBO_STIACR_PROD', 'system');
```

### **Opción 3: Usar Script Node.js**

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: 'myapp_user',
  host: 'localhost',
  database: 'myapp',
  password: 'FmDiosMio1',
  port: 5432,
});

async function addUser(username, roleId = 7, companyDB = 'SBO_STIACR_PROD') {
  try {
    const result = await pool.query(`
      INSERT INTO user_roles (username, role_id, company_db, granted_by, granted_at)
      VALUES ($1, $2, $3, 'system', NOW())
      RETURNING *
    `, [username, roleId, companyDB]);

    console.log('✅ Usuario agregado:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Uso:
addUser('nuevousuario', 7, 'SBO_STIACR_PROD');
```

---

## 🔍 CONSULTAS ÚTILES

### **Ver usuarios y sus páginas:**
```sql
SELECT
    ur.username,
    r.name as rol,
    COUNT(DISTINCT p.id) as num_paginas
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_pages rp ON r.id = rp.role_id
LEFT JOIN pages p ON rp.page_id = p.id
GROUP BY ur.username, r.name
ORDER BY ur.username;
```

### **Ver páginas de un usuario específico:**
```sql
SELECT DISTINCT p.name, p.path
FROM pages p
INNER JOIN role_pages rp ON p.id = rp.page_id
INNER JOIN user_roles ur ON rp.role_id = ur.role_id
WHERE ur.username = 'stibmendez'
ORDER BY p.display_order;
```

### **Ver todos los usuarios con un rol:**
```sql
SELECT ur.username, ur.company_db
FROM user_roles ur
INNER JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'user'
ORDER BY ur.username;
```

### **Ver qué usuarios NO tienen acceso a una página:**
```sql
SELECT ur.username
FROM user_roles ur
WHERE NOT EXISTS (
    SELECT 1
    FROM role_pages rp
    INNER JOIN pages p ON rp.page_id = p.id
    WHERE rp.role_id = ur.role_id
    AND p.path = '/ofertas-venta.html'
);
```

---

## ⚠️ REQUISITOS EN SAP BUSINESS ONE

Para que los usuarios funcionen completamente, deben:

1. **Existir en SAP B1** con el mismo username
2. **Tener contraseña configurada**
3. **Tener autorizaciones SAP apropiadas**

### **Autorizaciones Mínimas Recomendadas:**

```
Administration → System Initialization → Authorizations → [USERNAME]

General Authorizations:
  ✓ Business Partners → Read Only
  ✓ Price Lists → Read Only

Sales - A/R:
  ✓ Sales Quotations → Full Authorization
  ✓ Sales Orders → Read Only

Inventory:
  ✓ Items - Master Data → Read Only
  ✓ Inventory Reports → Read Only

Financials:
  ✓ Exchange Rates → Read Only
```

---

## 📋 CHECKLIST PARA NUEVOS USUARIOS

```
□ 1. Crear usuario en SAP Business One
□ 2. Configurar contraseña en SAP
□ 3. Asignar autorizaciones SAP necesarias
□ 4. Agregar usuario a PostgreSQL (user_roles)
□ 5. Verificar que el rol tiene las páginas correctas
□ 6. Probar login en aplicación web
□ 7. Verificar acceso a todas las páginas
□ 8. Validar funcionalidad de cada módulo
```

---

## 🎯 ROLES DISPONIBLES

| ID | Nombre | Descripción | Páginas |
|----|--------|-------------|---------|
| 1 | super_admin | Acceso total | Todas |
| 2 | admin_cr | Admin Costa Rica | Admin |
| 3 | admin_gt | Admin Guatemala | Admin |
| 4 | admin_hn | Admin Honduras | Admin |
| 5 | admin_pa | Admin Panamá | Admin |
| 6 | manager | Gestor | Variables |
| 7 | **user** | Usuario estándar | **6 páginas** |
| 8 | viewer | Solo lectura | Variables |
| 17 | **Servicio Tecnico** | Técnicos | **7 páginas** |

---

## 🔄 MANTENIMIENTO

### **Agregar una página a todos los usuarios no-admin:**

```sql
-- Agregar nueva página al rol 'user'
INSERT INTO role_pages (role_id, page_id)
VALUES (7, [NEW_PAGE_ID]);

-- Agregar nueva página al rol 'Servicio Tecnico'
INSERT INTO role_pages (role_id, page_id)
VALUES (17, [NEW_PAGE_ID]);
```

### **Remover acceso a una página:**

```sql
-- Quitar página del rol 'user'
DELETE FROM role_pages
WHERE role_id = 7 AND page_id = [PAGE_ID];
```

### **Cambiar rol de un usuario:**

```sql
UPDATE user_roles
SET role_id = [NEW_ROLE_ID]
WHERE username = '[USERNAME]';
```

---

## 📞 SOPORTE

### **Si un usuario no puede acceder:**

1. **Verificar en PostgreSQL:**
```sql
SELECT * FROM user_roles WHERE username = '[USERNAME]';
```

2. **Verificar páginas del rol:**
```sql
SELECT p.name
FROM pages p
INNER JOIN role_pages rp ON p.id = rp.page_id
WHERE rp.role_id = (
    SELECT role_id FROM user_roles WHERE username = '[USERNAME]'
);
```

3. **Verificar en SAP B1:**
   - Usuario existe y está activo
   - Tiene autorizaciones configuradas
   - Contraseña es correcta

4. **Verificar logs del servidor:**
```bash
tail -f /mnt/c/Projects/ServiceLayer/logs/combined.log
```

---

## 📊 ESTADÍSTICAS ACTUALES

```
Total de Usuarios: 9
  - Administradores: 5
  - No Administradores: 4

Usuarios con acceso a páginas no-admin:
  ✓ Consultas (6 páginas)
  ✓ stibmendez (6 páginas)
  ✓ stieramirez (6 páginas)
  ✓ stidrivas (7 páginas)

Páginas configuradas: 6
  1. Dashboard Inventario
  2. Artículos
  3. Fichas Técnicas
  4. Ofertas de Venta
  5. Órdenes de Venta
  6. Tipos de Cambio
```

---

**Documento generado:** 2025-10-21
**Sistema:** ServiceLayer Multi-Regional SAP
**Configurado por:** System Administrator
