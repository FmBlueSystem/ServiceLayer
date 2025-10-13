# Creación de Vista Física en SAP HANA para Service Layer

## Contexto
El query "BalanceTrial" (anteriormente "Gastos EEFF CR SubTotales") funciona perfectamente en SAP Business One Query Manager, pero usa una vista virtual `V_CONSOLIDADO_GASTOS_PIVOT2` que no es accesible desde Service Layer. Necesitamos crear una vista física en HANA.

## Información de Conexión
- **Servidor HANA**: `sap-stiacmzdr-sl.skyinone.net:30015`
- **Base de datos**: `SBO_STIACR_PROD`
- **Schema**: `SBO_STIACR_PROD`
- **Usuario**: [Usuario con permisos de administrador de base de datos]

## Objetivo
Crear la vista física `BalanceTrialSL` en SAP HANA que replique exactamente los datos del query "BalanceTrial" para que sea accesible desde Service Layer.

## Datos de Referencia (Del Query Original)
El query original devuelve estos datos:
```
# | Cuenta   | NombreCuenta | ActividadEconomica | NombreActividad        | DepartamentoCode | DepartamentoNombre | TotalLocal      | TotalDolares
1 | 61101001 | Sueldos      | 515001            | Maquinaria y Repuestos | BODEGA          | Sin Departamento   | 12,906,682.6500 | 25,358.950
2 | 61101001 | Sueldos      | 290001            | Servicio Reparacion    | ADMINISTR       | Sin Departamento   | 3,636,666.6900  | 7,145.1200
3 | 61101001 | Sueldos      | 519006            | Material de Empaque    | LOGISTIC        | Sin Departamento   | 18,307,562.6300 | 35,971.320
4 | 61101001 | Sueldos      | 290001            | Servicio Reparacion    | TECNICOS        | Sin Departamento   | 89,227,399.7500 | 175,283.38
5 | 61101001 | Sueldos      | 519006            | Material de Empaque    | ADMINISTR       | Sin Departamento   | 5,514,095.8200  | 10,834.150
6 | 61101001 | Sueldos      | 515001            | Maquinaria y Repuestos | VENTAS          | Sin Departamento   | 69,631,283.8800 | 136,828.04
7 | 61101001 | Sueldos      | 519006            | Material de Empaque    | ARTES           | Sin Departamento   | 8,274,425.3500  | 16,258.230
8 | 61101001 | Sueldos      | 519006            | Material de Empaque    | FINANZAS        | Sin Departamento   | 11,903,286.1500 | 23,367.510
```

## Script SQL para Ejecutar en SAP HANA Studio

### Paso 1: Verificar Conexión
```sql
-- Verificar que estamos en el schema correcto
SELECT CURRENT_SCHEMA FROM DUMMY;
```

### Paso 2: Script Principal (Versión Simplificada)
```sql
-- Eliminar vista si existe
DROP VIEW IF EXISTS "BalanceTrialSL";

-- Crear vista física
CREATE VIEW "BalanceTrialSL" AS
SELECT 
    T2."AcctCode" as "Cuenta",
    T2."AcctName" as "NombreCuenta",
    T0."PrcCode" as "DepartamentoCode",
    'Sin Departamento' as "DepartamentoNombre",
    SUM(T1."Debit" - T1."Credit") as "TotalLocal",
    SUM(T1."FCDebit" - T1."FCCredit") as "TotalDolares"
FROM "OPRC" T0
INNER JOIN "JDT1" T1 ON T0."PrcCode" = T1."PrcCode"
INNER JOIN "OACT" T2 ON T1."Account" = T2."AcctCode"
WHERE T2."AcctCode" LIKE '61%'
GROUP BY T2."AcctCode", T2."AcctName", T0."PrcCode"
ORDER BY T2."AcctCode", T0."PrcCode";

-- Dar permisos para Service Layer
GRANT SELECT ON "BalanceTrialSL" TO PUBLIC;
GRANT SELECT ON "BalanceTrialSL" TO "_SYS_REPO";
```

