# Configuración de Autorizaciones SAP B1 - Usuario Consultas
## Licencia: Indirect Access User

---

## 📋 INFORMACIÓN DEL USUARIO

```
Usuario SAP: Consultas
Password: Stia123*
Tipo Licencia: SAP Business One Indirect Access User
Base de Datos: SBO_STIACR_PROD (Costa Rica)
```

---

## 🎯 MÓDULOS REQUERIDOS

El usuario necesita acceso a:
1. **Ofertas de Venta** (Sales Quotations)
2. **Inventario** (Items, Stock)
3. **Clientes** (Business Partners - Customers)

---

## 🔧 CONFIGURACIÓN EN SAP BUSINESS ONE

### **Acceso Requerido:**
- Usuario con privilegios de **Super User** o **Administration**
- Acceso al módulo de **Administration**

---

## PASO 1: ACCEDER A AUTORIZACIONES

```
1. Abrir SAP Business One Client
2. Conectarse a la base de datos: SBO_STIACR_PROD
3. Ir a: Administration → System Initialization → Authorizations
4. Buscar usuario: "Consultas"
```

---

## PASO 2: AUTORIZACIONES GENERALES (GENERAL AUTHORIZATIONS)

### **A. Business Partners (Socio de Negocios)**

**Ubicación:** General Authorizations → Business Partners

**Configuración:**
```
☑ Business Partners - Master Data
  Autorización: Read Only o Full Authorization

  Sub-opciones:
  ☑ Customer - Master Data
  ☑ Display BP Master Data
  ☑ Add Business Partner Master Data (si necesita crear clientes)
  ☑ Update Business Partner Master Data (si necesita modificar)
```

**Permisos Mínimos para Consultas:**
- ✅ Read Only (lectura)
- ⚠️ Full Authorization (si necesita crear/modificar clientes)

---

## PASO 3: AUTORIZACIONES DE VENTAS (SALES - A/R)

### **B. Sales Quotations (Ofertas de Venta)**

**Ubicación:** Sales - A/R → Sales Quotations

**Configuración:**
```
☑ Sales Quotations
  Autorización: Full Authorization

  Sub-opciones:
  ☑ Display Sales Quotation
  ☑ Add Sales Quotation
  ☑ Update Sales Quotation
  ☑ Delete Sales Quotation (opcional)
  ☑ Copy To (para convertir a orden)
```

**Permisos Mínimos:**
- ✅ Full Authorization (para crear/modificar ofertas)

### **C. Sales Orders (Órdenes de Venta)**

**Ubicación:** Sales - A/R → Sales Orders

**Configuración:**
```
☑ Sales Orders
  Autorización: Read Only o Full Authorization

  Sub-opciones:
  ☑ Display Sales Order
  ☑ Add Sales Order (si necesita crear desde oferta)
```

**Permisos Mínimos:**
- ✅ Read Only (para ver órdenes)
- ⚠️ Full Authorization (si necesita crear órdenes)

---

## PASO 4: AUTORIZACIONES DE INVENTARIO (INVENTORY)

### **D. Items - Master Data (Artículos)**

**Ubicación:** Inventory → Items - Master Data

**Configuración:**
```
☑ Items - Master Data
  Autorización: Read Only o Full Authorization

  Sub-opciones:
  ☑ Display Item Master Data
  ☑ Item Price List
  ☑ Item Groups
```

**Permisos Mínimos:**
- ✅ Read Only (para consultar artículos)

### **E. Inventory Transactions (Transacciones de Inventario)**

**Ubicación:** Inventory → Inventory Transactions

**Configuración (Opcional):**
```
☑ Inventory Reports
  Autorización: Read Only

  Sub-opciones:
  ☑ Stock Status Report
  ☑ Inventory Posting List
```

**Permisos Mínimos:**
- ⚠️ Read Only (solo si necesita reportes de inventario)

---

## PASO 5: AUTORIZACIONES ADICIONALES

### **F. Price Lists (Listas de Precios)**

**Ubicación:** General Authorizations → Price Lists

**Configuración:**
```
☑ Price Lists
  Autorización: Read Only
```

### **G. Currency (Monedas)**

**Ubicación:** General Authorizations → Currency

**Configuración:**
```
☑ Display Currency
  Autorización: Read Only
```

---

## 📊 RESUMEN DE AUTORIZACIONES

| Módulo | Objeto | Autorización | Obligatorio |
|--------|--------|--------------|-------------|
| **General** | Business Partners | Read Only | ✅ Sí |
| **Sales A/R** | Sales Quotations | Full Authorization | ✅ Sí |
| **Sales A/R** | Sales Orders | Read Only | ✅ Sí |
| **Inventory** | Items - Master Data | Read Only | ✅ Sí |
| **Inventory** | Inventory Reports | Read Only | ⚠️ Opcional |
| **General** | Price Lists | Read Only | ⚠️ Opcional |

---

## 🔐 VERIFICACIÓN DE PERMISOS

### **Método 1: Desde SAP B1 Client**

```
1. Cerrar sesión del usuario Consultas
2. Volver a iniciar sesión en SAP B1 Client
3. Intentar:
   ✓ Abrir módulo Sales - A/R → Sales Quotations
   ✓ Consultar un Business Partner
   ✓ Buscar un Item (artículo)
```

### **Método 2: Desde Service Layer (API)**

Usar el siguiente script de prueba:

