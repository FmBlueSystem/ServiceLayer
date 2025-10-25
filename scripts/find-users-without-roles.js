require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function findUsersWithoutRoles() {
    const client = await pool.connect();

    try {
        console.log('🔍 Buscando usuarios sin roles asignados...\n');
        console.log('═'.repeat(70));

        const result = await client.query(
            `SELECT u.username, u.full_name, u.email, u.is_active, u.sap_company_db
             FROM sap_users u
             LEFT JOIN user_roles ur ON u.username = ur.username
             WHERE ur.username IS NULL AND u.is_active = true
             ORDER BY u.username`
        );

        if (result.rows.length === 0) {
            console.log('\n✅ Todos los usuarios activos tienen roles asignados\n');
        } else {
            console.log(`\n⚠️  Encontrados ${result.rows.length} usuario(s) sin roles:\n`);
            result.rows.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username}`);
                console.log(`   Nombre: ${user.full_name || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Compañía SAP: ${user.sap_company_db || 'N/A'}`);
                console.log('');
            });

            console.log('═'.repeat(70));
            console.log('\n💡 Para asignar roles, ejecuta:');
            const usernames = result.rows.map(u => u.username).join(' ');
            console.log(`   node scripts/activate-users-pages.js ${usernames}\n`);
        }

        return result.rows;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

findUsersWithoutRoles()
    .then(() => {
        console.log('✅ Búsqueda completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
