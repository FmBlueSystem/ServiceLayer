-- Seed data for development environment
-- This script runs after the database initialization

-- Only insert seed data in development
DO $$
BEGIN
    -- Check if we're in development mode based on database name
    IF current_database() LIKE '%dev%' OR current_database() LIKE '%development%' THEN
        
        -- Insert sample users (only if they don't exist)
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, email_verified)
        SELECT * FROM (VALUES
            ('john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', 'John', 'Doe', true, true),
            ('jane.smith@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', 'Jane', 'Smith', true, true),
            ('bob.wilson@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', 'Bob', 'Wilson', true, false),
            ('alice.brown@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', 'Alice', 'Brown', false, true),
            ('test.user@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', 'Test', 'User', true, true)
        ) AS seed_users(email, password_hash, first_name, last_name, is_active, email_verified)
        WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE users.email = seed_users.email
        );

        -- Update last_login for some users to simulate activity
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP - INTERVAL '1 day'
        WHERE email IN ('john.doe@example.com', 'jane.smith@example.com');

        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP - INTERVAL '7 days'
        WHERE email = 'test.user@example.com';

        -- Insert some sample audit log entries
        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        SELECT 
            u.id,
            'login',
            'authentication',
            u.id::text,
            jsonb_build_object('method', 'password', 'success', true),
            '192.168.1.100'::inet,
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        FROM users u
        WHERE u.email = 'john.doe@example.com'
        AND NOT EXISTS (
            SELECT 1 FROM audit_log WHERE user_id = u.id AND action = 'login'
        );

        INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        SELECT 
            u.id,
            'profile_update',
            'user',
            u.id::text,
            jsonb_build_object('fields_updated', array['last_name'], 'previous_values', jsonb_build_object('last_name', 'OldName')),
            '192.168.1.101'::inet,
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        FROM users u
        WHERE u.email = 'jane.smith@example.com'
        AND NOT EXISTS (
            SELECT 1 FROM audit_log WHERE user_id = u.id AND action = 'profile_update'
        );

        -- Insert some sample API keys
        INSERT INTO api_keys (user_id, key_hash, name, permissions, expires_at, is_active)
        SELECT 
            u.id,
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', -- Hash of 'dev-api-key-123'
            'Development API Key',
            jsonb_build_array('read:users', 'write:users', 'read:system'),
            CURRENT_TIMESTAMP + INTERVAL '1 year',
            true
        FROM users u
        WHERE u.email = 'john.doe@example.com'
        AND NOT EXISTS (
            SELECT 1 FROM api_keys WHERE user_id = u.id
        );

        INSERT INTO api_keys (user_id, key_hash, name, permissions, expires_at, is_active)
        SELECT 
            u.id,
            '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewG5/BlyZVMTdLaa', -- Hash of 'read-only-key-456'
            'Read-Only API Key',
            jsonb_build_array('read:users', 'read:system'),
            CURRENT_TIMESTAMP + INTERVAL '6 months',
            true
        FROM users u
        WHERE u.email = 'jane.smith@example.com'
        AND NOT EXISTS (
            SELECT 1 FROM api_keys WHERE user_id = u.id
        );

        -- Insert some expired sessions for cleanup testing
        INSERT INTO sessions (sid, data, expires)
        VALUES 
            ('expired-session-1', '{"userId": 1, "email": "john.doe@example.com"}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
            ('expired-session-2', '{"userId": 2, "email": "jane.smith@example.com"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
            ('active-session-1', '{"userId": 1, "email": "john.doe@example.com"}', CURRENT_TIMESTAMP + INTERVAL '1 day')
        ON CONFLICT (sid) DO NOTHING;

        RAISE NOTICE 'Development seed data inserted successfully';
        RAISE NOTICE 'Sample users created with password: admin123';
        RAISE NOTICE 'Test users: john.doe@example.com, jane.smith@example.com, bob.wilson@example.com, alice.brown@example.com, test.user@example.com';
        RAISE NOTICE 'API keys created for john.doe and jane.smith';
        RAISE NOTICE 'Sample audit log entries and sessions created';
    ELSE
        RAISE NOTICE 'Skipping seed data insertion - not in development environment';
    END IF;
END
$$;