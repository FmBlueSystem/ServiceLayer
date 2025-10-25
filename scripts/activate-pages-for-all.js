require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function activatePagesForAll() {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando páginas y roles...\n');

        // Get all pages
        const pagesResult = await client.query('SELECT id, name, path FROM pages ORDER BY id');
        console.log('📄 Páginas encontradas:', pagesResult.rows.length);
        pagesResult.rows.forEach(page => {
            console.log(`  - ${page.name} (${page.path})`);
        });
        console.log('');

        // Get all roles
        const rolesResult = await client.query('SELECT id, name FROM roles ORDER BY id');
        console.log('👥 Roles encontrados:', rolesResult.rows.length);
        rolesResult.rows.forEach(role => {
            console.log(`  - ${role.name} (ID: ${role.id})`);
        });
        console.log('');

        // Check current page permissions
        const currentPermissions = await client.query(`
            SELECT rp.page_id, rp.role_id, p.name as page_name, r.name as role_name
            FROM role_pages rp
            JOIN pages p ON rp.page_id = p.id
            JOIN roles r ON rp.role_id = r.id
            ORDER BY rp.page_id, rp.role_id
        `);

        console.log('📋 Permisos de página actuales:', currentPermissions.rows.length);
        if (currentPermissions.rows.length > 0) {
            currentPermissions.rows.forEach(perm => {
                console.log(`  - ${perm.page_name} → ${perm.role_name}`);
            });
            console.log('');
        }

        // Begin transaction
        await client.query('BEGIN');

        console.log('🚀 Activando todas las páginas para todos los roles...\n');

        let permissionsAdded = 0;
        let permissionsSkipped = 0;

        // For each page and each role, ensure permission exists
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
        console.log(`  - Total de permisos: ${permissionsAdded + permissionsSkipped}`);

        // Show final state
        const finalPermissions = await client.query(`
            SELECT rp.page_id, rp.role_id, p.name as page_name, r.name as role_name
            FROM role_pages rp
            JOIN pages p ON rp.page_id = p.id
            JOIN roles r ON rp.role_id = r.id
            ORDER BY rp.page_id, rp.role_id
        `);

        console.log('\n📊 Estado final de permisos:', finalPermissions.rows.length);

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
activatePagesForAll()
    .then(() => {
        console.log('\n✅ Script completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
