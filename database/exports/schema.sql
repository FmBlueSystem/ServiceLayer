-- =============================================
-- SCHEMA DE BASE DE DATOS
-- Generado: 2025-10-25T10:48:45.090Z
-- =============================================


-- Tabla: api_keys
CREATE TABLE api_keys (id integer NOT NULL, user_id integer, key_hash character varying(255) NOT NULL, name character varying(100) NOT NULL, permissions jsonb, last_used timestamp with time zone, expires_at timestamp with time zone, is_active boolean, created_at timestamp with time zone);

-- Tabla: audit_log
CREATE TABLE audit_log (id integer NOT NULL, username character varying(100) NOT NULL, action character varying(100) NOT NULL, resource character varying(100) NOT NULL, company_db character varying(100), details jsonb, ip_address character varying(45), user_agent text, success boolean, error_message text, created_at timestamp without time zone);

-- Tabla: config_audit_log
CREATE TABLE config_audit_log (id integer NOT NULL, config_key character varying(100) NOT NULL, old_value text, new_value text, changed_by character varying(100) NOT NULL, ip_address character varying(45), user_agent text, created_at timestamp without time zone);

-- Tabla: pages
CREATE TABLE pages (id integer NOT NULL, name character varying(100) NOT NULL, path character varying(200) NOT NULL, icon character varying(50), description text, display_order integer, is_active boolean, created_at timestamp without time zone, updated_at timestamp without time zone);

-- Tabla: permissions
CREATE TABLE permissions (id integer NOT NULL, resource character varying(100) NOT NULL, action character varying(50) NOT NULL, description text, created_at timestamp without time zone);

-- Tabla: role_pages
CREATE TABLE role_pages (role_id integer NOT NULL, page_id integer NOT NULL, granted_at timestamp without time zone, granted_by character varying(100));

-- Tabla: role_permissions
CREATE TABLE role_permissions (role_id integer NOT NULL, permission_id integer NOT NULL, created_at timestamp without time zone);

-- Tabla: roles
CREATE TABLE roles (id integer NOT NULL, name character varying(50) NOT NULL, description text, is_system_role boolean, created_at timestamp without time zone, updated_at timestamp without time zone);

-- Tabla: sap_users
CREATE TABLE sap_users (username character varying(100) NOT NULL, full_name character varying(255), email character varying(255), is_active boolean, sap_company_db character varying(100), last_sync_at timestamp without time zone, created_at timestamp without time zone);

-- Tabla: sessions
CREATE TABLE sessions (sid character varying(255) NOT NULL, data jsonb NOT NULL, expires timestamp with time zone NOT NULL, created_at timestamp with time zone);

-- Tabla: system_config
CREATE TABLE system_config (key character varying(100) NOT NULL, value text NOT NULL, description text, category character varying(50), is_sensitive boolean, updated_by character varying(100), updated_at timestamp without time zone, created_at timestamp without time zone);

-- Tabla: user_roles
CREATE TABLE user_roles (id integer NOT NULL, username character varying(100), role_id integer, company_db character varying(100), granted_by character varying(100), granted_at timestamp without time zone);

-- Tabla: users
CREATE TABLE users (id integer NOT NULL, uuid uuid NOT NULL, email character varying(255) NOT NULL, password_hash character varying(255) NOT NULL, first_name character varying(100) NOT NULL, last_name character varying(100) NOT NULL, is_active boolean, email_verified boolean, last_login timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone);
