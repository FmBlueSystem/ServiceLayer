const express = require('express');
const router = express.Router();
const sapService = require('../services/sapService');
const logger = require('../config/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Test SAP connection endpoint
router.get('/test-connection', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  logger.info('SAP connection test requested', {
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.requestId
  });

  try {
    const result = await sapService.testConnection();
    const totalTime = Date.now() - startTime;
    
    logger.info('SAP connection test completed', {
      success: result.success,
      totalTime: `${totalTime}ms`,
      requestId: req.requestId
    });

    res.json({
      ...result,
      totalProcessingTime: `${totalTime}ms`
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    logger.error('SAP connection test error', {
      error: error.message,
      totalTime: `${totalTime}ms`,
      requestId: req.requestId
    });

    res.status(503).json({
      success: false,
      error: error.userMessage || error.message,
      totalProcessingTime: `${totalTime}ms`,
      endpoint: sapService.sapEndpoint,
      timestamp: new Date().toISOString()
    });
  }
}));


// Get SAP system information
router.get('/system-info', asyncHandler(async (req, res) => {
  logger.info('SAP system info requested', {
    requestId: req.requestId,
    ip: req.ip
  });

  try {
    const result = await sapService.getSystemInfo();
    
    logger.info('SAP system info retrieved', {
      success: result.success,
      statusCode: result.statusCode,
      requestId: req.requestId
    });

    res.json({
      success: true,
      systemInfo: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP system info error', {
      error: error.message,
      requestId: req.requestId
    });

    res.status(503).json({
      success: false,
      error: error.userMessage || error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// SAP Service Layer Login for specific database
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password, companyDB } = req.body;

  if (!username || !password || !companyDB) {
    return res.status(400).json({
      success: false,
      error: 'Username, password, and companyDB are required'
    });
  }

  logger.info('SAP Service Layer login requested', {
    username,
    companyDB,
    requestId: req.requestId,
    ip: req.ip
  });

  try {
    const result = await sapService.loginToServiceLayer(companyDB, username, password);
    
    logger.info('SAP Service Layer login completed', {
      username,
      companyDB,
      success: result.success,
      requestId: req.requestId
    });

    if (result.success) {
      // Store session in memory or Redis for session management
      res.json({
        success: true,
        message: 'Login successful',
        sessionId: result.sessionId,
        companyDB: companyDB,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error || 'Login failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Service Layer login error', {
      username,
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(401).json({
      success: false,
      error: error.userMessage || 'Login failed',
      timestamp: new Date().toISOString()
    });
  }
}));

// SAP Service Layer Login for all databases
router.post('/login-all', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  const databases = [
    'SBO_GT_STIA_PROD',  // Guatemala
    'SBO_HO_STIA_PROD',  // Honduras
    'SBO_PA_STIA_PROD',  // Panama
    'SBO_STIACR_PROD'    // Costa Rica
  ];

  logger.info('SAP Service Layer multi-database login requested', {
    username,
    databases: databases.length,
    requestId: req.requestId,
    ip: req.ip
  });

  const loginResults = {};
  let successCount = 0;

  for (const companyDB of databases) {
    try {
      const result = await sapService.loginToServiceLayer(companyDB, username, password);
      loginResults[companyDB] = {
        success: result.success,
        sessionId: result.success ? result.sessionId : null,
        error: result.success ? null : (result.error || 'Login failed')
      };
      
      if (result.success) {
        successCount++;
      }
    } catch (error) {
      loginResults[companyDB] = {
        success: false,
        sessionId: null,
        error: error.message
      };
    }
  }

  logger.info('SAP Service Layer multi-database login completed', {
    username,
    successfulLogins: successCount,
    totalDatabases: databases.length,
    requestId: req.requestId
  });

  res.json({
    success: successCount > 0,
    message: `Successfully logged into ${successCount} of ${databases.length} databases`,
    results: loginResults,
    successCount,
    totalDatabases: databases.length,
    timestamp: new Date().toISOString()
  });
}));

// SAP Service Layer Logout
router.post('/logout', asyncHandler(async (req, res) => {
  const { sessionId, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Service Layer logout requested', {
    companyDB,
    requestId: req.requestId
  });

  try {
    const result = await sapService.logoutFromServiceLayer(sessionId);
    
    logger.info('SAP Service Layer logout completed', {
      companyDB,
      success: result.success,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      message: result.success ? 'Logout successful' : 'Logout failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Service Layer logout error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.json({
      success: false,
      error: error.userMessage || 'Logout failed',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Items with authentication
router.post('/items', asyncHandler(async (req, res) => {
  const { sessionId, filters = {}, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Items query requested', {
    companyDB,
    filters: Object.keys(filters),
    requestId: req.requestId
  });

  try {
    const result = await sapService.getItems(sessionId, filters, companyDB);
    
    logger.info('SAP Items query completed', {
      companyDB,
      itemCount: result.items?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: { value: result.items || [] },
      companyDB,
      filters,
      total: result.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Items query error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to retrieve items',
      timestamp: new Date().toISOString()
    });
  }
}));

// SAP authentication endpoint (deprecated - use /login instead)
router.post('/authenticate', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  logger.info('SAP authentication requested', {
    username,
    requestId: req.requestId,
    ip: req.ip
  });

  try {
    const result = await sapService.authenticate(username, password);
    
    logger.info('SAP authentication completed', {
      username,
      success: result.success,
      statusCode: result.statusCode,
      requestId: req.requestId
    });

    // Don't expose sensitive authentication data
    const sanitizedResult = {
      success: result.success,
      statusCode: result.statusCode,
      message: result.success ? 'Authentication successful' : 'Authentication failed',
      timestamp: new Date().toISOString()
    };

    if (result.success && result.data?.access_token) {
      sanitizedResult.hasToken = true;
      sanitizedResult.tokenType = result.data.token_type || 'Bearer';
    }

    res.json(sanitizedResult);
  } catch (error) {
    logger.error('SAP authentication error', {
      username,
      error: error.message,
      requestId: req.requestId
    });

    res.status(401).json({
      success: false,
      error: error.userMessage || 'Authentication failed',
      timestamp: new Date().toISOString()
    });
  }
}));

// Generic SAP API proxy endpoint
router.all('/proxy/*', asyncHandler(async (req, res) => {
  const sapPath = req.params[0] || '/';
  const method = req.method;
  const headers = {};
  
  // Forward relevant headers
  const forwardHeaders = ['authorization', 'content-type', 'accept'];
  forwardHeaders.forEach(header => {
    if (req.headers[header]) {
      headers[header] = req.headers[header];
    }
  });

  logger.info('SAP API proxy request', {
    method,
    sapPath,
    requestId: req.requestId,
    ip: req.ip,
    headers: Object.keys(headers)
  });

  try {
    const result = await sapService.callSAPAPI(sapPath, method, req.body, headers);
    
    logger.info('SAP API proxy response', {
      method,
      sapPath,
      statusCode: result.statusCode,
      success: result.success,
      requestId: req.requestId
    });

    // Forward SAP response headers
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        // Skip headers that might cause issues
        const skipHeaders = ['transfer-encoding', 'connection', 'content-encoding'];
        if (!skipHeaders.includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });
    }

    res.status(result.statusCode).json({
      success: result.success,
      data: result.data,
      statusCode: result.statusCode,
      sapEndpoint: sapPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP API proxy error', {
      method,
      sapPath,
      error: error.message,
      requestId: req.requestId
    });

    res.status(502).json({
      success: false,
      error: error.userMessage || error.message,
      sapEndpoint: sapPath,
      timestamp: new Date().toISOString()
    });
  }
}));

// SAP health status
router.get('/health', asyncHandler(async (req, res) => {
  const healthStatus = sapService.getHealthStatus();
  const connectionTest = await sapService.testConnection();
  
  res.json({
    service: 'SAP Service',
    configuration: healthStatus,
    connectivity: connectionTest,
    timestamp: new Date().toISOString()
  });
}));

// SAP service configuration
router.get('/config', asyncHandler(async (req, res) => {
  const config = sapService.getHealthStatus();
  
  res.json({
    service: 'SAP Service Configuration',
    endpoint: config.endpoint,
    timeout: config.timeout,
    retries: config.retries,
    sslVerification: config.sslVerification,
    timestamp: new Date().toISOString(),
    note: 'This endpoint shows non-sensitive configuration only'
  });
}));

// Test specific SAP endpoints
router.get('/test-endpoints', asyncHandler(async (req, res) => {
  logger.info('Testing multiple SAP endpoints', {
    requestId: req.requestId
  });

  const testEndpoints = [
    { path: '/', name: 'Root' },
    { path: '/sap/public/ping', name: 'Public Ping' },
    { path: '/sap/bc/ping', name: 'BC Ping' },
    { path: '/sap/bc/rest/system/info', name: 'System Info' },
    { path: '/sap/opu/odata/sap/', name: 'OData Services' }
  ];

  const results = [];

  for (const endpoint of testEndpoints) {
    try {
      const startTime = Date.now();
      const result = await sapService.callSAPAPI(endpoint.path);
      const responseTime = Date.now() - startTime;
      
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        success: result.success,
        statusCode: result.statusCode,
        responseTime: `${responseTime}ms`,
        available: result.statusCode < 500
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        path: endpoint.path,
        success: false,
        error: error.userMessage || error.message,
        available: false
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const availableCount = results.filter(r => r.available).length;

  logger.info('SAP endpoints test completed', {
    total: testEndpoints.length,
    successful: successCount,
    available: availableCount,
    requestId: req.requestId
  });

  res.json({
    summary: {
      total: testEndpoints.length,
      successful: successCount,
      available: availableCount,
      connectionScore: `${Math.round((availableCount / testEndpoints.length) * 100)}%`
    },
    results,
    timestamp: new Date().toISOString()
  });
}));

// Service Layer permissions diagnostic endpoint
router.post('/diagnose-permissions', asyncHandler(async (req, res) => {
  const { sessionId, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('Service Layer permissions diagnostic requested', {
    companyDB,
    requestId: req.requestId
  });

  const headers = {
    'Cookie': `B1SESSION=${sessionId}`,
    'Content-Type': 'application/json'
  };
  if (companyDB) {
    headers['CompanyDB'] = companyDB;
  }

  const diagnosticResults = {};

  // Lista de endpoints comunes para probar permisos
  const endpointsToTest = [
    { name: 'Metadata', path: '/$metadata' },
    { name: 'Users Service', path: '/UsersService' },
    { name: 'Items', path: '/Items?$top=1' },
    { name: 'Business Partners', path: '/BusinessPartners?$top=1' },
    { name: 'Company Service', path: '/CompanyService' },
    { name: 'Current User', path: '/Users' },
    { name: 'Service Layer Info', path: '/' }
  ];

  for (const endpoint of endpointsToTest) {
    try {
      const result = await sapService.callSAPAPI(`/b1s/v1${endpoint.path}`, 'GET', null, headers);
      
      diagnosticResults[endpoint.name] = {
        accessible: result.success,
        statusCode: result.statusCode,
        error: result.success ? null : (result.data ? JSON.parse(result.data).error?.message?.value : 'Unknown error')
      };
      
      // Si es exitoso, agregar información adicional
      if (result.success && result.data) {
        try {
          const data = JSON.parse(result.data);
          if (endpoint.name === 'Items' && data.value) {
            diagnosticResults[endpoint.name].itemCount = data.value.length;
          }
          if (endpoint.name === 'Business Partners' && data.value) {
            diagnosticResults[endpoint.name].bpCount = data.value.length;
          }
        } catch (parseError) {
          // Ignore parse errors for diagnostic
        }
      }
    } catch (error) {
      diagnosticResults[endpoint.name] = {
        accessible: false,
        statusCode: null,
        error: error.message
      };
    }
  }

  logger.info('Service Layer permissions diagnostic completed', {
    companyDB,
    accessibleEndpoints: Object.keys(diagnosticResults).filter(key => diagnosticResults[key].accessible).length,
    totalEndpoints: endpointsToTest.length,
    requestId: req.requestId
  });

  res.json({
    success: true,
    user: 'stifmolina2',
    companyDB,
    diagnostics: diagnosticResults,
    summary: {
      totalEndpoints: endpointsToTest.length,
      accessibleEndpoints: Object.keys(diagnosticResults).filter(key => diagnosticResults[key].accessible).length,
      blockedEndpoints: Object.keys(diagnosticResults).filter(key => !diagnosticResults[key].accessible).length
    },
    recommendations: {
      itemsAccessible: diagnosticResults['Items']?.accessible || false,
      needsServiceLayerPermissions: !diagnosticResults['Items']?.accessible,
      suggestedActions: [
        'Check SAP Service Layer Configuration Manager',
        'Verify user has REST API permissions',
        'Confirm Items (OITM) table access in Service Layer',
        'Check user license includes API access'
      ]
    },
    timestamp: new Date().toISOString()
  });
}));

// Get Business Partners with authentication
router.post('/business-partners', asyncHandler(async (req, res) => {
  const { sessionId, filters = {}, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Business Partners query requested', {
    companyDB,
    filters: Object.keys(filters),
    requestId: req.requestId
  });

  try {
    const result = await sapService.getBusinessPartners(sessionId, filters, companyDB);
    
    logger.info('SAP Business Partners query completed', {
      companyDB,
      partnerCount: result.businessPartners?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: { value: result.businessPartners || [] },
      companyDB,
      filters,
      total: result.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Business Partners query error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to retrieve business partners',
      timestamp: new Date().toISOString()
    });
  }
}));

// Create Sales Order
router.post('/create-sales-order', asyncHandler(async (req, res) => {
  const { sessionId, orderData, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!orderData || !orderData.CardCode) {
    return res.status(400).json({
      success: false,
      error: 'Order data with CardCode is required'
    });
  }

  logger.info('SAP Sales Order creation requested', {
    companyDB,
    customerCode: orderData.CardCode,
    lineCount: orderData.DocumentLines?.length || 0,
    requestId: req.requestId
  });

  try {
    const result = await sapService.createSalesOrder(sessionId, orderData, companyDB);
    
    if (result.success) {
      logger.info('SAP Sales Order creation completed', {
        companyDB,
        docEntry: result.docEntry,
        docNum: result.docNum,
        requestId: req.requestId
      });

      res.json({
        success: true,
        docEntry: result.docEntry,
        docNum: result.docNum,
        companyDB,
        message: `Sales Order ${result.docNum} created successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Sales Order creation failed', {
        companyDB,
        error: result.error,
        details: result.details,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        statusCode: result.statusCode,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Sales Order creation error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to create sales order',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Sales Orders with authentication
router.post('/sales-orders', asyncHandler(async (req, res) => {
  const { sessionId, filters = {}, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Sales Orders query requested', {
    companyDB,
    filters: Object.keys(filters),
    requestId: req.requestId
  });

  try {
    const result = await sapService.getSalesOrders(sessionId, filters, companyDB);
    
    logger.info('SAP Sales Orders query completed', {
      companyDB,
      orderCount: result.orders?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: { value: result.orders || [] },
      companyDB,
      filters,
      total: result.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Sales Orders query error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to retrieve sales orders',
      timestamp: new Date().toISOString()
    });
  }
}));

// Execute Custom SQL Query
router.post('/execute-query', asyncHandler(async (req, res) => {
  const { sessionId, sqlQuery, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!sqlQuery) {
    return res.status(400).json({
      success: false,
      error: 'SQL query is required'
    });
  }

  logger.info('SAP Custom SQL Query requested', {
    companyDB,
    queryLength: sqlQuery.length,
    requestId: req.requestId
  });

  try {
    const result = await sapService.executeCustomQuery(sessionId, sqlQuery, companyDB);
    
    logger.info('SAP Custom SQL Query completed', {
      companyDB,
      recordCount: result.data?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: result.data || [],
      companyDB,
      query: sqlQuery,
      recordCount: result.data?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Custom SQL Query error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to execute SQL query',
      timestamp: new Date().toISOString()
    });
  }
}));

// Create Sales Quotation
router.post('/create-quotation', asyncHandler(async (req, res) => {
  const { sessionId, quotationData, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!quotationData || !quotationData.CardCode) {
    return res.status(400).json({
      success: false,
      error: 'Quotation data with CardCode is required'
    });
  }

  logger.info('SAP Sales Quotation creation requested', {
    companyDB,
    customerCode: quotationData.CardCode,
    lineCount: quotationData.DocumentLines?.length || 0,
    requestId: req.requestId
  });

  try {
    const result = await sapService.createQuotation(sessionId, quotationData, companyDB);
    
    if (result.success) {
      logger.info('SAP Sales Quotation creation completed', {
        companyDB,
        docEntry: result.docEntry,
        docNum: result.docNum,
        requestId: req.requestId
      });

      res.json({
        success: true,
        docEntry: result.docEntry,
        docNum: result.docNum,
        companyDB,
        message: `Sales Quotation ${result.docNum} created successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Sales Quotation creation failed', {
        companyDB,
        error: result.error,
        details: result.details,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        statusCode: result.statusCode,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Sales Quotation creation error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to create sales quotation',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Sales Quotations with authentication
router.post('/quotations', asyncHandler(async (req, res) => {
  const { sessionId, filters = {}, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Sales Quotations query requested', {
    companyDB,
    filters: Object.keys(filters),
    requestId: req.requestId
  });

  try {
    const result = await sapService.getQuotations(sessionId, filters, companyDB);
    
    logger.info('SAP Sales Quotations query completed', {
      companyDB,
      quotationCount: result.quotations?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: { value: result.quotations || [] },
      companyDB,
      filters,
      total: result.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('SAP Sales Quotations query error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to retrieve sales quotations',
      timestamp: new Date().toISOString()
    });
  }
}));

// Convert Quotation to Sales Order
router.post('/convert-quotation-to-order', asyncHandler(async (req, res) => {
  const { sessionId, quotationDocEntry, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!quotationDocEntry) {
    return res.status(400).json({
      success: false,
      error: 'Quotation DocEntry is required'
    });
  }

  logger.info('SAP Quotation to Order conversion requested', {
    companyDB,
    quotationDocEntry,
    requestId: req.requestId
  });

  try {
    const result = await sapService.convertQuotationToOrder(sessionId, quotationDocEntry, companyDB);
    
    if (result.success) {
      logger.info('SAP Quotation to Order conversion completed', {
        companyDB,
        quotationDocNum: result.quotationDocNum,
        orderDocNum: result.orderDocNum,
        requestId: req.requestId
      });

      res.json({
        success: true,
        quotationDocNum: result.quotationDocNum,
        orderDocEntry: result.orderDocEntry,
        orderDocNum: result.orderDocNum,
        companyDB,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Quotation to Order conversion failed', {
        companyDB,
        error: result.error,
        details: result.details,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Quotation to Order conversion error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to convert quotation to order',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Financial Report - EEFF CR
router.post('/financial-report', asyncHandler(async (req, res) => {
  const { sessionId, reportType = 'EEFF_CR', companyDB = 'SBO_STIACR_PROD' } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Financial Report requested', {
    reportType,
    companyDB,
    requestId: req.requestId
  });

  try {
    const result = await sapService.getFinancialReport(sessionId, reportType, companyDB);
    
    if (result.success) {
      logger.info('SAP Financial Report completed', {
        reportType,
        companyDB,
        recordCount: result.data?.length || 0,
        requestId: req.requestId
      });

      res.json({
        success: true,
        reportType,
        data: result.data || [],
        companyDB,
        recordCount: result.data?.length || 0,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Financial Report failed', {
        reportType,
        companyDB,
        error: result.error,
        details: result.details,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        reportType,
        companyDB,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Financial Report error', {
      reportType,
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to generate financial report',
      timestamp: new Date().toISOString()
    });
  }
}));

// =================== EXCHANGE RATE ENDPOINTS ===================

// Get Exchange Rates by Country
router.post('/exchange-rates', asyncHandler(async (req, res) => {
  const { sessionId, country = 'COSTA_RICA', companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  logger.info('SAP Exchange Rates requested', {
    country,
    companyDB,
    requestId: req.requestId
  });

  try {
    const result = await sapService.getExchangeRates(sessionId, country, companyDB);
    
    if (result.success) {
      logger.info('SAP Exchange Rates completed', {
        country,
        companyDB,
        rateCount: result.data?.length || 0,
        source: result.source,
        requestId: req.requestId
      });

      res.json({
        success: true,
        country,
        source: result.source,
        data: result.data || [],
        companyDB,
        rateCount: result.data?.length || 0,
        lastUpdate: result.lastUpdate,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Exchange Rates failed', {
        country,
        companyDB,
        error: result.error,
        details: result.details,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        country,
        companyDB,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Exchange Rates error', {
      country,
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to fetch exchange rates',
      timestamp: new Date().toISOString()
    });
  }
}));

// Update Exchange Rates in SAP
router.post('/exchange-rates/update', asyncHandler(async (req, res) => {
  const { sessionId, rates, companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!rates || !Array.isArray(rates) || rates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Rates array is required and must not be empty'
    });
  }

  logger.info('SAP Exchange Rate Update requested', {
    companyDB,
    rateCount: rates.length,
    currencies: rates.map(r => r.currency),
    requestId: req.requestId
  });

  try {
    const result = await sapService.updateExchangeRatesInSAP(sessionId, rates, companyDB);
    
    if (result.success) {
      logger.info('SAP Exchange Rate Update completed', {
        companyDB,
        updatedCount: result.updatedCount,
        totalCount: result.totalCount,
        requestId: req.requestId
      });

      res.json({
        success: true,
        updatedCount: result.updatedCount,
        totalCount: result.totalCount,
        results: result.results,
        companyDB,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('SAP Exchange Rate Update failed', {
        companyDB,
        error: result.error,
        updatedCount: result.updatedCount,
        totalCount: result.totalCount,
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: result.error,
        updatedCount: result.updatedCount || 0,
        totalCount: result.totalCount || rates.length,
        companyDB,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('SAP Exchange Rate Update error', {
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to update exchange rates',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Exchange Rates by Multiple Countries
router.post('/exchange-rates/multi-country', asyncHandler(async (req, res) => {
  const { sessionId, countries = ['COSTA_RICA', 'HONDURAS', 'GUATEMALA', 'PANAMA'], companyDB } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required'
    });
  }

  if (!Array.isArray(countries) || countries.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Countries array is required and must not be empty'
    });
  }

  logger.info('SAP Multi-Country Exchange Rates requested', {
    countries,
    companyDB,
    requestId: req.requestId
  });

  try {
    const results = {};
    const errors = {};
    
    // Fetch rates for each country
    for (const country of countries) {
      try {
        const countryResult = await sapService.getExchangeRates(sessionId, country, companyDB);
        
        if (countryResult.success) {
          results[country] = {
            success: true,
            source: countryResult.source,
            data: countryResult.data,
            lastUpdate: countryResult.lastUpdate
          };
        } else {
          errors[country] = {
            success: false,
            error: countryResult.error,
            details: countryResult.details
          };
        }
      } catch (countryError) {
        errors[country] = {
          success: false,
          error: countryError.message
        };
      }
    }

    const successCount = Object.keys(results).length;
    const totalRateCount = Object.values(results).reduce((sum, result) => 
      sum + (result.data?.length || 0), 0);

    logger.info('SAP Multi-Country Exchange Rates completed', {
      countries,
      companyDB,
      successCount,
      errorCount: Object.keys(errors).length,
      totalRateCount,
      requestId: req.requestId
    });

    res.json({
      success: successCount > 0,
      countries,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      companyDB,
      successCount,
      errorCount: Object.keys(errors).length,
      totalRateCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('SAP Multi-Country Exchange Rates error', {
      countries,
      companyDB,
      error: error.message,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.userMessage || 'Failed to fetch multi-country exchange rates',
      timestamp: new Date().toISOString()
    });
  }
}));

// Update Costa Rica exchange rates automatically from BCCR to SAP
router.post('/exchange-rates/costa-rica/update-automatic', asyncHandler(async (req, res) => {
  const { sessionId, companyDB } = req.body;
  
  logger.info('Costa Rica automatic exchange rate update requested', {
    sessionId: sessionId ? 'present' : 'missing',
    companyDB: companyDB || 'COSTA_RICA',
    requestId: req.requestId
  });

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await sapService.updateCostaRicaExchangeRatesAutomatically(
      sessionId, 
      companyDB || 'COSTA_RICA'
    );

    if (result.success) {
      logger.info('Costa Rica automatic exchange rate update completed', {
        bccrRates: result.summary.bccrRates,
        sapUpdates: result.summary.sapUpdates,
        totalAttempts: result.summary.totalAttempts,
        companyDB: result.companyDB,
        requestId: req.requestId
      });

      res.json({
        success: true,
        message: `Costa Rica exchange rates updated successfully from BCCR`,
        summary: result.summary,
        bccrData: {
          source: result.bccrData.source,
          rateCount: result.bccrData.data?.length || 0,
          rates: result.bccrData.data?.map(r => ({
            currency: r.currency,
            rate: r.rate,
            indicator: r.indicator
          })) || []
        },
        sapUpdate: {
          successCount: result.sapUpdate.successCount,
          totalCount: result.sapUpdate.totalCount,
          results: result.sapUpdate.results?.map(r => ({
            currency: r.currency,
            rate: r.rate,
            success: r.success,
            error: r.error
          })) || []
        },
        companyDB: result.companyDB,
        lastUpdate: result.lastUpdate,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Costa Rica automatic exchange rate update failed', {
        error: result.error,
        companyDB: result.companyDB,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update exchange rates',
        companyDB: result.companyDB,
        lastUpdate: result.lastUpdate,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Costa Rica automatic exchange rate update error', {
      error: error.message,
      companyDB: companyDB || 'COSTA_RICA',
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.message,
      companyDB: companyDB || 'COSTA_RICA',
      timestamp: new Date().toISOString()
    });
  }
}));

// DEMO endpoint to show BCCR functionality without SAP authentication
router.get('/demo/bccr-rates', asyncHandler(async (req, res) => {
  logger.info('BCCR demo endpoint called');
  
  try {
    const bccrRates = await sapService.getBCCRExchangeRates();
    
    res.json({
      success: true,
      message: 'BCCR exchange rates retrieved successfully',
      timestamp: new Date().toISOString(),
      data: {
        costaRica: bccrRates,
        source: 'Banco Central de Costa Rica (BCCR)',
        credentials: {
          email: 'freddy@bluesystem.io',
          company: 'BlueSystem',
          token: '5R2***' // Partial token for security
        }
      }
    });
  } catch (error) {
    logger.error('BCCR demo endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to retrieve BCCR rates'
    });
  }
}));

// Execute Query Manager query endpoint
router.post('/execute-query-manager', asyncHandler(async (req, res) => {
  const { sessionId, companyDB, queryName } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required',
      timestamp: new Date().toISOString()
    });
  }

  if (!queryName) {
    return res.status(400).json({
      success: false,
      error: 'QueryName is required',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('Query Manager execution requested', {
    sessionId: sessionId ? 'present' : 'missing',
    companyDB: companyDB || 'current',
    queryName: queryName,
    requestId: req.requestId
  });

  try {
    const result = await sapService.executeQueryManager(sessionId, queryName, companyDB);
    
    logger.info('Query Manager execution completed', {
      companyDB: companyDB || 'current',
      queryName: queryName,
      recordCount: result.data?.length || 0,
      requestId: req.requestId
    });

    res.json({
      success: result.success,
      data: result.data || [],
      queryName: queryName,
      companyDB: companyDB || 'current',
      recordCount: result.data?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Query Manager execution error', {
      error: error.message,
      companyDB: companyDB || 'current',
      queryName: queryName,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to execute Query Manager query',
      details: error.message,
      queryName: queryName,
      companyDB: companyDB || 'current',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Balance Trial data (Gastos EEFF CR SubTotales)
router.post('/balance-trial', asyncHandler(async (req, res) => {
  const { sessionId, companyDB = 'SBO_STIACR_PROD' } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('Balance Trial query requested', {
    sessionId: sessionId ? 'present' : 'missing',
    companyDB: companyDB,
    requestId: req.requestId
  });

  try {
    const result = await sapService.getBalanceTrialData(sessionId, companyDB);
    
    if (result.success) {
      logger.info('Balance Trial query completed', {
        companyDB: companyDB,
        recordCount: result.data?.length || 0,
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: result.data || [],
        companyDB: companyDB,
        recordCount: result.data?.length || 0,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Balance Trial query failed', {
        error: result.error,
        companyDB: companyDB,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to execute Balance Trial query',
        companyDB: companyDB,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Balance Trial query error', {
      error: error.message,
      companyDB: companyDB,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.message,
      companyDB: companyDB,
      timestamp: new Date().toISOString()
    });
  }
}));

// Update Test Database with USD Sell Rate
router.post('/exchange-rates/test/update-usd-sell', asyncHandler(async (req, res) => {
  const { sessionId, companyDB = 'SBO_STIACR_TEST' } = req.body;
  
  logger.info('Test database USD sell rate update requested', {
    sessionId: sessionId ? 'present' : 'missing',
    companyDB: companyDB,
    requestId: req.requestId
  });

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await sapService.updateTestDatabaseWithUSDSellRate(sessionId, companyDB);

    if (result.success) {
      logger.info('Test database USD sell rate update completed successfully', {
        rate: result.bccrData.rate,
        currency: result.bccrData.currency,
        simulated: result.sapUpdate.simulated,
        companyDB: result.companyDB,
        requestId: req.requestId
      });

      res.json({
        success: true,
        message: `USD sell rate updated successfully in test database`,
        data: {
          bccrRate: {
            currency: result.bccrData.currency,
            rate: result.bccrData.rate,
            date: result.bccrData.date,
            source: result.bccrData.source
          },
          sapUpdate: {
            success: result.sapUpdate.success,
            simulated: result.sapUpdate.simulated,
            method: result.sapUpdate.method,
            rate: result.sapUpdate.rate,
            currency: result.sapUpdate.currency,
            date: result.sapUpdate.date
          },
          companyDB: result.companyDB,
          lastUpdate: result.lastUpdate
        },
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('Test database USD sell rate update failed', {
        error: result.error,
        companyDB: result.companyDB,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to update USD sell rate in test database',
        companyDB: result.companyDB,
        lastUpdate: result.lastUpdate,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Test database USD sell rate update error', {
      error: error.message,
      companyDB: companyDB,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.message,
      companyDB: companyDB,
      timestamp: new Date().toISOString()
    });
  }
}));

// Populate @FFF table in Guatemala test database
router.post('/populate-fff', asyncHandler(async (req, res) => {
  const { sessionId, data, companyDB = 'SBO_GT_STIA_TEST' } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'SessionId is required',
      timestamp: new Date().toISOString()
    });
  }

  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Data is required for @FFF table population',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('@FFF table population requested', {
    sessionId: sessionId ? 'present' : 'missing',
    companyDB: companyDB,
    dataCount: Array.isArray(data) ? data.length : 1,
    requestId: req.requestId
  });

  try {
    const result = await sapService.populateFFFTable(sessionId, data, companyDB);
    
    if (result.success) {
      logger.info('@FFF table population completed successfully', {
        companyDB: companyDB,
        successCount: result.successCount,
        totalProcessed: result.totalProcessed,
        requestId: req.requestId
      });

      res.json({
        success: true,
        message: `Successfully populated @FFF table with ${result.successCount} of ${result.totalProcessed} records`,
        data: {
          totalProcessed: result.totalProcessed,
          successCount: result.successCount,
          failedCount: result.failedCount,
          results: result.results,
          companyDB: result.companyDB
        },
        timestamp: result.timestamp
      });
    } else {
      logger.error('@FFF table population failed', {
        error: result.error,
        companyDB: companyDB,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to populate @FFF table',
        companyDB: companyDB,
        timestamp: result.timestamp
      });
    }

  } catch (error) {
    logger.error('@FFF table population error', {
      error: error.message,
      companyDB: companyDB,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      error: error.message,
      companyDB: companyDB,
      timestamp: new Date().toISOString()
    });
  }
}));

module.exports = router;