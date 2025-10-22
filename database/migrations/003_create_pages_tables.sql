-- =====================================================
-- TABLAS DE PÁGINAS Y NAVEGACIÓN
-- =====================================================

-- Tabla de páginas disponibles en el sistema
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    path VARCHAR(200) NOT NULL UNIQUE,
    icon VARCHAR(50),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_pages_active ON pages(is_active);
CREATE INDEX IF NOT EXISTS idx_pages_order ON pages(display_order);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pages_timestamp
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_pages_timestamp();

-- Relación: qué roles (grupos) tienen acceso a qué páginas
CREATE TABLE IF NOT EXISTS role_pages (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR(100),
    PRIMARY KEY (role_id, page_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_role_pages_role ON role_pages(role_id);
CREATE INDEX IF NOT EXISTS idx_role_pages_page ON role_pages(page_id);

-- =====================================================
-- DATOS INICIALES - PÁGINAS EXISTENTES
-- =====================================================

INSERT INTO pages (name, path, icon, description, display_order, is_active) VALUES
('Dashboard', '/dashboard.html', 'fas fa-home', 'Panel principal del sistema', 1, true),
('Tipos de Cambio', '/tipos-cambio.html', 'fas fa-dollar-sign', 'Gestión de tipos de cambio', 2, true),
('Órdenes de Venta', '/ordenes-venta.html', 'fas fa-shopping-cart', 'Gestión de órdenes de venta', 3, true),
('Ofertas de Venta', '/ofertas-venta.html', 'fas fa-file-invoice', 'Gestión de ofertas de venta', 4, true),
('Fichas Técnicas', '/fichas-tecnicas.html', 'fas fa-clipboard-list', 'Consulta de fichas técnicas', 5, true),
('Artículos', '/articulos.html', 'fas fa-box', 'Catálogo de artículos', 6, true),
('Reportes EEFF', '/reportes-eeff.html', 'fas fa-chart-bar', 'Reportes de estados financieros', 7, true),
('Test UDOs', '/test-udos.html', 'fas fa-vial', 'Herramienta de diagnóstico UDO', 8, true),
('Admin Permisos', '/admin-permisos.html', 'fas fa-user-shield', 'Administración de permisos y usuarios', 9, true),
('Config Sistema', '/config-sistema.html', 'fas fa-cog', 'Configuración del sistema', 10, true)
ON CONFLICT (path) DO NOTHING;

-- Asignar todas las páginas al rol super_admin (id = 1)
INSERT INTO role_pages (role_id, page_id, granted_by)
SELECT 1, id, 'system'
FROM pages
ON CONFLICT (role_id, page_id) DO NOTHING;

-- =====================================================
-- COMENTARIOS DE TABLAS
-- =====================================================

COMMENT ON TABLE pages IS 'Páginas disponibles en el sistema para navegación';
COMMENT ON COLUMN pages.name IS 'Nombre visible de la página';
COMMENT ON COLUMN pages.path IS 'Ruta de la página (ej: /dashboard.html)';
COMMENT ON COLUMN pages.icon IS 'Clase de icono Font Awesome';
COMMENT ON COLUMN pages.description IS 'Descripción de la funcionalidad de la página';
COMMENT ON COLUMN pages.display_order IS 'Orden de visualización en el menú';
COMMENT ON COLUMN pages.is_active IS 'Indica si la página está activa';

COMMENT ON TABLE role_pages IS 'Relación entre roles y páginas - Define qué grupos ven qué páginas';
COMMENT ON COLUMN role_pages.granted_by IS 'Usuario que otorgó el acceso';
