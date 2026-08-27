-- ============================================================
-- Migration 2026_08_25_01: user_sessions table
-- ------------------------------------------------------------
-- customer/api_login.php used to CREATE this table at runtime on
-- every login request. Schema changes belong in migrations.
--
-- Idempotent: safe to re-run. If the table already exists this
-- is a no-op.
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_01_user_sessions_rollback.sql
-- ============================================================

USE pastry_db;

CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;