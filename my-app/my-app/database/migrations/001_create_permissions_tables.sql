-- =====================================================
-- SISTEMA DE PERMISOS - PostgreSQL
-- Usuarios: Sincronizados desde SAP Costa Rica
-- Autenticación: Service Layer (multi-compañía)
-- Autorización: PostgreSQL (local, rápido)
-- =====================================================

-- Tabla de usuarios (sincronizada desde SAP)
-- Solo metadata, la autenticación sigue en SAP
CREATE TABLE IF NOT EXISTS sap_users (
    username VARCHAR(100) PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    sap_company_db VARCHAR(100) DEFAULT 'SBO_STIACR_PROD', -- BD de origen
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- true = no se puede eliminar
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de recursos/módulos de la aplicación
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, action)
);

-- Relación roles-permisos (qué puede hacer cada rol)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- Asignación de roles a usuarios SAP
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) REFERENCES sap_users(username) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    company_db VARCHAR(100), -- NULL o '*' = todas las compañías
    granted_by VARCHAR(100), -- Usuario que otorgó el permiso
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE NULLS NOT DISTINCT (username, role_id, company_db)
);

-- Auditoría de acciones
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    company_db VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sap_users_active ON sap_users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_username ON user_roles(username);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON user_roles(company_db);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource, action);

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar roles base del sistema
INSERT INTO roles (name, description, is_system_role) VALUES
('super_admin', 'Acceso total al sistema - Puede gestionar usuarios y permisos', true),
('admin_cr', 'Administrador Costa Rica', false),
('admin_gt', 'Administrador Guatemala', false),
('admin_hn', 'Administrador Honduras', false),
('admin_pa', 'Administrador Panamá', false),
('manager', 'Gestor - Puede crear y modificar datos', false),
('user', 'Usuario estándar - Lectura y escritura limitada', false),
('viewer', 'Solo lectura - No puede modificar datos', false)
ON CONFLICT (name) DO NOTHING;

-- Insertar permisos/recursos de la aplicación
INSERT INTO permissions (resource, action, description) VALUES
-- Dashboard
('dashboard', 'view', 'Ver dashboard principal'),

-- Tipos de Cambio
('tipos_cambio', 'view', 'Ver tipos de cambio'),
('tipos_cambio', 'refresh', 'Refrescar/actualizar tipos de cambio'),

-- Órdenes de Venta
('ordenes_venta', 'view', 'Ver órdenes de venta'),
('ordenes_venta', 'create', 'Crear órdenes de venta'),
('ordenes_venta', 'update', 'Modificar órdenes de venta'),
('ordenes_venta', 'cancel', 'Cancelar órdenes de venta'),
('ordenes_venta', 'export', 'Exportar órdenes de venta'),

-- Ofertas de Venta
('ofertas_venta', 'view', 'Ver ofertas de venta'),
('ofertas_venta', 'create', 'Crear ofertas de venta'),
('ofertas_venta', 'export', 'Exportar ofertas de venta'),

-- Fichas Técnicas
('fichas_tecnicas', 'view', 'Ver fichas técnicas'),
('fichas_tecnicas', 'export', 'Exportar fichas técnicas'),

-- Artículos
('articulos', 'view', 'Ver artículos'),
('articulos', 'export', 'Exportar artículos'),

-- Reportes Financieros
('reportes_eeff', 'view', 'Ver reportes financieros'),
('reportes_eeff', 'export', 'Exportar reportes'),

-- UDO Test (Diagnóstico)
('udo_test', 'view', 'Ver herramienta de diagnóstico UDO'),

-- Administración de Usuarios
('usuarios', 'view', 'Ver usuarios y permisos'),
('usuarios', 'manage', 'Gestionar usuarios y permisos'),
('usuarios', 'sync', 'Sincronizar usuarios desde SAP'),

-- Configuración del Sistema
('configuracion', 'view', 'Ver configuración del sistema'),
('configuracion', 'manage', 'Modificar configuración del sistema'),

-- Auditoría
('auditoria', 'view', 'Ver logs de auditoría')
ON CONFLICT (resource, action) DO NOTHING;

-- Asignar TODOS los permisos al rol super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE name = 'super_admin'),
    id
FROM permissions
ON CONFLICT DO NOTHING;

-- Asignar permisos al rol 'viewer' (solo lectura)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE name = 'viewer'),
    id
FROM permissions
WHERE action IN ('view')
AND resource NOT IN ('usuarios', 'configuracion', 'auditoria')
ON CONFLICT DO NOTHING;

-- Asignar permisos al rol 'user' (lectura + algunas escrituras)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE name = 'user'),
    id
FROM permissions
WHERE (
    action IN ('view', 'export')
    OR (resource = 'ordenes_venta' AND action IN ('create', 'update'))
    OR (resource = 'ofertas_venta' AND action = 'create')
)
AND resource NOT IN ('usuarios', 'configuracion', 'auditoria')
ON CONFLICT DO NOTHING;

-- Asignar permisos al rol 'manager' (todo excepto admin)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE name = 'manager'),
    id
FROM permissions
WHERE resource NOT IN ('usuarios', 'configuracion')
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE sap_users IS 'Lista de usuarios sincronizada desde SAP Costa Rica - Solo referencia, autenticación en SAP';
COMMENT ON TABLE roles IS 'Roles del sistema con conjuntos de permisos';
COMMENT ON TABLE permissions IS 'Recursos y acciones disponibles en la aplicación';
COMMENT ON TABLE role_permissions IS 'Qué permisos tiene cada rol';
COMMENT ON TABLE user_roles IS 'Qué roles tiene cada usuario SAP (por compañía)';
COMMENT ON TABLE audit_log IS 'Log de todas las acciones realizadas en el sistema';

COMMENT ON COLUMN user_roles.company_db IS 'Base de datos SAP. NULL o * = todas las compañías';
COMMENT ON COLUMN sap_users.is_active IS 'Si false, usuario no podrá acceder aunque exista en SAP';
