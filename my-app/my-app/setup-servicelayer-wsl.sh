#!/bin/bash
# ============================================================================
# Script para configurar el ambiente de ServiceLayer en WSL Ubuntu
# ============================================================================
# Ejecutar después de instalar WSL y Ubuntu
# Uso: bash /mnt/c/ServiceLayer/setup-servicelayer-wsl.sh
# ============================================================================

set -e  # Salir si hay errores

echo ""
echo "============================================================================"
echo "  CONFIGURACIÓN DE SERVICELAYER EN WSL UBUNTU"
echo "============================================================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Funciones de utilidad
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en WSL
if ! grep -qi microsoft /proc/version; then
    error "Este script debe ejecutarse en WSL (Windows Subsystem for Linux)"
    exit 1
fi

info "Ejecutando en WSL ✓"
echo ""

# Paso 1: Actualizar sistema
info "Actualizando sistema Ubuntu..."
sudo apt update
sudo apt upgrade -y
echo ""

# Paso 2: Instalar herramientas esenciales
info "Instalando herramientas esenciales..."
sudo apt install -y \
    build-essential \
    curl \
    wget \
    git \
    vim \
    nano \
    net-tools \
    iputils-ping \
    dnsutils \
    ca-certificates \
    gnupg \
    lsb-release \
    sshpass \
    unzip
echo ""

# Paso 3: Instalar Node.js LTS
info "Instalando Node.js LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
    info "Node.js instalado: $(node --version)"
    info "npm instalado: $(npm --version)"
else
    info "Node.js ya está instalado: $(node --version)"
fi
echo ""

# Paso 4: Instalar Redis CLI
info "Instalando Redis CLI..."
if ! command -v redis-cli &> /dev/null; then
    sudo apt install -y redis-tools
    info "Redis CLI instalado ✓"
else
    info "Redis CLI ya está instalado ✓"
fi
echo ""

# Paso 5: Instalar PostgreSQL client
info "Instalando PostgreSQL client..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql-client
    info "PostgreSQL client instalado ✓"
else
    info "PostgreSQL client ya está instalado ✓"
fi
echo ""

# Paso 6: Configurar Git
info "Configurando Git..."
if [ -z "$(git config --global user.name)" ]; then
    echo -e "${CYAN}Configuración de Git:${NC}"
    read -p "Ingresa tu nombre: " git_name
    read -p "Ingresa tu email: " git_email
    git config --global user.name "$git_name"
    git config --global user.email "$git_email"
    info "Git configurado ✓"
else
    info "Git ya está configurado ✓"
    echo "  Nombre: $(git config --global user.name)"
    echo "  Email: $(git config --global user.email)"
fi
echo ""

# Paso 7: Crear enlace simbólico al proyecto
info "Configurando acceso al proyecto ServiceLayer..."
SERVICE_LAYER_WIN="/mnt/c/ServiceLayer"
SERVICE_LAYER_HOME="$HOME/ServiceLayer"

if [ -d "$SERVICE_LAYER_WIN" ]; then
    if [ ! -L "$SERVICE_LAYER_HOME" ]; then
        ln -s "$SERVICE_LAYER_WIN" "$SERVICE_LAYER_HOME"
        info "Enlace simbólico creado: $SERVICE_LAYER_HOME -> $SERVICE_LAYER_WIN"
    else
        info "Enlace simbólico ya existe ✓"
    fi

    # Agregar alias al .bashrc
    if ! grep -q "alias sl=" ~/.bashrc; then
        echo "" >> ~/.bashrc
        echo "# ServiceLayer aliases" >> ~/.bashrc
        echo "alias sl='cd ~/ServiceLayer'" >> ~/.bashrc
        echo "alias slwin='cd /mnt/c/ServiceLayer'" >> ~/.bashrc
        info "Aliases agregados a .bashrc"
    fi
else
    warn "No se encontró el directorio C:\ServiceLayer"
fi
echo ""

