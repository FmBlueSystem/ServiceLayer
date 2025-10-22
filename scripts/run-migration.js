// Script para ejecutar migraciones de base de datos
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'myapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

async function runMigration(migrationFile) {
    const client = await pool.connect();

    try {
        console.log(`\n📦 Ejecutando migración: ${migrationFile}`);
        console.log('═'.repeat(60));

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Ejecutar el SQL
        const result = await client.query(sqlContent);

        console.log('\n✅ Migración ejecutada exitosamente');

        // Si hay resultados (como el SELECT de verificación), mostrarlos
        if (result.rows && result.rows.length > 0) {
            console.log('\n📊 Resultado:');
            console.table(result.rows);
        }

        console.log('═'.repeat(60));

    } catch (error) {
        console.error('\n❌ Error ejecutando migración:');
        console.error(error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Obtener el archivo de migración desde argumentos
const migrationFile = process.argv[2] || '004_add_dashboard_inventario.sql';

runMigration(migrationFile)
    .then(() => {
        console.log('\n✅ Proceso completado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Proceso fallido:', error.message);
        process.exit(1);
    });
