// =====================================================
// SERVICIO DE SINCRONIZACIÓN DE USUARIOS DESDE SAP
// =====================================================

const logger = require('../config/logger');
const db = require('../config/database');

class UserSyncService {
    /**
     * Sincronizar usuarios desde SAP Costa Rica
     * Trae todos los usuarios activos usando el endpoint Users de Service Layer
     */
    async syncUsersFromSAP(sessionId, companyDB = 'SBO_STIACR_PROD') {
        try {
            logger.info('Iniciando sincronización de usuarios desde SAP', {
                companyDB
            });

            // Obtener usuarios usando el endpoint Users del Service Layer con paginación
            // SAP Service Layer tiene un límite máximo de 20 registros por página
            let allUsers = [];
            let skip = 0;
            const pageSize = 20; // Límite máximo de SAP
            let hasMorePages = true;

            logger.info('Iniciando obtención paginada de usuarios SAP', {
                companyDB
            });

            while (hasMorePages) {
                const url = `${process.env.SAP_ENDPOINT}/b1s/v1/Users?$select=UserCode,UserName,eMail,Locked&$top=${pageSize}&$skip=${skip}`;

                logger.info('Consultando página de usuarios SAP', {
                    skip,
                    pageSize
                });

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': `B1SESSION=${sessionId}; CompanyDB=${companyDB}`
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    logger.error('Error al consultar usuarios SAP', {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText
                    });
                    throw new Error(`Error al consultar usuarios SAP: ${response.status} - ${response.statusText}`);
                }

                const data = await response.json();
                const pageUsers = data.value || [];

                logger.info('Página de usuarios recibida', {
                    recordsInPage: pageUsers.length,
                    totalSoFar: allUsers.length + pageUsers.length
                });

                if (pageUsers.length === 0) {
                    hasMorePages = false;
                } else {
                    allUsers = allUsers.concat(pageUsers);
                    skip += pageSize;

                    // Si recibimos menos registros que el pageSize, no hay más páginas
                    if (pageUsers.length < pageSize) {
                        hasMorePages = false;
                    }
                }
            }

            const sapUsersRaw = allUsers;

            logger.info('Obtención de usuarios completada', {
                totalRecords: sapUsersRaw.length
            });

            // Mapear los campos de SAP al formato esperado
            const sapUsers = sapUsersRaw.map(user => ({
                username: user.UserCode,
                full_name: user.UserName || user.UserCode,
                email: user.eMail || '',
                is_active: user.Locked === 'tNO'
            }));

            logger.info(`Usuarios obtenidos de SAP: ${sapUsers.length}`);

            // Sincronizar con PostgreSQL
            let synced = 0;
            let updated = 0;

            for (const user of sapUsers) {
                const result = await this.upsertUser({
                    username: user.username,
                    full_name: user.full_name || user.username,
                    email: user.email || '',
                    is_active: user.is_active,
                    sap_company_db: companyDB
                });

                if (result.action === 'inserted') synced++;
                if (result.action === 'updated') updated++;
            }

            logger.info('Sincronización completada', {
                total: sapUsers.length,
                nuevos: synced,
                actualizados: updated
            });

            return {
                success: true,
                total: sapUsers.length,
                synced,
                updated,
                users: sapUsers
            };

        } catch (error) {
            logger.error('Error sincronizando usuarios desde SAP:', error);
            throw error;
        }
    }

    /**
     * Insertar o actualizar un usuario en PostgreSQL
     */
    async upsertUser(userData) {
        const query = `
            INSERT INTO sap_users (
                username,
                full_name,
                email,
                is_active,
                sap_company_db,
                last_sync_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (username)
            DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                is_active = EXCLUDED.is_active,
                last_sync_at = CURRENT_TIMESTAMP
            RETURNING (xmax = 0) AS inserted
        `;

        const result = await db.query(query, [
            userData.username,
            userData.full_name,
            userData.email,
            userData.is_active,
            userData.sap_company_db
        ]);

        return {
            action: result.rows[0].inserted ? 'inserted' : 'updated',
            username: userData.username
        };
    }

    /**
     * Obtener lista de usuarios desde PostgreSQL
     */
    async getUsers(filters = {}) {
        let query = `
            SELECT
                u.username,
                u.full_name,
                u.email,
                u.is_active,
                u.sap_company_db,
                u.last_sync_at,
                json_agg(
                    json_build_object(
                        'role', r.name,
                        'role_description', r.description,
                        'company_db', ur.company_db
                    )
                ) FILTER (WHERE r.id IS NOT NULL) as roles
            FROM sap_users u
            LEFT JOIN user_roles ur ON u.username = ur.username
            LEFT JOIN roles r ON ur.role_id = r.id
        `;

        const conditions = [];
        const params = [];

        if (filters.is_active !== undefined) {
            params.push(filters.is_active);
            conditions.push(`u.is_active = $${params.length}`);
        }

        if (filters.search) {
            params.push(`%${filters.search}%`);
            conditions.push(`(
                u.username ILIKE $${params.length}
                OR u.full_name ILIKE $${params.length}
                OR u.email ILIKE $${params.length}
            )`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += `
            GROUP BY u.username
            ORDER BY u.username
        `;

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Obtener un usuario específico con sus permisos
     */
    async getUserWithPermissions(username) {
        const query = `
            SELECT
                u.username,
                u.full_name,
                u.email,
                u.is_active,
                u.last_sync_at,
                json_agg(
                    DISTINCT jsonb_build_object(
                        'role_id', r.id,
                        'role', r.name,
                        'description', r.description,
                        'company_db', ur.company_db
                    )
                ) FILTER (WHERE r.id IS NOT NULL) as roles,
                (
                    SELECT json_agg(
                        DISTINCT jsonb_build_object(
                            'resource', p.resource,
                            'action', p.action,
                            'description', p.description,
                            'company_db', ur2.company_db
                        )
                    )
                    FROM user_roles ur2
                    JOIN role_permissions rp ON ur2.role_id = rp.role_id
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur2.username = u.username
                ) as permissions
            FROM sap_users u
            LEFT JOIN user_roles ur ON u.username = ur.username
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.username = $1
            GROUP BY u.username
        `;

        const result = await db.query(query, [username]);
        return result.rows[0] || null;
    }

    /**
     * Desactivar usuario localmente (no afecta SAP)
     */
    async deactivateUser(username) {
        const query = `
            UPDATE sap_users
            SET is_active = false
            WHERE username = $1
            RETURNING *
        `;

        const result = await db.query(query, [username]);
        return result.rows[0];
    }

    /**
     * Activar usuario localmente
     */
    async activateUser(username) {
        const query = `
            UPDATE sap_users
            SET is_active = true
            WHERE username = $1
            RETURNING *
        `;

        const result = await db.query(query, [username]);
        return result.rows[0];
    }
}

module.exports = new UserSyncService();
