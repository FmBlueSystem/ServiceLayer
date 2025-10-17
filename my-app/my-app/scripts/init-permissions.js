#!/usr/bin/env node
// =====================================================
// SCRIPT DE INICIALIZACIÓN DEL SISTEMA DE PERMISOS
// =====================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'myapp',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD
});

async function init() {
    console.log('🚀 Iniciando sistema de permisos...\n');

    try {
        // 1. Ejecutar el script SQL de creación de tablas
        console.log('📋 Creando tablas y datos iniciales...');
        const sqlPath = path.join(__dirname, '../database/migrations/001_create_permissions_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('✅ Tablas creadas\n');

        // 2. Verificar que existen roles
        const rolesResult = await pool.query('SELECT COUNT(*) FROM roles');
        console.log(`📊 Roles creados: ${rolesResult.rows[0].count}`);

        // 3. Verificar que existen permisos
        const permsResult = await pool.query('SELECT COUNT(*) FROM permissions');
        console.log(`📊 Permisos creados: ${permsResult.rows[0].count}\n`);

        // 4. Asignar rol super_admin al usuario actual (stifmolina2)
        console.log('👤 Asignando rol super_admin al usuario stifmolina2...');

        // Primero crear el usuario si no existe
        await pool.query(`
            INSERT INTO sap_users (username, full_name, email, is_active)
            VALUES ('stifmolina2', 'Administrator', 'admin@stia.com', true)
            ON CONFLICT (username) DO UPDATE
            SET is_active = true
        `);

        // Asignar rol super_admin con acceso a todas las compañías
        await pool.query(`
            INSERT INTO user_roles (username, role_id, company_db, granted_by)
            VALUES (
                'stifmolina2',
                (SELECT id FROM roles WHERE name = 'super_admin'),
                '*',
                'system'
            )
            ON CONFLICT (username, role_id, COALESCE(company_db, 'ALL'))
            DO NOTHING
        `);

        console.log('✅ Usuario stifmolina2 configurado como super_admin\n');

        // 5. Mostrar resumen
        console.log('=' .repeat(50));
        console.log('✅ SISTEMA DE PERMISOS INICIALIZADO CORRECTAMENTE');
        console.log('=' .repeat(50));
        console.log('\n📝 Próximos pasos:');
        console.log('1. Inicia sesión con tu usuario SAP (stifmolina2)');
        console.log('2. Ve a Administración > Usuarios');
        console.log('3. Sincroniza usuarios desde SAP Costa Rica');
        console.log('4. Asigna roles a los usuarios según sea necesario');
        console.log('\n🔑 Roles disponibles:');

        const roles = await pool.query(`
            SELECT name, description
            FROM roles
            ORDER BY
                CASE
                    WHEN name = 'super_admin' THEN 1
                    WHEN name LIKE 'admin%' THEN 2
                    WHEN name = 'manager' THEN 3
                    WHEN name = 'user' THEN 4
                    WHEN name = 'viewer' THEN 5
                    ELSE 6
                END
        `);

        roles.rows.forEach(role => {
            console.log(`   - ${role.name}: ${role.description}`);
        });

        console.log('\n');

    } catch (error) {
        console.error('❌ Error inicializando el sistema:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    init()
        .then(() => {
            console.log('✅ Inicialización completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error:', error.message);
            process.exit(1);
        });
}

module.exports = init;
