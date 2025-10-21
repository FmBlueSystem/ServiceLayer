-- =====================================================
-- AGREGAR PÁGINA: DASHBOARD EJECUTIVO DE INVENTARIO
-- =====================================================
-- Fecha: 2025-10-20
-- Descripción: Agrega el nuevo dashboard de inventario al sistema de permisos

-- Insertar la nueva página
INSERT INTO pages (name, path, icon, description, display_order, is_active) VALUES
('Dashboard Inventario', '/dashboard-inventario.html', 'fas fa-warehouse', 'Dashboard ejecutivo de inventario multi-país', 11, true)
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
WHERE path = '/dashboard-inventario.html'
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
FROM pages p
WHERE p.path = '/dashboard-inventario.html';
