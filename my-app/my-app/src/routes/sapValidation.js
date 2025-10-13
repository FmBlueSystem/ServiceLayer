const express = require('express');
const router = express.Router();
const sapService = require('../services/sapService');
const logger = require('../config/logger');

// Configuración de bases de datos SAP
const SAP_DATABASES = [
    {
        name: 'SBO_GT_STIA_PROD',
        displayName: 'Guatemala 🇬🇹',
        country: 'GT',
        flag: '🇬🇹'
    },
    {
        name: 'SBO_HO_STIA_PROD', 
        displayName: 'Honduras 🇭🇳',
        country: 'HO',
        flag: '🇭🇳'
    },
    {
        name: 'SBO_PA_STIA_PROD',
        displayName: 'Panamá 🇵🇦',
        country: 'PA', 
        flag: '🇵🇦'
    },
    {
        name: 'SBO_STIACR_PROD',
        displayName: 'Costa Rica 🇨🇷',
        country: 'CR',
        flag: '🇨🇷'
    }
];

// Validar acceso a todas las bases de datos
router.get('/databases/validate', async (req, res) => {
    try {
        logger.info('Validating access to all SAP databases');
        
        const validationResults = [];
        
        for (const database of SAP_DATABASES) {
            const startTime = Date.now();
            
            try {
                // Test basic connectivity
                const connectionResult = await sapService.testConnection();
                
                if (connectionResult.success) {
                    const responseTime = Date.now() - startTime;
                    
                    validationResults.push({
                        ...database,
                        status: 'connected',
                        responseTime: `${responseTime}ms`,
                        lastCheck: new Date().toISOString(),
                        accessible: true
                    });
                    
                    logger.info(`Database ${database.name} - Connected successfully`, {
                        responseTime: `${responseTime}ms`
                    });
                } else {
                    validationResults.push({
                        ...database,
                        status: 'error',
                        error: connectionResult.error,
                        lastCheck: new Date().toISOString(),
                        accessible: false
                    });
                    
                    logger.warn(`Database ${database.name} - Connection failed`, {
                        error: connectionResult.error
                    });
                }
            } catch (error) {
                validationResults.push({
                    ...database,
                    status: 'error',
                    error: error.message,
                    lastCheck: new Date().toISOString(),
                    accessible: false
                });
                
                logger.error(`Database ${database.name} - Validation error`, {
                    error: error.message
                });
            }
        }
        
        const connectedCount = validationResults.filter(db => db.accessible).length;
        
        res.json({
            success: true,
            summary: {
                total: SAP_DATABASES.length,
                connected: connectedCount,
                connectionRate: `${Math.round((connectedCount / SAP_DATABASES.length) * 100)}%`
            },
            databases: validationResults
        });
        
    } catch (error) {
        logger.error('Error validating SAP databases', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to validate SAP databases',
            message: error.message
        });
    }
});

// Validar campos disponibles en tabla Items
router.get('/fields/validate', async (req, res) => {
    try {
        logger.info('Validating available fields in Items table');
        
        // Consulta para obtener metadatos de campos de la tabla Items
        const fieldsQuery = `
            SELECT TOP 1 
                ItemCode,
                ItemName,
                Price,
                InStock,
                Active,
                U_cod_proveedor
            FROM OITM 
            WHERE ItemCode IS NOT NULL
        `;
        
        try {
            // Intentar consultar con el campo U_cod_proveedor
            const result = await sapService.executeQuery(fieldsQuery);
            
            res.json({
                success: true,
                fieldsValidation: {
                    standardFields: {
                        ItemCode: 'available',
                        ItemName: 'available', 
                        Price: 'available',
                        InStock: 'available',
                        Active: 'available'
                    },
                    customFields: {
                        U_cod_proveedor: 'available'
                    }
                },
                sampleData: result.data || [],
                message: 'All fields including U_cod_proveedor are accessible'
            });
            
            logger.info('Field validation successful - U_cod_proveedor is accessible');
            
        } catch (error) {
            // Si falla, probar sin el campo personalizado
            logger.warn('Field validation with U_cod_proveedor failed, testing without it', {
                error: error.message
            });
            
            const basicFieldsQuery = `
                SELECT TOP 1 
                    ItemCode,
                    ItemName,
                    Price,
                    InStock,
                    Active
                FROM OITM 
                WHERE ItemCode IS NOT NULL
            `;
            
            try {
                const basicResult = await sapService.executeQuery(basicFieldsQuery);
                
                res.json({
                    success: true,
                    fieldsValidation: {
                        standardFields: {
                            ItemCode: 'available',
                            ItemName: 'available',
                            Price: 'available', 
                            InStock: 'available',
                            Active: 'available'
                        },
                        customFields: {
                            U_cod_proveedor: 'not_available'
                        }
                    },
                    sampleData: basicResult.data || [],
                    message: 'Standard fields available, U_cod_proveedor field not found',
                    warning: 'U_cod_proveedor field may not exist or user lacks permissions'
                });
                
            } catch (basicError) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to access Items table',
                    message: basicError.message
                });
            }
        }
        
    } catch (error) {
        logger.error('Error validating fields', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Field validation failed',
            message: error.message
        });
    }
});

// Probar consulta específica con U_cod_proveedor
router.get('/test-provider-field', async (req, res) => {
    try {
        logger.info('Testing U_cod_proveedor field specifically');
        
        const testQuery = `
            SELECT TOP 5
                ItemCode,
                ItemName,
                U_cod_proveedor,
                Price,
                InStock
            FROM OITM 
            WHERE U_cod_proveedor IS NOT NULL
            ORDER BY ItemCode
        `;
        
        const result = await sapService.executeQuery(testQuery);
        
        res.json({
            success: true,
            message: 'U_cod_proveedor field is accessible and has data',
            sampleItems: result.data || [],
            count: result.data ? result.data.length : 0
        });
        
        logger.info('U_cod_proveedor field test successful', {
            itemsWithProvider: result.data ? result.data.length : 0
        });
        
    } catch (error) {
        logger.error('U_cod_proveedor field test failed', { error: error.message });
        
        res.json({
            success: false,
            error: 'U_cod_proveedor field not accessible',
            message: error.message,
            suggestion: 'Field may not exist or user lacks permissions'
        });
    }
});

module.exports = router;