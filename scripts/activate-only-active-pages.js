require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function activateOnlyActivePages() {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando páginas activas y roles...\n');

        // Get only ACTIVE pages
        const pagesResult = await client.query(
            'SELECT id, name, path, is_active FROM pages WHERE is_active = true ORDER BY id'
        );
        console.log('📄 Páginas ACTIVAS encontradas:', pagesResult.rows.length);
        pagesResult.rows.forEach(page => {
            console.log(`  ✓ ${page.name} (${page.path})`);
        });
        console.log('');

        // Get all INACTIVE pages for info
        const inactivePagesResult = await client.query(
            'SELECT id, name, path FROM pages WHERE is_active = false ORDER BY id'
        );
        if (inactivePagesResult.rows.length > 0) {
            console.log('📄 Páginas INACTIVAS (ignoradas):', inactivePagesResult.rows.length);
            inactivePagesResult.rows.forEach(page => {
                console.log(`  ✗ ${page.name} (${page.path})`);
            });
            console.log('');
        }

        // Get all roles
        const rolesResult = await client.query('SELECT id, name FROM roles ORDER BY id');
        console.log('👥 Roles encontrados:', rolesResult.rows.length);
        rolesResult.rows.forEach(role => {
            console.log(`  - ${role.name} (ID: ${role.id})`);
        });
        console.log('');

        // First, remove permissions for INACTIVE pages that were added
        console.log('🧹 Limpiando permisos de páginas inactivas...\n');

        const inactivePageIds = inactivePagesResult.rows.map(p => p.id);
        if (inactivePageIds.length > 0) {
            const deleteResult = await client.query(
                `DELETE FROM role_pages
                 WHERE page_id = ANY($1) AND granted_by = 'system_script'
                 RETURNING page_id, role_id`,
                [inactivePageIds]
            );

            if (deleteResult.rows.length > 0) {
                console.log(`  🗑️  Eliminados ${deleteResult.rows.length} permisos de páginas inactivas`);
            }
        }

        // Begin transaction
        await client.query('BEGIN');

        console.log('\n🚀 Activando SOLO páginas activas para todos los roles...\n');

        let permissionsAdded = 0;
        let permissionsSkipped = 0;

        // For each ACTIVE page and each role, ensure permission exists
        for (const page of pagesResult.rows) {
            for (const role of rolesResult.rows) {
                // Check if permission already exists
                const existingPermission = await client.query(
                    'SELECT 1 FROM role_pages WHERE page_id = $1 AND role_id = $2',
                    [page.id, role.id]
                );

                if (existingPermission.rows.length === 0) {
                    // Insert new permission
                    await client.query(
                        'INSERT INTO role_pages (page_id, role_id, granted_by) VALUES ($1, $2, $3)',
                        [page.id, role.id, 'system_script']
                    );
                    console.log(`  ✅ Agregado: ${page.name} → ${role.name}`);
                    permissionsAdded++;
                } else {
                    permissionsSkipped++;
                }
            }
        }

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n✨ Proceso completado:');
        console.log(`  - Permisos agregados: ${permissionsAdded}`);
        console.log(`  - Permisos ya existentes: ${permissionsSkipped}`);
        console.log(`  - Total de permisos activos: ${permissionsAdded + permissionsSkipped}`);

        // Show final state
        const finalPermissions = await client.query(`
            SELECT p.name as page_name, p.is_active, r.name as role_name
            FROM role_pages rp
            JOIN pages p ON rp.page_id = p.id
            JOIN roles r ON rp.role_id = r.id
            WHERE p.is_active = true
            ORDER BY p.name, r.name
        `);

        console.log('\n📊 Permisos finales (solo páginas activas):', finalPermissions.rows.length);

        // Group by page
        const pageGroups = {};
        finalPermissions.rows.forEach(perm => {
            if (!pageGroups[perm.page_name]) {
                pageGroups[perm.page_name] = [];
            }
            pageGroups[perm.page_name].push(perm.role_name);
        });

        console.log('\n📋 Resumen por página:');
        Object.entries(pageGroups).forEach(([pageName, roles]) => {
            console.log(`  ${pageName}: ${roles.length} roles`);
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

// Run the script
activateOnlyActivePages()
    .then(() => {
        console.log('\n✅ Script completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
