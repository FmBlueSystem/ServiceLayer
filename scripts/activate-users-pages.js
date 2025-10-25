require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function activatePagesForUsers(usernames) {
    const client = await pool.connect();

    try {
        console.log(`🔧 Activando páginas para ${usernames.length} usuario(s)...\n`);
        console.log('═'.repeat(70));

        // Obtener el rol "user"
        const roleResult = await client.query(
            'SELECT id FROM roles WHERE name = $1',
            ['user']
        );

        if (roleResult.rows.length === 0) {
            console.log('❌ Rol "user" no encontrado');
            return;
        }

        const roleId = roleResult.rows[0].id;
        console.log(`✓ Rol "user" encontrado (ID: ${roleId})\n`);

        // Obtener todas las páginas activas
        const pagesResult = await client.query(
            'SELECT id, name, path FROM pages WHERE is_active = true ORDER BY name'
        );

        console.log(`✓ Páginas activas encontradas: ${pagesResult.rows.length}\n`);

        for (const username of usernames) {
            console.log(`\n👤 Procesando usuario: ${username}`);
            console.log('─'.repeat(70));

            // Verificar si el usuario existe
            const userCheck = await client.query(
                'SELECT username, full_name FROM sap_users WHERE username = $1',
                [username]
            );

            if (userCheck.rows.length === 0) {
                console.log(`   ❌ Usuario no encontrado: ${username}`);
                continue;
            }

            const user = userCheck.rows[0];
            console.log(`   Nombre: ${user.full_name || 'N/A'}`);

            // Verificar si ya tiene el rol asignado
            const existingRole = await client.query(
                'SELECT * FROM user_roles WHERE username = $1 AND role_id = $2',
                [username, roleId]
            );

            if (existingRole.rows.length === 0) {
                // Asignar el rol
                await client.query(
                    `INSERT INTO user_roles (username, role_id, company_db, granted_by, granted_at)
                     VALUES ($1, $2, '*', 'system', NOW())
                     ON CONFLICT (username, role_id, company_db) DO NOTHING`,
                    [username, roleId]
                );
                console.log(`   ✓ Rol "user" asignado`);
            } else {
                console.log(`   ✓ Ya tenía el rol "user" asignado`);
            }

            // Verificar páginas actuales
            const currentPages = await client.query(
                `SELECT DISTINCT p.id, p.name
                 FROM pages p
                 JOIN role_pages rp ON p.id = rp.page_id
                 JOIN user_roles ur ON rp.role_id = ur.role_id
                 WHERE ur.username = $1 AND p.is_active = true`,
                [username]
            );

            console.log(`   Páginas actuales: ${currentPages.rows.length}`);

            // Asignar todas las páginas activas al rol del usuario
            let addedCount = 0;
            for (const page of pagesResult.rows) {
                const existingPage = await client.query(
                    'SELECT * FROM role_pages WHERE role_id = $1 AND page_id = $2',
                    [roleId, page.id]
                );

                if (existingPage.rows.length === 0) {
                    await client.query(
                        'INSERT INTO role_pages (role_id, page_id) VALUES ($1, $2)',
                        [roleId, page.id]
                    );
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                console.log(`   ✓ ${addedCount} página(s) nueva(s) asignadas al rol "user"`);
            }

            // Verificar resultado final
            const finalPages = await client.query(
                `SELECT DISTINCT p.id, p.name
                 FROM pages p
                 JOIN role_pages rp ON p.id = rp.page_id
                 JOIN user_roles ur ON rp.role_id = ur.role_id
                 WHERE ur.username = $1 AND p.is_active = true
                 ORDER BY p.name`,
                [username]
            );

            console.log(`   ✅ Total páginas accesibles: ${finalPages.rows.length}`);

            if (finalPages.rows.length > 0) {
                console.log(`\n   📄 Páginas accesibles:`);
                finalPages.rows.forEach(page => {
                    console.log(`      - ${page.name}`);
                });
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN FINAL');
        console.log('═'.repeat(70));
        console.log(`✓ Usuarios procesados: ${usernames.length}`);
        console.log(`✓ Páginas activas en el sistema: ${pagesResult.rows.length}`);
        console.log(`✓ Rol asignado: "user"`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Usuarios a procesar
const users = process.argv.slice(2);

if (users.length === 0) {
    console.log('❌ Debe proporcionar al menos un usuario');
    console.log('Uso: node activate-users-pages.js <user1> [user2] [user3] ...');
    process.exit(1);
}

activatePagesForUsers(users)
    .then(() => {
        console.log('\n✅ Activación completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
