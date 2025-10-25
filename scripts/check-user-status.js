require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function checkUserStatus(username) {
    const client = await pool.connect();

    try {
        console.log(`🔍 Verificando usuario: ${username}\n`);
        console.log('═'.repeat(60));

        // Find user
        const userResult = await client.query(
            'SELECT username, full_name, email, is_active, sap_company_db, last_sync_at FROM sap_users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            console.log(`❌ Usuario "${username}" NO encontrado en la base de datos\n`);
            return;
        }

        const user = userResult.rows[0];
        console.log('👤 INFORMACIÓN DEL USUARIO');
        console.log('─'.repeat(60));
        console.log(`Username:        ${user.username}`);
        console.log(`Nombre completo: ${user.full_name || 'N/A'}`);
        console.log(`Email:           ${user.email || 'N/A'}`);
        console.log(`Estado:          ${user.is_active ? '✓ Activo' : '✗ Inactivo'}`);
        console.log(`Compañía SAP:    ${user.sap_company_db || 'N/A'}`);
        console.log(`Última sync:     ${user.last_sync_at || 'N/A'}`);
        console.log('');

        // Get user's roles
        const rolesResult = await client.query(`
            SELECT r.id, r.name, r.description, ur.company_db, ur.granted_at, ur.granted_by
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.username = $1
            ORDER BY r.name
        `, [user.username]);

        console.log('👥 ROLES ASIGNADOS');
        console.log('─'.repeat(60));
        if (rolesResult.rows.length === 0) {
            console.log('⚠️  NO tiene roles asignados\n');
        } else {
            console.log(`Total: ${rolesResult.rows.length} rol(es)\n`);
            rolesResult.rows.forEach((role, index) => {
                console.log(`${index + 1}. ${role.name} (ID: ${role.id})`);
                console.log(`   Descripción: ${role.description || 'N/A'}`);
                console.log(`   Compañía: ${role.company_db || 'Todas (*)'}`);
                console.log(`   Asignado: ${role.granted_at}`);
                console.log(`   Por: ${role.granted_by || 'N/A'}`);
                console.log('');
            });
        }

        // Get accessible pages
        const pagesResult = await client.query(`
            SELECT DISTINCT p.id, p.name, p.path, p.is_active
            FROM pages p
            JOIN role_pages rp ON p.id = rp.page_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.username = $1
            ORDER BY p.name
        `, [user.username]);

        console.log('📄 PÁGINAS ACCESIBLES');
        console.log('─'.repeat(60));
        if (pagesResult.rows.length === 0) {
            console.log('⚠️  NO tiene acceso a ninguna página\n');
        } else {
            const activePages = pagesResult.rows.filter(p => p.is_active);
            const inactivePages = pagesResult.rows.filter(p => !p.is_active);

            console.log(`Total: ${pagesResult.rows.length} página(s)`);
            console.log(`Activas: ${activePages.length} | Inactivas: ${inactivePages.length}\n`);

            if (activePages.length > 0) {
                console.log('✓ Páginas activas:');
                activePages.forEach(page => {
                    console.log(`  - ${page.name} (${page.path})`);
                });
                console.log('');
            }

            if (inactivePages.length > 0) {
                console.log('✗ Páginas inactivas (no visibles):');
                inactivePages.forEach(page => {
                    console.log(`  - ${page.name} (${page.path})`);
                });
                console.log('');
            }
        }

        // Get audit log (last 5 activities)
        const auditResult = await client.query(`
            SELECT action, resource, company_db, success, created_at
            FROM audit_log
            WHERE username = $1
            ORDER BY created_at DESC
            LIMIT 5
        `, [user.username]);

        if (auditResult.rows.length > 0) {
            console.log('📊 ACTIVIDAD RECIENTE (últimas 5 acciones)');
            console.log('─'.repeat(60));
            auditResult.rows.forEach((log, index) => {
                const status = log.success ? '✓' : '✗';
                console.log(`${index + 1}. ${status} ${log.action} - ${log.resource}`);
                console.log(`   Compañía: ${log.company_db || 'N/A'}`);
                console.log(`   Fecha: ${log.created_at}`);
                console.log('');
            });
        }

        console.log('═'.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// User to check
const username = process.argv[2] || 'stidrivas';

// Run the script
checkUserStatus(username)
    .then(() => {
        console.log('✅ Verificación completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
