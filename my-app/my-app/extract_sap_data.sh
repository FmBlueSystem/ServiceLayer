#!/bin/bash

# Script para extraer datos de tipos de cambio de SAP
# Uso: ./extract_sap_data.sh [PAIS] [opciones]

# Configuración
BASE_URL="http://localhost:3000"
OUTPUT_DIR="./sap_data_exports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Función para logging con colores
log() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Función para mostrar ayuda
show_help() {
    log $BOLD "\n📖 USO DEL SCRIPT:"
    log $CYAN "./extract_sap_data.sh [PAIS] [opciones]"
    log $BOLD "\nEjemplos:"
    log $GREEN "./extract_sap_data.sh                    # Extraer todos los países"
    log $GREEN "./extract_sap_data.sh COSTA_RICA         # Extraer solo Costa Rica"
    log $GREEN "./extract_sap_data.sh --bccr             # Incluir datos BCCR"
    log $GREEN "./extract_sap_data.sh COSTA_RICA --bccr  # Costa Rica + BCCR"
    log $BOLD "\nOpciones:"
    log $YELLOW "--bccr   Incluir datos actuales del BCCR"
    log $YELLOW "--help   Mostrar esta ayuda"
    log $YELLOW "--raw    Mostrar JSON crudo sin formatear"
}

# Función para crear directorio de salida
create_output_dir() {
    if [ ! -d "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
        log $GREEN "📁 Directorio creado: $OUTPUT_DIR"
    fi
}

# Función para obtener datos BCCR
get_bccr_data() {
    log $CYAN "🏦 Obteniendo datos actuales del BCCR..."
    
    local response=$(curl -s "$BASE_URL/api/sap/demo/bccr-rates")
    local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        log $GREEN "✅ Datos BCCR obtenidos exitosamente"
        echo "$response"
    else
        log $RED "❌ Error obteniendo datos BCCR"
        return 1
    fi
}

# Función para extraer datos multi-país
get_multi_country_data() {
    log $CYAN "🌍 Extrayendo datos de múltiples países..."
    
    local payload='{
        "countries": ["COSTA_RICA", "HONDURAS", "GUATEMALA", "PANAMA"],
        "companyDB": "SBO_GT_STIA_PROD"
    }'
    
    local response=$(curl -s -X POST "$BASE_URL/api/sap/exchange-rates/multi-country" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        log $GREEN "✅ Datos multi-país obtenidos exitosamente"
        echo "$response"
    else
        log $RED "❌ Error extrayendo datos multi-país"
        echo "$response" | jq -r '.error // "Error desconocido"' 2>/dev/null
        return 1
    fi
}

# Función para extraer datos de un país específico
get_country_data() {
    local country=$1
    log $CYAN "🏛️  Extrayendo datos de $country..."
    
    local payload="{
        \"country\": \"$country\",
        \"companyDB\": \"SBO_GT_STIA_PROD\"
    }"
    
    local response=$(curl -s -X POST "$BASE_URL/api/sap/exchange-rates" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null)
    
    if [ "$success" = "true" ]; then
        log $GREEN "✅ Datos de $country obtenidos exitosamente"
        echo "$response"
    else
        log $RED "❌ Error extrayendo datos de $country"
        echo "$response" | jq -r '.error // "Error desconocido"' 2>/dev/null
        return 1
    fi
}

# Función para formatear y mostrar datos SAP
format_sap_data() {
    local data=$1
    local country=$2
    
    log $BOLD "\n🏛️  $country"
    log $BLUE "$(printf '=%.0s' {1..50})"
    
    # Verificar si hay datos
    local has_data=$(echo "$data" | jq -r '.data | length' 2>/dev/null)
    
    if [ "$has_data" -gt 0 ] 2>/dev/null; then
        log $CYAN "Fecha       | Moneda | Tasa      | Fuente"
        log $BLUE "$(printf '%.0s-' {1..50})"
        
        echo "$data" | jq -r '.data[] | 
            "\(.date // .Date // "N/A" | .[0:10]) | \(.currency // .Currency // "N/A" | .[0:6]) | \(.rate // .Rate // "N/A") | \(.source // .Source // "SAP" | .[0:10])"' 2>/dev/null | while IFS='|' read -r fecha moneda tasa fuente; do
            printf "%-12s| %-7s| %-10s| %-10s\n" "$fecha" "$moneda" "$tasa" "$fuente"
        done
    else
        log $RED "❌ Sin datos disponibles"
    fi
}

