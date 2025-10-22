# Script para corregir el error de sintaxis en rateLimiter.js
# EJECUTAR COMO ADMINISTRADOR

Write-Host "Corrigiendo error de sintaxis en rateLimiter.js..." -ForegroundColor Yellow

$filePath = "C:\Projects\ServiceLayer\src\middleware\rateLimiter.js"

# Quitar atributo de solo lectura
attrib -r $filePath

# Leer el contenido del archivo
$content = Get-Content $filePath -Raw

# Reemplazar la línea problemática
$content = $content -replace 'max: 15, //\s+limit each IP', 'max: 15, // limit each IP'

# Guardar el archivo
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Archivo corregido exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora puedes iniciar el servidor con:" -ForegroundColor Cyan
Write-Host "  node src/index.js" -ForegroundColor White
