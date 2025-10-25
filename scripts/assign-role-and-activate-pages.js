require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function assignRoleAndActivatePages(username, roleName, pageNamesToActivate, pageNamesToExclude = []) {
    const client = await pool.connect();

    try {
        console.log(`🔍 Procesando usuario: ${username}\n`);

        // Find user
        const userResult = await client.query(
            'SELECT username, full_name, is_active FROM sap_users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            console.log(`❌ Usuario "${username}" no encontrado`);
            return;
        }

        const user = userResult.rows[0];
        console.log('👤 Usuario encontrado:');
        console.log(`  - Username: ${user.username}`);
        console.log(`  - Nombre: ${user.full_name || 'N/A'}`);
        console.log(`  - Activo: ${user.is_active}\n`);

        // Find role
        const roleResult = await client.query(
            'SELECT id, name FROM roles WHERE name = $1',
            [roleName]
        );

        if (roleResult.rows.length === 0) {
            console.log(`❌ Rol "${roleName}" no encontrado`);
            return;
        }

        const role = roleResult.rows[0];
        console.log('👥 Rol a asignar:');
        console.log(`  - Nombre: ${role.name}`);
        console.log(`  - ID: ${role.id}\n`);

        // Begin transaction
        await client.query('BEGIN');

        // Check if user already has this role
        const existingRole = await client.query(
            'SELECT id FROM user_roles WHERE username = $1 AND role_id = $2',
            [user.username, role.id]
        );

        if (existingRole.rows.length === 0) {
            // Assign role to user
            await client.query(
                `INSERT INTO user_roles (username, role_id, company_db, granted_by)
                 VALUES ($1, $2, $3, $4)`,
                [user.username, role.id, '*', 'system_script']
            );
            console.log(`✅ Rol "${roleName}" asignado a "${username}"\n`);
        } else {
            console.log(`⏭️  Usuario ya tiene el rol "${roleName}"\n`);
        }

        // Get pages to activate
        let pagesQuery;
        let queryParams;

        if (pageNamesToActivate.length > 0) {
            // Activate specific pages
            pagesQuery = `
                SELECT id, name, path, is_active FROM pages
                WHERE name = ANY($1)
                ORDER BY name
            `;
            queryParams = [pageNamesToActivate];
        } else {
            // Activate ALL pages except excluded ones
            if (pageNamesToExclude.length > 0) {
                pagesQuery = `
                    SELECT id, name, path, is_active FROM pages
                    WHERE name != ALL($1)
                    ORDER BY name
                `;
                queryParams = [pageNamesToExclude];
            } else {
                pagesQuery = 'SELECT id, name, path, is_active FROM pages ORDER BY name';
                queryParams = [];
            }
        }

        const pagesResult = await client.query(pagesQuery, queryParams);

        console.log('📄 Páginas a activar:', pagesResult.rows.length);
        pagesResult.rows.forEach(page => {
            const status = page.is_active ? '✓' : '✗';
            console.log(`  ${status} ${page.name} (${page.path})`);
        });
        console.log('');

        // Activate pages (set is_active = true)
        const pageIds = pagesResult.rows.map(p => p.id);
        if (pageIds.length > 0) {
            await client.query(
                `UPDATE pages
                 SET is_active = true, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ANY($1)`,
                [pageIds]
            );
        }

        console.log('🚀 Asignando permisos de páginas al rol...\n');

        let permissionsAdded = 0;
        let permissionsSkipped = 0;

        // For each page, ensure permission exists for the role
        for (const page of pagesResult.rows) {
            // Check if permission already exists
            const existingPermission = await client.query(
                'SELECT 1 FROM role_pages WHERE page_id = $1 AND role_id = $2',
                [page.id, role.id]
            );

            if (existingPermission.rows.length === 0) {
                // Insert new permission
                await client.query(
                    'INSERT INTO role_pages (page_id, role_id, granted_by) VALUES ($1, $2, $3)',
                    [page.id, role.id, `system_for_${username}`]
                );
                console.log(`  ✅ Agregado: ${page.name} → ${role.name}`);
                permissionsAdded++;
            } else {
                permissionsSkipped++;
            }
        }

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n✨ Proceso completado:');
        console.log(`  - Permisos agregados: ${permissionsAdded}`);
        console.log(`  - Permisos ya existentes: ${permissionsSkipped}`);

        // Show what pages the user can now access
        const userPages = await client.query(`
            SELECT DISTINCT p.name, p.path
            FROM pages p
            JOIN role_pages rp ON p.id = rp.page_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.username = $1 AND p.is_active = true
            ORDER BY p.name
        `, [user.username]);

        console.log(`\n📋 Páginas accesibles para ${username} (${roleName}):`, userPages.rows.length);
        userPages.rows.forEach(page => {
            console.log(`  ✓ ${page.name}`);
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Configuration
const username = 'stijcastillo';
const roleName = 'user'; // Assign 'user' role
const pageNamesToActivate = []; // Empty = activate ALL pages
const pageNamesToExclude = []; // Empty = no exclusions

// Run the script
assignRoleAndActivatePages(username, roleName, pageNamesToActivate, pageNamesToExclude)
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
