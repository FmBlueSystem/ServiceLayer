// =====================================================
// SERVICIO DE PERMISOS Y AUTORIZACIÓN
// =====================================================

const logger = require('../config/logger');
const db = require('../config/database');

class PermissionService {
    /**
     * Verificar si un usuario tiene un permiso específico
     */
    async hasPermission(username, resource, action, companyDB = null) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                JOIN sap_users u ON ur.username = u.username
                WHERE ur.username = $1
                AND p.resource = $2
                AND p.action = $3
                AND u.is_active = true
                AND (
                    ur.company_db = $4
                    OR ur.company_db = '*'
                    OR ur.company_db IS NULL
                )
            `;

            const result = await db.query(query, [username, resource, action, companyDB]);
            return parseInt(result.rows[0].count) > 0;

        } catch (error) {
            logger.error('Error verificando permiso:', error);
            return false;
        }
    }

    /**
     * Obtener todos los permisos de un usuario
     */
    async getUserPermissions(username) {
        const query = `
            SELECT DISTINCT
                p.resource,
                p.action,
                p.description,
                ur.company_db
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            JOIN sap_users u ON ur.username = u.username
            WHERE ur.username = $1
            AND u.is_active = true
            ORDER BY p.resource, p.action
        `;

        const result = await db.query(query, [username]);
        return result.rows;
    }

    /**
     * Obtener compañías autorizadas para un usuario
     */
    async getUserAuthorizedCompanies(username) {
        const query = `
            SELECT DISTINCT company_db
            FROM user_roles
            WHERE username = $1
        `;

        const result = await db.query(query, [username]);
        const companies = result.rows.map(r => r.company_db);

        // Si tiene acceso a todas (*)
        if (companies.includes('*') || companies.includes(null)) {
            return ['*'];
        }

        return companies;
    }

    /**
     * Asignar un rol a un usuario
     */
    async assignRole(username, roleId, companyDB, grantedBy) {
        const query = `
            INSERT INTO user_roles (username, role_id, company_db, granted_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (username, role_id, company_db)
            DO UPDATE SET
                granted_by = EXCLUDED.granted_by,
                granted_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await db.query(query, [
            username,
            roleId,
            companyDB || null,
            grantedBy
        ]);

        logger.info('Rol asignado', {
            username,
            roleId,
            companyDB,
            grantedBy
        });

        return result.rows[0];
    }

    /**
     * Remover un rol de un usuario
     */
    async removeRole(username, roleId, companyDB) {
        const query = `
            DELETE FROM user_roles
            WHERE username = $1
            AND role_id = $2
            AND ($3::VARCHAR IS NULL OR company_db = $3)
            RETURNING *
        `;

        const result = await db.query(query, [username, roleId, companyDB]);

        logger.info('Rol removido', {
            username,
            roleId,
            companyDB
        });

        return result.rows[0];
    }

    /**
     * Obtener todos los roles disponibles
     */
    async getRoles() {
        const query = `
            SELECT
                r.id,
                r.name,
                r.description,
                r.is_system_role,
                r.created_at,
                COUNT(DISTINCT rp.permission_id) as permissions_count
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            GROUP BY r.id
            ORDER BY
                CASE
                    WHEN r.name = 'super_admin' THEN 1
                    WHEN r.name LIKE 'admin%' THEN 2
                    WHEN r.name = 'manager' THEN 3
                    WHEN r.name = 'user' THEN 4
                    WHEN r.name = 'viewer' THEN 5
                    ELSE 6
                END,
                r.name
        `;

        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Obtener permisos de un rol específico
     */
    async getRolePermissions(roleId) {
        const query = `
            SELECT
                p.id,
                p.resource,
                p.action,
                p.description
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = $1
            ORDER BY p.resource, p.action
        `;

        const result = await db.query(query, [roleId]);
        return result.rows;
    }

    /**
     * Obtener todos los permisos disponibles (agrupados por recurso)
     */
    async getAllPermissions() {
        const query = `
            SELECT
                resource,
                json_agg(
                    json_build_object(
                        'id', id,
                        'action', action,
                        'description', description
                    )
                    ORDER BY action
                ) as actions
            FROM permissions
            GROUP BY resource
            ORDER BY resource
        `;

        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Crear un nuevo rol
     */
    async createRole(name, description) {
        const query = `
            INSERT INTO roles (name, description, is_system_role)
            VALUES ($1, $2, false)
            RETURNING *
        `;

        const result = await db.query(query, [name, description]);
        return result.rows[0];
    }

    /**
     * Asignar permisos a un rol
     */
    async assignPermissionsToRole(roleId, permissionIds) {
        // Primero eliminar permisos actuales
        await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        // Insertar nuevos permisos
        if (permissionIds && permissionIds.length > 0) {
            const values = permissionIds.map((permId, idx) =>
                `($1, $${idx + 2})`
            ).join(',');

            const query = `
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ${values}
                ON CONFLICT DO NOTHING
            `;

            await db.query(query, [roleId, ...permissionIds]);
        }

        logger.info('Permisos asignados a rol', {
            roleId,
            permissionCount: permissionIds.length
        });
    }

    /**
     * Registrar evento de auditoría
     */
    async logAuditEvent(event) {
        const query = `
            INSERT INTO audit_log (
                username,
                action,
                resource,
                company_db,
                details,
                ip_address,
                user_agent,
                success,
                error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;

        const result = await db.query(query, [
            event.username,
            event.action,
            event.resource,
            event.company_db || null,
            JSON.stringify(event.details || {}),
            event.ip_address,
            event.user_agent,
            event.success !== false,
            event.error_message || null
        ]);

        return result.rows[0].id;
    }

    /**
     * Obtener logs de auditoría
     */
    async getAuditLogs(filters = {}) {
        let query = `
            SELECT
                id,
                username,
                action,
                resource,
                company_db,
                details,
                ip_address,
                success,
                error_message,
                created_at
            FROM audit_log
        `;

        const conditions = [];
        const params = [];

        if (filters.username) {
            params.push(filters.username);
            conditions.push(`username = $${params.length}`);
        }

        if (filters.resource) {
            params.push(filters.resource);
            conditions.push(`resource = $${params.length}`);
        }

        if (filters.success !== undefined) {
            params.push(filters.success);
            conditions.push(`success = $${params.length}`);
        }

        if (filters.from_date) {
            params.push(filters.from_date);
            conditions.push(`created_at >= $${params.length}`);
        }

        if (filters.to_date) {
            params.push(filters.to_date);
            conditions.push(`created_at <= $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY created_at DESC LIMIT ${filters.limit || 100}`;

        const result = await db.query(query, params);
        return result.rows;
    }
}

module.exports = new PermissionService();
