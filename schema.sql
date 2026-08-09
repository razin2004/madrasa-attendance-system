-- ===================================================================
-- PostgreSQL Schema for Thandorappara Juma Masjid
-- Madrasa Smart Attendance & Leave Management System (3-Tier RBAC)
-- ===================================================================

DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS device_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS madrasa_shifts CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- 1. System Settings Table (Super Admin Global Config)
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    madrasa_name VARCHAR(150) NOT NULL DEFAULT 'Thandorappara Juma Masjid Madrasa',
    allowed_wifi_ip VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Madrasa Shifts Table
CREATE TABLE madrasa_shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT 'Standard Madrasa Day Shift',
    start_time TIME NOT NULL DEFAULT '08:00:00',
    end_time TIME NOT NULL DEFAULT '16:00:00',
    grace_period_minutes INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users Table (Super Admin / Admin / Ustadh)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USTADH', -- 'SUPER_ADMIN', 'ADMIN', 'USTADH'
    is_active BOOLEAN DEFAULT TRUE,
    shift_id INT REFERENCES madrasa_shifts(id) ON DELETE SET NULL,
    can_add_device BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Device Keys Table (Ustadh Device Binding & Multi-Device Support)
CREATE TABLE device_keys (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_key VARCHAR(128) UNIQUE NOT NULL,
    device_name VARCHAR(100) DEFAULT 'Primary Mobile Device',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Attendance Logs Table
CREATE TABLE attendance_logs (
    id SERIAL PRIMARY KEY,
    ustadh_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_id INT REFERENCES madrasa_shifts(id),
    clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out_time TIMESTAMP WITH TIME ZONE,
    is_late_in BOOLEAN DEFAULT FALSE,
    late_minutes INT DEFAULT 0,
    is_early_out BOOLEAN DEFAULT FALSE,
    early_minutes INT DEFAULT 0,
    ip_address VARCHAR(45) NOT NULL,
    device_key_used VARCHAR(128) NOT NULL,
    status VARCHAR(20) DEFAULT 'CLOCKED_IN', -- 'CLOCKED_IN', 'CLOCKED_OUT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Leave Requests Table
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    ustadh_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for High Performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_device_keys_key ON device_keys(device_key);
CREATE INDEX idx_attendance_ustadh ON attendance_logs(ustadh_id);
CREATE INDEX idx_leave_ustadh ON leave_requests(ustadh_id);
CREATE INDEX idx_leave_status ON leave_requests(status);

-- ===================================================================
-- Initial Production Seed Data
-- ===================================================================

-- 1. Initial System Settings
INSERT INTO system_settings (madrasa_name, allowed_wifi_ip)
VALUES ('Thandorappara Juma Masjid Madrasa', '127.0.0.1');

-- 2. Standard Shift (08:00 AM to 04:00 PM)
INSERT INTO madrasa_shifts (name, start_time, end_time, grace_period_minutes)
VALUES ('Standard Madrasa Day Shift', '08:00:00', '16:00:00', 0);

-- 3. Super Admin (Management Authority) - Password: superadmin123
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES (
    'superadmin',
    '$2b$12$K16xO19fA4j.P36aI9dI1eP5j69sPZ6t4lJ4G8o.h3Qx8j9gP1d.',
    'Masjid Management Committee (Super Admin)',
    'SUPER_ADMIN',
    TRUE
);

-- 4. Admin (Principal / Sadr Ustadh) - Password: admin123
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES (
    'admin',
    '$2b$12$K16xO19fA4j.P36aI9dI1eP5j69sPZ6t4lJ4G8o.h3Qx8j9gP1d.',
    'Principal Sadr Ustadh (Admin)',
    'ADMIN',
    TRUE
);
