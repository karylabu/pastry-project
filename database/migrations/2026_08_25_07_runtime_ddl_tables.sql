 -- ============================================================
-- Migration 2026_08_25_07: tables/columns previously ensured at runtime
-- ------------------------------------------------------------
-- Several customer APIs used to run CREATE TABLE / ALTER TABLE on every
-- request:
--   * api_chat_send.php      -> messages.user_id, messages.updated_at
--   * api_update_profile.php -> users.profile_image
--   * api_customize_orders.php -> customize_orders table
--
-- Audit result against live data:
--   * messages.user_id / updated_at : MISSING in DB (chat depends on them)
--   * users.profile_image           : MISSING in DB (profile update needs it)
--   * customize_orders              : table absent; kept for compatibility
--                                     with api_customize_orders.php
--
-- All statements are idempotent (IF NOT EXISTS), so this migration is safe
-- to re-run and matches what the runtime DDL would have produced.
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_07_runtime_ddl_tables_rollback.sql
-- ============================================================

USE pastry_db;

-- Chat message ownership + edit tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id INT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Sender roles (previously ensured at runtime by staff/api_chat_send.php).
-- Idempotent: re-applying the same definition is a no-op.
ALTER TABLE messages
    MODIFY sender ENUM('customer','staff','ai','admin') NOT NULL;

-- Profile picture support
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT NULL;

-- Custom cake request orders (exact structure previously created at
-- runtime by customer/api_customize_orders.php). The newer
-- custom_cake_orders table remains the primary store for custom cake
-- details linked to real orders.
CREATE TABLE IF NOT EXISTS customize_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_id INT,
    cake_size VARCHAR(100),
    servings INT,
    cake_flavor VARCHAR(100),
    filling_flavor VARCHAR(100),
    frosting_type VARCHAR(100),
    occasion VARCHAR(100),
    theme VARCHAR(255),
    cake_color VARCHAR(100),
    custom_message TEXT,
    special_instructions TEXT,
    addons TEXT,
    estimated_price DECIMAL(10, 2),
    delivery_method VARCHAR(50),
    delivery_address TEXT,
    pickup_date DATE,
    pickup_time TIME,
    reference_images JSON,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
