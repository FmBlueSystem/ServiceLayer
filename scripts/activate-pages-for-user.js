require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function activatePagesForUser(username, pageNames) {
    const client = await pool.connect();

    try {
        console.log(`🔍 Buscando usuario: ${username}\n`);

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
        console.log(`  - Activo: ${user.is_active}`);
        console.log('');

        // Find user's roles
        const rolesResult = await client.query(`
            SELECT r.id, r.name, ur.company_db
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.username = $1
            ORDER BY r.name
        `, [user.username]);

        if (rolesResult.rows.length === 0) {
            console.log(`⚠️  Usuario "${username}" no tiene roles asignados`);
            return;
        }

        console.log('👥 Roles del usuario:', rolesResult.rows.length);
        rolesResult.rows.forEach(role => {
            console.log(`  - ${role.name} (ID: ${role.id}) - Compañía: ${role.company_db || 'Todas'}`);
        });
        console.log('');

        // Find pages to activate
        const pagesResult = await client.query(
            `SELECT id, name, path, is_active FROM pages
             WHERE name = ANY($1)
             ORDER BY name`,
            [pageNames]
        );

        if (pagesResult.rows.length === 0) {
            console.log('❌ No se encontraron las páginas especificadas');
            return;
        }

        console.log('📄 Páginas a activar:', pagesResult.rows.length);
        pagesResult.rows.forEach(page => {
            console.log(`  - ${page.name} (${page.path}) - Actualmente activa: ${page.is_active}`);
        });
        console.log('');

        // Begin transaction
        await client.query('BEGIN');

        // Activate pages (set is_active = true)
        const pageIds = pagesResult.rows.map(p => p.id);
        await client.query(
            `UPDATE pages
             SET is_active = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($1)`,
            [pageIds]
        );

        console.log('🚀 Activando páginas para los roles del usuario...\n');

        let permissionsAdded = 0;
        let permissionsSkipped = 0;

        // For each page and each user role, ensure permission exists
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
                        [page.id, role.id, `system_for_${username}`]
                    );
                    console.log(`  ✅ Agregado: ${page.name} → ${role.name}`);
                    permissionsAdded++;
                } else {
                    console.log(`  ⏭️  Ya existe: ${page.name} → ${role.name}`);
                    permissionsSkipped++;
                }
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

        console.log(`\n📋 Páginas accesibles para ${username}:`, userPages.rows.length);
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
const pagesToActivate = ['Reportes EEFF', 'Test UDOs'];

// Run the script
activatePagesForUser(username, pagesToActivate)
    .then(() => {
        console.log('\n✅ Páginas activadas exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