```bash
# Login
curl -k -X POST https://sap-stiacmzdr-sl.skyinone.net:50000/b1s/v1/Login \
  -H "Content-Type: application/json" \
  -d '{
    "CompanyDB": "SBO_STIACR_PROD",
    "UserName": "Consultas",
    "Password": "Stia123*"
  }'

# Obtener SessionId de la respuesta
# Luego probar:

# Test 1: BusinessPartners
curl -k -X GET 'https://sap-stiacmzdr-sl.skyinone.net:50000/b1s/v1/BusinessPartners?$top=1' \
  -H "Cookie: B1SESSION=[SESSION_ID]"

# Test 2: Items
curl -k -X GET 'https://sap-stiacmzdr-sl.skyinone.net:50000/b1s/v1/Items?$top=1' \
  -H "Cookie: B1SESSION=[SESSION_ID]"

# Test 3: Quotations
curl -k -X GET 'https://sap-stiacmzdr-sl.skyinone.net:50000/b1s/v1/Quotations?$top=1' \
  -H "Cookie: B1SESSION=[SESSION_ID]"
```

**Resultado esperado:**
- ✅ HTTP 200 con datos (permisos OK)
- ❌ HTTP 401 o Error -3000 (faltan permisos)

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **1. Licencia Indirect Access**

SAP puede tener restricciones sobre qué autorizaciones se pueden asignar a usuarios Indirect Access:

```
✅ Generalmente permitido:
   - Lectura de maestros (Business Partners, Items)
   - Consultas de documentos
   - Reportes básicos

⚠️ Puede requerir aprobación SAP:
   - Creación de documentos (Quotations, Orders)
   - Modificación de maestros
   - Operaciones transaccionales
```

**Recomendación:** Consultar con el partner SAP sobre restricciones específicas.

### **2. Authorization Groups (Grupos de Autorización)**

Como alternativa, se pueden usar **Authorization Groups** para facilitar la gestión:

```
Opción A: Crear grupo "Ventas - Consultas"
  - Asignar todas las autorizaciones necesarias al grupo
  - Asignar el grupo al usuario Consultas

Ventaja: Más fácil de mantener y replicar
```

### **3. Data Ownership (Propiedad de Datos)**

Verificar si el usuario debe tener restricciones de datos:

```
Sales - A/R → Sales Quotations → Ownership:
  ☐ All Documents
  ☑ Own Documents Only (solo sus propias ofertas)
```

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### **Error: "No authorization for this transaction"**

**Causa:** Falta autorización específica
**Solución:** Verificar que la autorización esté marcada y guardada

### **Error: "User license limit exceeded"**

**Causa:** Límite de licencias Indirect Access
**Solución:** Verificar licencias disponibles con SAP License Manager

### **Error: "The logged-on user does not have permission to use this object" (-3000)**

**Causa:** Falta autorización a nivel de objeto Service Layer
**Solución:**
1. Verificar autorizaciones en General Authorizations
2. Re-login para refrescar permisos
3. Verificar que el objeto esté habilitado para Indirect Access

### **Los cambios no se reflejan**

**Causa:** Sesión activa con permisos antiguos
**Solución:**
1. Cerrar todas las sesiones SAP del usuario
2. Logout de Service Layer
3. Volver a iniciar sesión

---

## 📝 CHECKLIST DE CONFIGURACIÓN

```
□ 1. Acceder a SAP B1 Administration
□ 2. Ir a System Initialization → Authorizations
□ 3. Buscar usuario "Consultas"
□ 4. Configurar General Authorizations:
    □ Business Partners (Read Only/Full)
    □ Price Lists (Read Only)
□ 5. Configurar Sales - A/R:
    □ Sales Quotations (Full Authorization)
    □ Sales Orders (Read Only/Full)
□ 6. Configurar Inventory:
    □ Items - Master Data (Read Only)
□ 7. Guardar cambios (Ctrl+S)
□ 8. Cerrar sesiones activas del usuario
□ 9. Probar login y permisos
□ 10. Verificar funcionalidad en aplicación web
```

---

## 🔄 PASOS POST-CONFIGURACIÓN

### **1. Probar desde Aplicación Web**

```
1. Login web: https://localhost:3443/login
   Usuario: Consultas
   Password: Stia123*

2. Acceder a: /ofertas-venta.html

3. Probar:
   ✓ Búsqueda de clientes
   ✓ Búsqueda de artículos
   ✓ Creación de oferta
   ✓ Consulta de ofertas existentes
```

### **2. Verificar en Logs**

```bash
# Ver logs del servidor
tail -f /mnt/c/Projects/ServiceLayer/logs/combined.log

# Buscar errores -3000
grep "3000" /mnt/c/Projects/ServiceLayer/logs/combined.log
```

---

## 📞 CONTACTO DE SOPORTE

**Si los permisos no funcionan después de la configuración:**

1. **Verificar con Partner SAP:**
   - Confirmar que licencia Indirect Access permite estas operaciones
   - Solicitar documentación específica de restricciones

2. **Revisar Logs de SAP:**
   - SAP B1 Server → Event Viewer
   - Buscar errores de autorización

3. **Alternativa:**
   - Considerar upgrade a licencia Professional para usuario clave
   - Implementar arquitectura de usuario de servicio

---

## 🎯 RESULTADO ESPERADO

Después de configurar correctamente las autorizaciones:

```
✅ Usuario Consultas puede:
   - Ver clientes (Business Partners)
   - Buscar artículos (Items)
   - Crear ofertas de venta (Sales Quotations)
   - Consultar ofertas existentes
   - Convertir ofertas a órdenes
   - Ver dashboard de inventario

✅ Aplicación web funciona completamente:
   - /articulos.html → Consulta de artículos
   - /ofertas-venta.html → Gestión de ofertas
   - /dashboard-inventario.html → Reportes de inventario
```

---

**Documento generado:** 2025-10-21
**Sistema:** ServiceLayer Multi-Regional SAP
**Usuario:** Consultas (Indirect Access)
**Versión SAP:** 1000191
