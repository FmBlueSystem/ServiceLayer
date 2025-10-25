require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'myapp_user',
    password: process.env.POSTGRES_PASSWORD
});

async function searchUsers(searchTerm) {
    const client = await pool.connect();

    try {
        console.log(`🔍 Buscando usuarios con: "${searchTerm}"\n`);
        console.log('═'.repeat(60));

        const result = await client.query(
            `SELECT username, full_name, email, is_active, sap_company_db
             FROM sap_users
             WHERE username ILIKE $1 OR full_name ILIKE $1
             ORDER BY username`,
            [`%${searchTerm}%`]
        );

        if (result.rows.length === 0) {
            console.log(`\n❌ No se encontraron usuarios con "${searchTerm}"\n`);
        } else {
            console.log(`\n✅ Encontrados ${result.rows.length} usuario(s):\n`);
            result.rows.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username}`);
                console.log(`   Nombre: ${user.full_name || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Estado: ${user.is_active ? '✓ Activo' : '✗ Inactivo'}`);
                console.log(`   Compañía SAP: ${user.sap_company_db || 'N/A'}`);
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

const searchTerm = process.argv[2] || '';

if (!searchTerm) {
    console.log('❌ Debe proporcionar un término de búsqueda');
    console.log('Uso: node search-users.js <término>');
    process.exit(1);
}

searchUsers(searchTerm)
    .then(() => {
        console.log('\n✅ Búsqueda completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
