-- =====================================================
-- TABLA DE CONFIGURACIÓN DEL SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_sensitive BOOLEAN DEFAULT false, -- Indica si el valor contiene información sensible
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_config_timestamp
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_system_config_timestamp();

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Configuración de Service Layer
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('sap_endpoint', 'https://sap-stiacmzdr-sl.skyinone.net:50000/',
     'URL del SAP Service Layer (incluir puerto y trailing slash)',
     'sap', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- Configuración de timeouts
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('sap_timeout', '10000',
     'Timeout para peticiones SAP en milisegundos',
     'sap', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- Configuración de reintentos
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('sap_retries', '3',
     'Número de reintentos para peticiones SAP fallidas',
     'sap', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- Configuración de SSL
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('sap_verify_ssl', 'false',
     'Verificar certificados SSL en peticiones SAP (true/false)',
     'sap', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- Nombre de la aplicación
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('app_display_name', 'SAP Multi-Regional',
     'Nombre visible de la aplicación',
     'general', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- Versión de la aplicación
INSERT INTO system_config (key, value, description, category, is_sensitive, updated_by)
VALUES
    ('app_version', '1.0.0',
     'Versión actual de la aplicación',
     'general', false, 'system')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- LOG DE AUDITORÍA PARA CAMBIOS DE CONFIGURACIÓN
-- =====================================================

CREATE TABLE IF NOT EXISTS config_audit_log (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_config_audit_log_user ON config_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_date ON config_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_key ON config_audit_log(config_key);

-- =====================================================
-- COMENTARIOS DE TABLAS
-- =====================================================

COMMENT ON TABLE system_config IS 'Configuración dinámica del sistema que puede ser modificada sin reiniciar la aplicación';
COMMENT ON COLUMN system_config.key IS 'Clave única de configuración';
COMMENT ON COLUMN system_config.value IS 'Valor de configuración (siempre almacenado como texto)';
COMMENT ON COLUMN system_config.description IS 'Descripción legible del parámetro de configuración';
COMMENT ON COLUMN system_config.category IS 'Categoría: sap, general, security, etc.';
COMMENT ON COLUMN system_config.is_sensitive IS 'Indica si el valor debe ser ocultado en la UI';
COMMENT ON COLUMN system_config.updated_by IS 'Usuario que realizó la última actualización';

COMMENT ON TABLE config_audit_log IS 'Auditoría de cambios en la configuración del sistema';
