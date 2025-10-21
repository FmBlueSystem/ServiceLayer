// Script para verificar las páginas registradas en el sistema
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'myapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

async function verifyPages() {
    const client = await pool.connect();

    try {
        console.log('\n📄 PÁGINAS REGISTRADAS EN EL SISTEMA');
        console.log('═'.repeat(80));

        // Consultar todas las páginas con sus roles asignados
        const query = `
            SELECT
                p.id,
                p.name,
                p.path,
                p.icon,
                p.display_order,
                p.is_active,
                p.description,
                COALESCE(
                    STRING_AGG(r.name, ', ' ORDER BY r.name),
                    'Sin roles asignados'
                ) as roles_asignados
            FROM pages p
            LEFT JOIN role_pages rp ON p.id = rp.page_id
            LEFT JOIN roles r ON rp.role_id = r.id
            GROUP BY p.id, p.name, p.path, p.icon, p.display_order, p.is_active, p.description
            ORDER BY p.display_order;
        `;

        const result = await client.query(query);

        console.log(`\n✅ Total de páginas: ${result.rows.length}\n`);

        result.rows.forEach((page, index) => {
            console.log(`${index + 1}. ${page.name}`);
            console.log(`   ID: ${page.id}`);
            console.log(`   Ruta: ${page.path}`);
            console.log(`   Icono: ${page.icon}`);
            console.log(`   Orden: ${page.display_order}`);
            console.log(`   Activa: ${page.is_active ? '✅ Sí' : '❌ No'}`);
            console.log(`   Descripción: ${page.description}`);
            console.log(`   Roles: ${page.roles_asignados}`);
            console.log('');
        });

        console.log('═'.repeat(80));

        // Consultar específicamente el dashboard de inventario
        console.log('\n🔍 VERIFICACIÓN: Dashboard Inventario');
        console.log('═'.repeat(80));

        const dashboardQuery = `
            SELECT
                p.id,
                p.name,
                p.path,
                p.icon,
                p.display_order,
                p.is_active,
                p.description,
                p.created_at,
                p.updated_at,
                ARRAY_AGG(r.name) as roles
            FROM pages p
            LEFT JOIN role_pages rp ON p.id = rp.page_id
            LEFT JOIN roles r ON rp.role_id = r.id
            WHERE p.path = '/dashboard-inventario.html'
            GROUP BY p.id, p.name, p.path, p.icon, p.display_order, p.is_active, p.description, p.created_at, p.updated_at;
        `;

        const dashboardResult = await client.query(dashboardQuery);

        if (dashboardResult.rows.length > 0) {
            const dashboard = dashboardResult.rows[0];
            console.log('\n✅ Dashboard Inventario encontrado:');
            console.log(`   ID: ${dashboard.id}`);
            console.log(`   Nombre: ${dashboard.name}`);
            console.log(`   Ruta: ${dashboard.path}`);
            console.log(`   Icono: ${dashboard.icon}`);
            console.log(`   Orden: ${dashboard.display_order}`);
            console.log(`   Activa: ${dashboard.is_active ? '✅ Sí' : '❌ No'}`);
            console.log(`   Descripción: ${dashboard.description}`);
            console.log(`   Roles asignados: ${dashboard.roles.join(', ')}`);
            console.log(`   Creado: ${dashboard.created_at}`);
            console.log(`   Actualizado: ${dashboard.updated_at}`);
        } else {
            console.log('\n❌ Dashboard Inventario NO encontrado');
        }

        console.log('\n' + '═'.repeat(80));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

verifyPages()
    .then(() => {
        console.log('\n✅ Verificación completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error en verificación:', error.message);
        process.exit(1);
    });
