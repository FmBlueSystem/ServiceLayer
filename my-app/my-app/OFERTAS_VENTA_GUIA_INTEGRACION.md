# 💼 Guía de Integración - Módulo de Ofertas de Venta

## 📋 Resumen del Proyecto

Se ha implementado exitosamente el **módulo de Ofertas de Venta** en el sistema Sistema ERP multi-compañía, manteniendo **100% de consistencia** con el diseño, arquitectura y patrones existentes.

---

## 🎯 Funcionalidades Implementadas

### ✅ **Completamente Funcional:**
1. **Nueva Oferta Manual** - Crear ofertas desde cero
2. **Crear Oferta desde Orden** - Convertir órdenes existentes
3. **Consultar Ofertas** - Búsqueda y filtrado avanzado
4. **Convertir a Orden** - Transformar ofertas aprobadas
5. **Reportes** - Base para reportes personalizados
6. **Navegación Integrada** - Menú principal actualizado

### 🔄 **Flujo de Trabajo:**
```
Cliente → Oferta → Aprobación → Orden de Venta → Entrega
```

---

## 📁 Archivos Creados/Modificados

### **Nuevos Archivos:**
```
├── public/ofertas-venta.html              # Página principal del módulo
└── OFERTAS_VENTA_GUIA_INTEGRACION.md     # Esta guía
```

### **Archivos Modificados:**
```
├── public/dashboard.html                   # Menú + card de navegación
├── src/services/sapService.js             # Métodos para Quotations
└── src/routes/sap.js                      # APIs REST para ofertas
```

---

## 🎨 Diseño Visual Mantenido

### **Colores del Sistema (100% Respetados):**
```css
--sap-blue: #0070E0           /* Color primario */
--sap-dark-blue: #003B6B      /* Headers y títulos */
--sap-light-blue: #E6F3FF     /* Fondos y hover */
--sap-success: #107E3E        /* Acciones positivas */
--sap-error: #E74C3C          /* Errores */
--sap-warning: #F39C12        /* Advertencias */
```

### **Componentes Reutilizados:**
- ✅ **Headers** con gradiente SAP estándar
- ✅ **Formularios** con `form-grid` y `form-group`
- ✅ **Tablas** con hover effects y paginación
- ✅ **Botones** siguiendo convenciones existentes
- ✅ **Alertas** con sistema de notificaciones unificado
- ✅ **Tabs** idénticos a módulo de órdenes

---

## 🔧 APIs Implementadas

### **Endpoints Nuevos en `/api/sap/`:**

#### 1. **Crear Oferta**
```javascript
POST /api/sap/create-quotation
{
  "sessionId": "string",
  "companyDB": "SBO_GT_STIA_PROD",
  "quotationData": {
    "CardCode": "C20000",
    "CardName": "Cliente Test",
    "DocDate": "2025-01-15",
    "ValidUntil": "2025-02-15",
    "Comments": "Oferta comercial",
    "DocumentLines": [
      {
        "ItemCode": "A00001",
        "ItemDescription": "Producto Test",
        "Quantity": 10,
        "Price": 100.00,
        "LineNum": 0
      }
    ]
  }
}
```

#### 2. **Consultar Ofertas**
```javascript
POST /api/sap/quotations
{
  "sessionId": "string",
  "companyDB": "SBO_GT_STIA_PROD",
  "filters": {
    "cardCode": "C20000",     // Opcional
    "docNum": 123,            // Opcional
    "dateFrom": "2025-01-01", // Opcional
    "dateTo": "2025-01-31",   // Opcional
    "limit": 50,
    "offset": 0
  }
}
```

#### 3. **Convertir Oferta a Orden**
```javascript
POST /api/sap/convert-quotation-to-order
{
  "sessionId": "string",
  "companyDB": "SBO_GT_STIA_PROD",
  "quotationDocEntry": 123
}
```

---

## 🔗 Integración con SAP Service Layer

### **Métodos Agregados a `sapService.js`:**

```javascript
// Crear oferta de venta
async createQuotation(sessionId, quotationData, companyDB)

// Obtener ofertas con filtros
async getQuotations(sessionId, filters, companyDB)

// Convertir oferta a orden
async convertQuotationToOrder(sessionId, quotationDocEntry, companyDB)
```

### **Endpoints SAP Utilizados:**
```
POST /b1s/v1/Quotations                    # Crear oferta
GET  /b1s/v1/Quotations                    # Consultar ofertas
GET  /b1s/v1/Quotations({docEntry})        # Obtener oferta específica
POST /b1s/v1/Orders                        # Crear orden desde oferta
```

---

## 🚀 Cómo Usar el Módulo

### **1. Acceso al Módulo:**
- Dashboard → Card "Ofertas de Venta" → `/ofertas-venta`
- Menú principal → "💼 Ofertas de Venta"

### **2. Crear Nueva Oferta:**
1. Seleccionar compañía
2. Buscar cliente por código/nombre
3. Configurar fechas (documento + validez)
4. Agregar artículos con cantidad/precio
5. Crear oferta

### **3. Crear desde Orden:**
1. Tab "Desde Orden"
2. Buscar orden existente
3. Seleccionar orden
4. Vista previa y confirmar

### **4. Consultar/Gestionar:**
1. Tab "Consultar Ofertas"
2. Filtros por número, cliente, fechas
3. Acciones: Ver, Convertir a Orden