# Función para mostrar datos BCCR
format_bccr_data() {
    local data=$1
    
    log $BOLD "\n🏦 DATOS ACTUALES BCCR - $(date '+%d/%m/%Y %H:%M')"
    log $BLUE "$(printf '=%.0s' {1..50})"
    
    local costa_rica_data=$(echo "$data" | jq -r '.data.costaRica.data // []' 2>/dev/null)
    
    if [ "$costa_rica_data" != "[]" ] && [ "$costa_rica_data" != "null" ]; then
        echo "$data" | jq -r '.data.costaRica.data[] | 
            "\(.currency): \(.rate) ₡ (\(.date))"' 2>/dev/null | while read -r line; do
            log $GREEN "$line"
        done
    else
        log $RED "❌ Sin datos BCCR disponibles"
    fi
}

# Función para generar reporte completo
generate_report() {
    local sap_data=$1
    local bccr_data=$2
    local raw_mode=$3
    
    if [ "$raw_mode" = "true" ]; then
        log $BOLD "\n📊 DATOS SAP (JSON):"
        echo "$sap_data" | jq '.' 2>/dev/null || echo "$sap_data"
        
        if [ -n "$bccr_data" ]; then
            log $BOLD "\n🏦 DATOS BCCR (JSON):"
            echo "$bccr_data" | jq '.' 2>/dev/null || echo "$bccr_data"
        fi
        return
    fi
    
    log $BOLD "\n📊 REPORTE DE TIPOS DE CAMBIO SAP"
    log $BLUE "$(printf '=%.0s' {1..80})"
    
    # Procesar datos SAP
    if echo "$sap_data" | jq -e '.data' >/dev/null 2>&1; then
        # Datos multi-país
        echo "$sap_data" | jq -r '.data | keys[]' 2>/dev/null | while read -r country; do
            local country_data=$(echo "$sap_data" | jq ".data.\"$country\"" 2>/dev/null)
            format_sap_data "$country_data" "$country"
        done
    else
        # Datos de un solo país
        format_sap_data "$sap_data" "COSTA_RICA"
    fi
    
    # Mostrar datos BCCR si están disponibles
    if [ -n "$bccr_data" ]; then
        format_bccr_data "$bccr_data"
    fi
}

# Función para guardar datos
save_data() {
    local sap_data=$1
    local bccr_data=$2
    
    local sap_file="$OUTPUT_DIR/sap_data_$TIMESTAMP.json"
    local combined_file="$OUTPUT_DIR/combined_data_$TIMESTAMP.json"
    
    # Guardar datos SAP
    echo "$sap_data" > "$sap_file"
    log $GREEN "💾 Datos SAP guardados en: $sap_file"
    
    # Crear archivo combinado si hay datos BCCR
    if [ -n "$bccr_data" ]; then
        local combined_data=$(jq -n \
            --argjson sap "$sap_data" \
            --argjson bccr "$bccr_data" \
            --arg timestamp "$(date -Iseconds)" \
            '{timestamp: $timestamp, sap: $sap, bccr: $bccr}')
        
        echo "$combined_data" > "$combined_file"
        log $GREEN "📊 Datos combinados guardados en: $combined_file"
    fi
}

# Función principal
main() {
    # Verificar si jq está instalado
    if ! command -v jq &> /dev/null; then
        log $RED "❌ Error: jq no está instalado. Instálalo con: brew install jq"
        exit 1
    fi
    
    # Verificar si curl está disponible
    if ! command -v curl &> /dev/null; then
        log $RED "❌ Error: curl no está disponible"
        exit 1
    fi
    
    # Parsear argumentos
    local country=""
    local include_bccr=false
    local raw_mode=false
    
    for arg in "$@"; do
        case $arg in
            --help|-h)
                show_help
                exit 0
                ;;
            --bccr)
                include_bccr=true
                ;;
            --raw)
                raw_mode=true
                ;;
            --*)
                log $RED "❌ Opción desconocida: $arg"
                show_help
                exit 1
                ;;
            *)
                if [ -z "$country" ]; then
                    country=$(echo "$arg" | tr '[:lower:]' '[:upper:]')
                fi
                ;;
        esac
    done
    
    log $BOLD "🚀 Iniciando extracción de datos SAP..."
    create_output_dir
    
    # Obtener datos SAP
    local sap_data=""
    if [ -n "$country" ]; then
        sap_data=$(get_country_data "$country")
    else
        sap_data=$(get_multi_country_data)
    fi
    
    if [ $? -ne 0 ]; then
        log $RED "❌ Error extrayendo datos SAP"
        exit 1
    fi
    
    # Obtener datos BCCR si se solicita
    local bccr_data=""
    if [ "$include_bccr" = true ]; then
        bccr_data=$(get_bccr_data)
    fi
    
    # Generar reporte
    generate_report "$sap_data" "$bccr_data" "$raw_mode"
    
    # Guardar datos
    save_data "$sap_data" "$bccr_data"
    
    log $BOLD "\n✅ Extracción completada exitosamente"
}

# Verificar argumentos de ayuda
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Ejecutar función principal
main "$@"