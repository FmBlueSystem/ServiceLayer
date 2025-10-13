#!/usr/bin/env node

/**
 * Script para extraer datos de tipos de cambio de SAP
 * Uso: node extract_sap_data.js [opciones]
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
    baseUrl: 'http://localhost:3000',
    outputFile: 'sap_exchange_rates.json',
    csvFile: 'sap_exchange_rates.csv'
};

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para formatear fecha
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Función para obtener sesión SAP (si es necesario)
async function getSAPSession(companyDB = 'SBO_GT_STIA_PROD') {
    try {
        log('🔐 Intentando obtener sesión SAP...', 'yellow');
        
        // Intentar con credenciales por defecto o mock
        const response = await axios.post(`${CONFIG.baseUrl}/api/sap/login`, {
            username: 'manager',
            password: 'manager',
            companyDB: companyDB
        });
        
        if (response.data.success) {
            log('✅ Sesión SAP obtenida exitosamente', 'green');
            return response.data.sessionId;
        }
    } catch (error) {
        log('⚠️  No se pudo obtener sesión SAP (continuando sin autenticación)', 'yellow');
        return null;
    }
}

// Función para extraer datos de múltiples países
async function extractMultiCountryData(sessionId = null) {
    try {
        log('🌍 Extrayendo datos de múltiples países...', 'cyan');
        
        const payload = {
            countries: ['COSTA_RICA', 'HONDURAS', 'GUATEMALA', 'PANAMA'],
            companyDB: 'SBO_GT_STIA_PROD'
        };
        
        if (sessionId) {
            payload.sessionId = sessionId;
        }
        
        const response = await axios.post(`${CONFIG.baseUrl}/api/sap/exchange-rates/multi-country`, payload);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.error || 'Error desconocido');
        }
    } catch (error) {
        log(`❌ Error extrayendo datos multi-país: ${error.message}`, 'red');
        return null;
    }
}

// Función para extraer datos de un país específico
async function extractCountryData(country, sessionId = null) {
    try {
        log(`🏛️  Extrayendo datos de ${country}...`, 'cyan');
        
        const payload = {
            country: country,
            companyDB: 'SBO_GT_STIA_PROD'
        };
        
        if (sessionId) {
            payload.sessionId = sessionId;
        }
        
        const response = await axios.post(`${CONFIG.baseUrl}/api/sap/exchange-rates`, payload);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.error || 'Error desconocido');
        }
    } catch (error) {
        log(`❌ Error extrayendo datos de ${country}: ${error.message}`, 'red');
        return null;
    }
}

// Función para obtener datos BCCR actuales
async function getBCCRData() {
    try {
        log('🏦 Obteniendo datos actuales del BCCR...', 'cyan');
        
        const response = await axios.get(`${CONFIG.baseUrl}/api/sap/demo/bccr-rates`);
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.error || 'Error desconocido');
        }
    } catch (error) {
        log(`❌ Error obteniendo datos BCCR: ${error.message}`, 'red');
        return null;
    }
}

// Función para generar reporte en formato tabla
function generateTableReport(data) {
    log('\n📊 REPORTE DE TIPOS DE CAMBIO SAP', 'bright');
    log('═'.repeat(80), 'blue');
    
    if (!data || Object.keys(data).length === 0) {
        log('❌ No hay datos disponibles', 'red');
        return;
    }
    
    Object.keys(data).forEach(country => {
        const countryData = data[country];
        
        log(`\n🏛️  ${country.toUpperCase()}`, 'magenta');
        log('-'.repeat(50), 'blue');
        
        if (countryData.success && countryData.data && countryData.data.length > 0) {
            log('Fecha       | Moneda | Tasa      | Fuente', 'cyan');
            log('-'.repeat(50), 'blue');
            
            countryData.data.forEach(rate => {
                const fecha = formatDate(rate.date || rate.Date);
                const moneda = (rate.currency || rate.Currency || 'N/A').padEnd(6);
                const tasa = (rate.rate || rate.Rate || 'N/A').toString().padEnd(8);
                const fuente = (rate.source || rate.Source || 'SAP').substring(0, 10);
                
                log(`${fecha} | ${moneda} | ${tasa} | ${fuente}`, 'reset');
            });
        } else {
            log('❌ Sin datos disponibles', 'red');
        }
    });
}

// Función para generar CSV
function generateCSV(data, bccrData = null) {
    let csvContent = 'Pais,Fecha,Moneda,Tasa,Fuente,Timestamp\n';
    
    // Agregar datos SAP
    Object.keys(data).forEach(country => {
        const countryData = data[country];
        
        if (countryData.success && countryData.data && countryData.data.length > 0) {
            countryData.data.forEach(rate => {
                const fecha = formatDate(rate.date || rate.Date);
                const moneda = rate.currency || rate.Currency || 'N/A';
                const tasa = rate.rate || rate.Rate || 'N/A';
                const fuente = rate.source || rate.Source || 'SAP';
                const timestamp = new Date().toISOString();
                
                csvContent += `${country},${fecha},${moneda},${tasa},${fuente},${timestamp}\n`;
            });
        }
    });
    
    // Agregar datos BCCR si están disponibles
    if (bccrData && bccrData.costaRica && bccrData.costaRica.data) {
        bccrData.costaRica.data.forEach(rate => {
            const fecha = formatDate(rate.date);
            const moneda = rate.currency;
            const tasa = rate.rate;
            const fuente = 'BCCR';
            const timestamp = rate.lastUpdate;
            
            csvContent += `COSTA_RICA_BCCR,${fecha},${moneda},${tasa},${fuente},${timestamp}\n`;
        });
    }
    
    return csvContent;
}

// Función principal
async function main() {
    const args = process.argv.slice(2);
    const country = args.find(arg => !arg.startsWith('--'));
    const includeCSV = args.includes('--csv');
    const includeBCCR = args.includes('--bccr');
    
    log('🚀 Iniciando extracción de datos SAP...', 'bright');
    
    try {
        // Obtener sesión SAP
        const sessionId = await getSAPSession();
        
        let sapData = null;
        let bccrData = null;
        
        // Extraer datos según parámetros
        if (country) {
            // Extraer datos de un país específico
            const countryData = await extractCountryData(country.toUpperCase(), sessionId);
            if (countryData) {
                sapData = { [country.toUpperCase()]: countryData };
            }
        } else {
            // Extraer datos de todos los países
            sapData = await extractMultiCountryData(sessionId);
        }
        
        // Obtener datos BCCR si se solicita
        if (includeBCCR) {
            bccrData = await getBCCRData();
        }
        
        // Generar reportes
        if (sapData) {
            generateTableReport(sapData);
            
            // Guardar JSON
            const outputData = {
                timestamp: new Date().toISOString(),
                sapData: sapData,
                bccrData: bccrData
            };
            
            fs.writeFileSync(CONFIG.outputFile, JSON.stringify(outputData, null, 2));
            log(`\n💾 Datos guardados en: ${CONFIG.outputFile}`, 'green');
            
            // Generar CSV si se solicita
            if (includeCSV) {
                const csvContent = generateCSV(sapData, bccrData);
                fs.writeFileSync(CONFIG.csvFile, csvContent);
                log(`📊 CSV generado en: ${CONFIG.csvFile}`, 'green');
            }
            
            // Mostrar datos BCCR si están disponibles
            if (bccrData) {
                log('\n🏦 DATOS ACTUALES BCCR', 'bright');
                log('═'.repeat(50), 'blue');
                if (bccrData.costaRica && bccrData.costaRica.data) {
                    bccrData.costaRica.data.forEach(rate => {
                        log(`${rate.currency}: ${rate.rate} (${rate.date})`, 'green');
                    });
                }
            }
            
        } else {
            log('❌ No se pudieron extraer datos', 'red');
        }
        
    } catch (error) {
        log(`❌ Error en la extracción: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Mostrar ayuda
function showHelp() {
    log('\n📖 USO DEL SCRIPT:', 'bright');
    log('node extract_sap_data.js [país] [opciones]', 'cyan');
    log('\nEjemplos:', 'bright');
    log('node extract_sap_data.js                    # Extraer todos los países', 'green');
    log('node extract_sap_data.js COSTA_RICA         # Extraer solo Costa Rica', 'green');
    log('node extract_sap_data.js --csv              # Incluir archivo CSV', 'green');
    log('node extract_sap_data.js --bccr             # Incluir datos BCCR', 'green');
    log('node extract_sap_data.js COSTA_RICA --csv --bccr  # Completo', 'green');
    log('\nOpciones:', 'bright');
    log('--csv    Generar archivo CSV adicional', 'yellow');
    log('--bccr   Incluir datos actuales del BCCR', 'yellow');
    log('--help   Mostrar esta ayuda', 'yellow');
}

// Verificar si se solicita ayuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Ejecutar script principal
main().catch(error => {
    log(`❌ Error fatal: ${error.message}`, 'red');
    process.exit(1);
});