# Paso 8: Instalar dependencias globales de npm
info "Instalando dependencias globales de npm..."
sudo npm install -g \
    pm2 \
    nodemon \
    npm-check-updates
echo ""

# Paso 9: Verificar conectividad con el servidor
info "Verificando conectividad con el servidor Windows..."
if ping -c 1 -W 2 10.13.0.29 &> /dev/null; then
    info "Conectividad con 10.13.0.29 OK ✓"
else
    warn "No se puede conectar a 10.13.0.29"
fi
echo ""

# Paso 10: Crear scripts útiles
info "Creando scripts útiles..."

# Script para conectar a Redis
cat > ~/redis-connect.sh << 'EOF'
#!/bin/bash
redis-cli -h 10.13.1.83 -p 6379
EOF
chmod +x ~/redis-connect.sh

# Script para conectar a PostgreSQL
cat > ~/psql-connect.sh << 'EOF'
#!/bin/bash
PGPASSWORD=password psql -h 10.13.1.83 -U postgres -d myapp
EOF
chmod +x ~/psql-connect.sh

# Script para verificar servicios
cat > ~/check-services.sh << 'EOF'
#!/bin/bash
echo ""
echo "============================================"
echo "  ESTADO DE SERVICIOS"
echo "============================================"
echo ""

echo "[1] Servidor Linux (10.13.1.83:3443)"
if curl -k -s --max-time 3 https://10.13.1.83:3443/health > /dev/null; then
    echo "  ✓ Online"
else
    echo "  ✗ Offline"
fi

echo ""
echo "[2] Servidor Windows (10.13.0.29:3443)"
if curl -k -s --max-time 3 https://10.13.0.29:3443/health > /dev/null; then
    echo "  ✓ Online"
else
    echo "  ✗ Offline"
fi

echo ""
echo "[3] Redis (10.13.1.83:6379)"
if redis-cli -h 10.13.1.83 -p 6379 ping > /dev/null 2>&1; then
    echo "  ✓ Online"
else
    echo "  ✗ Offline"
fi

echo ""
echo "[4] PostgreSQL (10.13.1.83:5432)"
if PGPASSWORD=password psql -h 10.13.1.83 -U postgres -d myapp -c "SELECT 1" > /dev/null 2>&1; then
    echo "  ✓ Online"
else
    echo "  ✗ Offline"
fi

echo ""
EOF
chmod +x ~/check-services.sh

info "Scripts creados:"
echo "  ~/redis-connect.sh    - Conectar a Redis"
echo "  ~/psql-connect.sh     - Conectar a PostgreSQL"
echo "  ~/check-services.sh   - Verificar estado de servicios"
echo ""

# Resumen final
echo ""
echo "============================================================================"
echo -e "  ${GREEN}CONFIGURACIÓN COMPLETADA ✓${NC}"
echo "============================================================================"
echo ""
echo -e "${CYAN}Versiones instaladas:${NC}"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Git: $(git --version)"
echo "  PostgreSQL client: $(psql --version | head -n 1)"
echo "  Redis CLI: $(redis-cli --version)"
echo ""
echo -e "${CYAN}Comandos útiles:${NC}"
echo "  sl                    - Ir a ~/ServiceLayer"
echo "  slwin                 - Ir a /mnt/c/ServiceLayer"
echo "  ~/check-services.sh   - Verificar servicios"
echo "  ~/redis-connect.sh    - Conectar a Redis"
echo "  ~/psql-connect.sh     - Conectar a PostgreSQL"
echo ""
echo -e "${CYAN}Para aplicar los cambios de .bashrc:${NC}"
echo "  source ~/.bashrc"
echo ""
echo -e "${YELLOW}Recuerda:${NC}"
echo "  - Los archivos de Windows están en /mnt/c/"
echo "  - Evita editar archivos de Windows desde WSL con editores nativos"
echo "  - Usa 'wsl --shutdown' para reiniciar WSL si es necesario"
echo ""
