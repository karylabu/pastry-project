-- Add device metadata used by customer login and active-session management.
USE pastry_db;

ALTER TABLE user_sessions
    ADD COLUMN device_name VARCHAR(120) DEFAULT NULL AFTER token,
    ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL AFTER device_name;