require('dotenv').config();

async function checkItemStatus(itemCode) {
    try {
        console.log(`🔍 Verificando estado del artículo: ${itemCode}\n`);
        console.log('═'.repeat(70));

        // Leer sesiones del archivo
        const fs = require('fs');
        const sessionsPath = '/mnt/c/Projects/ServiceLayer/.sessions.json';

        if (!fs.existsSync(sessionsPath)) {
            console.log('❌ No se encontró archivo de sesiones');
            console.log('💡 Inicie sesión primero en el frontend');
            return;
        }

        const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
        const sessions = sessionsData.sessions || [];

        if (sessions.length === 0) {
            console.log('❌ No hay sesiones SAP válidas');
            console.log('💡 Inicie sesión primero en el frontend');
            return;
        }

        console.log(`📡 Sesiones SAP encontradas: ${sessions.length}\n`);

        const results = [];

        // Consultar en cada base de datos
        for (const session of sessions) {
            const companyNames = {
                'SBO_GT_STIA_PROD': '🇬🇹 Guatemala',
                'SBO_HO_STIA_PROD': '🇭🇳 Honduras',
                'SBO_PA_STIA_PROD': '🇵🇦 Panamá',
                'SBO_STIACR_PROD': '🇨🇷 Costa Rica'
            };

            const companyName = companyNames[session.companyDB] || session.companyDB;
            console.log(`\n🔎 Consultando en: ${companyName}`);
            console.log('─'.repeat(70));

            try {
                const response = await fetch('http://localhost:3000/api/sap/items', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: session.sessionId,
                        companyDB: session.companyDB,
                        filters: {
                            itemCode: itemCode,
                            onlyActive: false, // Buscar tanto activos como inactivos
                            limit: 10
                        }
                    })
                });

                const data = await response.json();

                if (data.success && data.data?.value?.length > 0) {
                    const items = data.data.value;

                    items.forEach(item => {
                        const isActive = item.frozenFor === 'N' || item.frozenFor === 'tNO';
                        const status = isActive ? '✅ ACTIVO' : '❌ INACTIVO';

                        console.log(`\n${status}`);
                        console.log(`Código: ${item.ItemCode}`);
                        console.log(`Descripción: ${item.ItemName || 'N/A'}`);
                        console.log(`Número de Parte: ${item.U_Cod_Proveedor || 'N/A'}`);
                        console.log(`Stock Total: ${item.QuantityOnStock || 0}`);
                        console.log(`Estado SAP (frozenFor): ${item.frozenFor}`);

                        if (item.ItemWarehouseInfoCollection) {
                            console.log(`\n📦 Stock por Almacén:`);
                            item.ItemWarehouseInfoCollection.forEach(wh => {
                                console.log(`  - Almacén ${wh.WarehouseCode}: ${wh.InStock || 0} unidades`);
                            });
                        }

                        results.push({
                            company: companyName,
                            itemCode: item.ItemCode,
                            itemName: item.ItemName,
                            isActive: isActive,
                            frozenFor: item.frozenFor,
                            stock: item.QuantityOnStock
                        });
                    });
                } else {
                    console.log('⚠️  No encontrado en esta base de datos');
                }

            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }

        // Resumen final
        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN');
        console.log('═'.repeat(70));

        if (results.length === 0) {
            console.log(`\n❌ El artículo "${itemCode}" NO fue encontrado en ninguna base de datos`);
            console.log('\n💡 Posibles causas:');
            console.log('   - El código es incorrecto');
            console.log('   - El artículo no existe en ninguna compañía');
            console.log('   - Problema de conectividad con SAP');
        } else {
            console.log(`\n✓ Encontrado en ${results.length} base(s) de datos:`);

            const activeCount = results.filter(r => r.isActive).length;
            const inactiveCount = results.filter(r => !r.isActive).length;

            console.log(`\n📈 Estado:`);
            console.log(`   ✅ Activo en: ${activeCount} compañía(s)`);
            console.log(`   ❌ Inactivo en: ${inactiveCount} compañía(s)`);

            console.log(`\n📋 Detalle por compañía:`);
            results.forEach(r => {
                const statusIcon = r.isActive ? '✅' : '❌';
                console.log(`   ${statusIcon} ${r.company}: ${r.isActive ? 'ACTIVO' : 'INACTIVO'} (Stock: ${r.stock || 0})`);
            });
        }

        console.log('\n');

    } catch (error) {
        console.error('❌ Error general:', error.message);
        throw error;
    }
}

// Item code to check
const itemCode = process.argv[2] || '31101565';

// Run the script
checkItemStatus(itemCode)
    .then(() => {
        console.log('✅ Verificación completada\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error.message);
        process.exit(1);
    });
