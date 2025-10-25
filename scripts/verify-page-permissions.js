require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function verifyPagePermissions(pageNames) {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando permisos de páginas...\n');

        for (const pageName of pageNames) {
            console.log(`\n📄 Página: ${pageName}`);
            console.log('─'.repeat(60));

            // Get page details
            const pageResult = await client.query(
                'SELECT id, name, path, is_active FROM pages WHERE name = $1',
                [pageName]
            );

            if (pageResult.rows.length === 0) {
                console.log('❌ Página no encontrada\n');
                continue;
            }

            const page = pageResult.rows[0];
            console.log(`Estado: ${page.is_active ? '✓ Activa' : '✗ Inactiva'}`);
            console.log(`Ruta: ${page.path}\n`);

            // Get roles with access
            const rolesResult = await client.query(`
                SELECT r.name as role_name, COUNT(DISTINCT ur.username) as user_count
                FROM role_pages rp
                JOIN roles r ON rp.role_id = r.id
                LEFT JOIN user_roles ur ON r.id = ur.role_id
                WHERE rp.page_id = $1
                GROUP BY r.id, r.name
                ORDER BY r.name
            `, [page.id]);

            if (rolesResult.rows.length === 0) {
                console.log('⚠️  Ningún rol tiene acceso a esta página\n');
            } else {
                console.log('👥 Roles con acceso:', rolesResult.rows.length);
                rolesResult.rows.forEach(role => {
                    console.log(`  - ${role.role_name} (${role.user_count} usuarios)`);
                });
                console.log('');
            }

            // Get users with access
            const usersResult = await client.query(`
                SELECT DISTINCT su.username, su.full_name, r.name as role_name
                FROM user_roles ur
                JOIN sap_users su ON ur.username = su.username
                JOIN roles r ON ur.role_id = r.id
                JOIN role_pages rp ON r.id = rp.role_id
                WHERE rp.page_id = $1 AND su.is_active = true
                ORDER BY su.username
            `, [page.id]);

            if (usersResult.rows.length === 0) {
                console.log('⚠️  Ningún usuario tiene acceso a esta página\n');
            } else {
                console.log('👤 Usuarios con acceso:', usersResult.rows.length);
                usersResult.rows.forEach(user => {
                    console.log(`  - ${user.username} (${user.full_name || 'N/A'}) - Rol: ${user.role_name}`);
                });
            }
        }

        console.log('\n' + '═'.repeat(60));
        console.log('📊 RESUMEN GENERAL');
        console.log('═'.repeat(60));

        // All active pages
        const allActivePages = await client.query(`
            SELECT p.name, COUNT(DISTINCT rp.role_id) as role_count
            FROM pages p
            LEFT JOIN role_pages rp ON p.id = rp.page_id
            WHERE p.is_active = true
            GROUP BY p.id, p.name
            ORDER BY p.name
        `);

        console.log('\n✅ Páginas activas:', allActivePages.rows.length);
        allActivePages.rows.forEach(page => {
            console.log(`  - ${page.name}: ${page.role_count} roles`);
        });

        // All inactive pages
        const allInactivePages = await client.query(
            'SELECT name, path FROM pages WHERE is_active = false ORDER BY name'
        );

        if (allInactivePages.rows.length > 0) {
            console.log('\n🔒 Páginas inactivas:', allInactivePages.rows.length);
            allInactivePages.rows.forEach(page => {
                console.log(`  - ${page.name} (${page.path})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Pages to verify
const pagesToVerify = ['Reportes EEFF', 'Test UDOs'];

// Run the script
verifyPagePermissions(pagesToVerify)
    .then(() => {
        console.log('\n✅ Verificación completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