---

## 📊 Estados de Ofertas

| Estado | Descripción | Acciones Disponibles |
|--------|-------------|---------------------|
| **Abierta (O)** | Pendiente de aprobación | Ver, Convertir |
| **Aprobada (A)** | Lista para conversión | Ver, Convertir |
| **Cerrada (C)** | Procesada/Finalizada | Solo Ver |
| **Rechazada (R)** | No aprobada | Solo Ver |

---

## 🔐 Seguridad y Validaciones

### **Frontend:**
- ✅ Validación de sesión SAP activa
- ✅ Validación de campos obligatorios
- ✅ Verificación de permisos por compañía
- ✅ Sanitización de entrada de usuario

### **Backend:**
- ✅ Autenticación via sessionId
- ✅ Validación de headers SAP
- ✅ Logging completo de operaciones
- ✅ Manejo de errores robusto

---

## 🌐 Multi-Compañía

El módulo soporta completamente el esquema multi-compañía:

```javascript
const databases = [
  'SBO_GT_STIA_PROD',  // Guatemala
  'SBO_HO_STIA_PROD',  // Honduras  
  'SBO_PA_STIA_PROD',  // Panamá
  'SBO_STIACR_PROD'    // Costa Rica
];
```

### **Funciones que operan en todas las compañías:**
- Consulta de ofertas consolidada
- Búsqueda multi-empresa
- Reportes consolidados

---

## ⚡ Rendimiento

### **Optimizaciones Implementadas:**
- ✅ **Paginación:** Límite de 50 registros por consulta
- ✅ **Filtros OData:** Búsquedas eficientes en Service Layer
- ✅ **Selección de campos:** Solo campos necesarios
- ✅ **Carga diferida:** Tabs cargan datos solo cuando se activan
- ✅ **Timeout management:** Conexiones con límite de tiempo

---

## 📈 Métricas y Logging

### **Logs Capturados:**
```javascript
logger.info('Creating quotation in SAP Service Layer', {
  sessionId: 'present',
  companyDB: 'SBO_GT_STIA_PROD',
  customerCode: 'C20000',
  itemCount: 3
});
```

### **Puntos de Monitoreo:**
- Creación de ofertas por compañía
- Tiempo de respuesta de Service Layer
- Tasas de conversión oferta → orden
- Errores de validación

---

## 🧪 Testing

### **Casos de Prueba Recomendados:**

1. **Funcionalidad Básica:**
   - Crear oferta con 1 artículo
   - Crear oferta con múltiples artículos
   - Búsqueda por diferentes filtros
   - Conversión a orden exitosa

2. **Validaciones:**
   - Cliente no seleccionado
   - Artículos sin precio
   - Fechas inválidas
   - Sesión expirada

3. **Multi-Compañía:**
   - Crear ofertas en diferentes países
   - Búsqueda consolidada
   - Permisos por compañía

---

## 🔄 Extensiones Futuras

### **Funcionalidades Pendientes:**
1. **Vista Detallada de Ofertas**
   - Modal con información completa
   - Historial de cambios
   - Documentos adjuntos

2. **Reportes Avanzados**
   - Dashboard de ofertas
   - Métricas de conversión
   - Análisis por vendedor

3. **Flujo de Aprobación**
   - Workflow configurable
   - Notificaciones automáticas
   - Escalación por montos

4. **Plantillas de Ofertas**
   - Ofertas predefinidas
   - Catálogo de productos
   - Precios automáticos

---

## ⚙️ Configuración Sistema ERP

### **Permisos Requeridos:**
```
- Quotations (OQUT): Read, Create, Update
- Business Partners (OCRD): Read
- Items (OITM): Read
- Sales Orders (ORDR): Create
```

### **Service Layer Configuration:**
```xml
<serviceLayer>
  <quotations enabled="true" />
  <businessPartners enabled="true" />
  <items enabled="true" />
  <orders enabled="true" />
</serviceLayer>
```

---

## 🚨 Troubleshooting

### **Errores Comunes:**

1. **"SessionId is required"**
   - Verificar autenticación SAP
   - Renovar sesión si expiró

2. **"Failed to create sales quotation"**
   - Verificar permisos de usuario
   - Validar estructura de DocumentLines

3. **"No hay sesión activa para la compañía"**
   - Verificar login multi-compañía
   - Confirmar connectividad con Service Layer

---

## 📞 Contacto y Soporte

**Desarrollado por:** BlueSystemIO  
**Integración SAP:** Service Layer v1  
**Compatibilidad:** Sistema ERP 10.0+  

Para soporte técnico, verificar logs en:
```bash
# Logs de aplicación
cat logs/app.log | grep "quotation"

# Logs de SAP Service Layer
cat logs/sap-service.log | grep "Quotations"
```

---

## ✅ Checklist de Implementación

- [x] Análisis del sistema existente
- [x] Extracción del diseño visual
- [x] Creación de componentes UI
- [x] Integración con menú principal
- [x] Desarrollo de APIs backend
- [x] Integración con SAP Service Layer
- [x] Implementación de funcionalidades core
- [x] Testing de flujos principales
- [x] Documentación completa

**🎉 Módulo de Ofertas de Venta - COMPLETAMENTE INTEGRADO**

---

*Documento generado automáticamente el 11 de octubre de 2025*