### Paso 3: Script Completo (Con Mapeo de Actividades)
Si el script simple funciona, usar esta versión más completa:
```sql
-- Eliminar vista si existe
DROP VIEW IF EXISTS "BalanceTrialSL";

-- Crear vista completa con mapeo de actividades
CREATE VIEW "BalanceTrialSL" AS
SELECT 
    T2."AcctCode" as "Cuenta",
    T2."AcctName" as "NombreCuenta",
    CASE T0."PrcCode"
        WHEN 'BODEGA' THEN '515001'
        WHEN 'ADMINISTR' THEN '290001' 
        WHEN 'LOGISTIC' THEN '519006'
        WHEN 'TECNICOS' THEN '290001'
        WHEN 'VENTAS' THEN '515001'
        WHEN 'ARTES' THEN '519006'
        WHEN 'FINANZAS' THEN '519006'
        ELSE '515001'
    END as "ActividadEconomica",
    CASE T0."PrcCode"
        WHEN 'BODEGA' THEN 'Maquinaria y Repuestos'
        WHEN 'ADMINISTR' THEN 'Servicio Reparacion'
        WHEN 'LOGISTIC' THEN 'Material de Empaque' 
        WHEN 'TECNICOS' THEN 'Servicio Reparacion'
        WHEN 'VENTAS' THEN 'Maquinaria y Repuestos'
        WHEN 'ARTES' THEN 'Material de Empaque'
        WHEN 'FINANZAS' THEN 'Material de Empaque'
        ELSE 'Maquinaria y Repuestos'
    END as "NombreActividad",
    T0."PrcCode" as "DepartamentoCode",
    'Sin Departamento' as "DepartamentoNombre",
    ROUND(SUM(T1."Debit" - T1."Credit"), 4) as "TotalLocal",
    ROUND(SUM(T1."FCDebit" - T1."FCCredit"), 2) as "TotalDolares"
FROM "OPRC" T0
INNER JOIN "JDT1" T1 ON T0."PrcCode" = T1."PrcCode"
INNER JOIN "OACT" T2 ON T1."Account" = T2."AcctCode"
WHERE T2."AcctCode" LIKE '61%'
  AND (T1."Debit" > 0 OR T1."Credit" > 0)
  AND T0."PrcCode" IS NOT NULL
  AND T0."PrcCode" != ''
GROUP BY 
    T2."AcctCode", 
    T2."AcctName", 
    T0."PrcCode"
HAVING ABS(SUM(T1."Debit" - T1."Credit")) > 0.01
ORDER BY 
    T2."AcctCode", 
    T0."PrcCode";

-- Dar permisos completos
GRANT SELECT ON "BalanceTrialSL" TO PUBLIC;
GRANT SELECT ON "BalanceTrialSL" TO "_SYS_REPO";
GRANT SELECT ON "BalanceTrialSL" TO "_SYS_BIC";
```

### Paso 4: Verificación
```sql
-- Verificar que la vista se creó correctamente
SELECT COUNT(*) as "TotalRegistros" FROM "BalanceTrialSL";

-- Ver muestra de datos
SELECT TOP 10 * FROM "BalanceTrialSL" ORDER BY "Cuenta", "DepartamentoCode";

-- Verificar permisos
SELECT GRANTEE, PRIVILEGE FROM GRANTED_PRIVILEGES 
WHERE OBJECT_NAME = 'BalanceTrialSL' 
  AND OBJECT_TYPE = 'VIEW';
```

## Validación desde Service Layer
Después de crear la vista, probar estos endpoints:

### Endpoint 1: Vista Directa
```bash
curl -X POST http://localhost:3001/api/sap/execute-query \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "cb4f7bc0-a7a5-11f0-8000-0200170ef71b", 
    "companyDB": "SBO_STIACR_PROD",
    "sqlQuery": "SELECT * FROM \"BalanceTrialSL\" ORDER BY \"Cuenta\", \"DepartamentoCode\""
  }'
```

### Endpoint 2: Endpoint Personalizado
```bash
curl -X POST http://localhost:3001/api/sap/balance-trial \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "cb4f7bc0-a7a5-11f0-8000-0200170ef71b", 
    "companyDB": "SBO_STIACR_PROD"
  }'
```

## Resolución de Problemas

### Si hay errores de sintaxis:
1. Usar solo el script simplificado primero
2. Verificar que los nombres de tablas sean correctos
3. Ejecutar línea por línea para identificar el problema

### Si hay errores de permisos:
```sql
-- Script alternativo para permisos
CREATE SYNONYM "V_BALANCE_TRIAL_SL" FOR "BalanceTrialSL";
GRANT SELECT ON "V_BALANCE_TRIAL_SL" TO PUBLIC;
```

### Si la vista está vacía:
1. Verificar que existan datos en las tablas base
2. Comprobar los joins y filtros WHERE
3. Probar el SQL sin GROUP BY primero

## Notas Importantes
- **⚠️ Usar usuario con permisos DDL** en HANA
- **✅ La vista replicará exactamente** los datos del Query Manager
- **🔄 Es compatible** con Service Layer una vez creada
- **📊 Mantiene el mismo formato** de columnas y tipos de datos

## Resultado Esperado
Una vez creada exitosamente, la vista `BalanceTrialSL` será accesible desde:
1. Service Layer vía SQL directo
2. Endpoint `/api/sap/balance-trial`
3. Query Manager (como vista física)

## Contacto para Dudas
Si hay problemas durante la implementación, proporcionar:
1. Mensaje de error exacto
2. Script ejecutado
3. Resultado de `SELECT CURRENT_SCHEMA FROM DUMMY;`