-- ============================================================
-- Pastry Project — MySQL Database Schema
-- Run this file once to set up the database:
--   mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS pastry_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE pastry_db;

-- ────────────────────────────────────────────────────────────
-- Users
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)                        NOT NULL,
    email       VARCHAR(150)                        NOT NULL UNIQUE,
    password    VARCHAR(255)                        NOT NULL,  -- bcrypt hash
    role        ENUM('admin','staff','customer')    NOT NULL DEFAULT 'customer',
    subscribed_promo TINYINT(1)                    NOT NULL DEFAULT 0,
    created_at  TIMESTAMP                           DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Products
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150)        NOT NULL,
    category    VARCHAR(80)         NOT NULL,
    price       DECIMAL(10,2)       NOT NULL,
    production_cost DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    stock       INT                 NOT NULL DEFAULT 0,
    image       VARCHAR(10)         NOT NULL DEFAULT '🍰',   -- emoji
    description TEXT,
    available   TINYINT(1)          NOT NULL DEFAULT 1,
    created_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_available (available)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Ingredients
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150)        NOT NULL,
    unit        VARCHAR(20)         NOT NULL,
    stock       DECIMAL(10,3)       NOT NULL DEFAULT 0,
    threshold   DECIMAL(10,3)       NOT NULL DEFAULT 0,  -- low-stock alert level
    expiry      DATE,
    created_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Ingredient movements (stock-in / stock-out audit trail)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_movements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ingredient_id   INT                 NOT NULL,
    action          ENUM('stock_in','stock_out') NOT NULL,
    qty             DECIMAL(10,3)       NOT NULL,
    note            TEXT,
    user_id         INT,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_ingredient (ingredient_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NULL,
    context         VARCHAR(50)        NOT NULL,
    action          VARCHAR(100)       NOT NULL,
    entity_type     VARCHAR(50)        NOT NULL,
    entity_id       INT                 NOT NULL,
    note            TEXT,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user_created (user_id, created_at),
    INDEX idx_audit_context_action (context, action)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Product recipes
-- This connects products to ingredients for inventory deduction.
CREATE TABLE IF NOT EXISTS product_recipes (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    product_id     INT                 NOT NULL,
    ingredient_id  INT                 NOT NULL,
    qty            DECIMAL(10,3)       NOT NULL DEFAULT 0,
    created_at     TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_ingredient (product_id, ingredient_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Variance (waste/spoilage tracking)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variance (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ingredient_id   INT,                                            -- NULL if product-level variance
    product_id      INT,                                            -- NULL if ingredient-level variance
    variance_type   ENUM('Waste','Spoilage','Damage','Unaccounted') NOT NULL,
    qty_lost        DECIMAL(10,3)                                  NOT NULL,
    reason          TEXT,
    notes           TEXT,
    recorded_by     INT                                             NOT NULL,
    recorded_date   DATE                                            NOT NULL,
    created_at      TIMESTAMP                                       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_date (recorded_date),
    INDEX idx_type (variance_type)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Notifications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT                                             NOT NULL,
    title           VARCHAR(150)                                    NOT NULL,
    message         TEXT                                            NOT NULL,
    type            VARCHAR(50)                                     NOT NULL DEFAULT 'Info',
    is_read         TINYINT(1)                                      NOT NULL DEFAULT 0,
    action_url      VARCHAR(255),
    created_at      TIMESTAMP                                       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Orders
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer    VARCHAR(150)                                            NOT NULL,
    email       VARCHAR(150)                                            NOT NULL,
    phone       VARCHAR(30)                                            NULL,
    type        ENUM('Standard','Pre-order','Rush','Custom','Addons')                     NOT NULL DEFAULT 'Standard',
    status      ENUM('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
    total       DECIMAL(10,2)                                           NOT NULL DEFAULT 0,
    payment     ENUM('GCash','PayMaya','COD','Credit Card')             NOT NULL DEFAULT 'COD',
    address     TEXT                                                    NOT NULL,
    notes       TEXT,
    order_date  DATE                                                    NOT NULL,
    created_at  TIMESTAMP                                               DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP                                               DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status  (status),
    INDEX idx_date    (order_date),
    INDEX idx_email   (email)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Order Items  (one row per product per order)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT             NOT NULL,
    product     VARCHAR(150)    NOT NULL,
    qty         INT             NOT NULL DEFAULT 1,
    price       DECIMAL(10,2)   NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- Daily Sales  (aggregate cache for analytics)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales (
    sale_date   DATE            PRIMARY KEY,
    total       DECIMAL(12,2)   NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promotions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(150)        NOT NULL,
    description   TEXT                 NOT NULL,
    image_url     VARCHAR(255)         NULL,
    coupon_code   VARCHAR(50)          NULL,
    starts_at     DATETIME             NOT NULL,
    ends_at       DATETIME             NOT NULL,
    status        ENUM('draft','sent','sent_with_failures','failed') NOT NULL DEFAULT 'draft',
    sent_count    INT UNSIGNED         NOT NULL DEFAULT 0,
    failed_count  INT UNSIGNED         NOT NULL DEFAULT 0,
    created_at    TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP            DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_starts_at (starts_at),
    INDEX idx_ends_at (ends_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promotion_email_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    promotion_id  INT                  NOT NULL,
    email         VARCHAR(255)         NOT NULL,
    status        ENUM('sent','failed') NOT NULL DEFAULT 'sent',
    error_message TEXT                 NULL,
    attempted_at  TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    INDEX idx_promotion (promotion_id),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- Seed data
-- ============================================================

-- Users (passwords are bcrypt hashes of the demo values)
INSERT INTO users (name, email, password, role) VALUES
('Shop Owner', 'admin@pastry.com',    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Staff Member','staff@pastry.com',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff'),
('Customer',    'customer@pastry.com','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer')
ON DUPLICATE KEY UPDATE id=id;
-- NOTE: The hash above is bcrypt of "password". 
-- Change these hashes before going to production!
-- Generate with: php -r "echo password_hash('your_password', PASSWORD_BCRYPT);"

-- Products
INSERT INTO products (name, category, price, stock, image, description, available) VALUES
('Chocolate Lava Cake', 'Cakes',     350.00, 15, '🎂', 'Rich molten chocolate center',       1),
('Strawberry Tart',     'Pastries',  180.00, 22, '🍓', 'Fresh strawberries on custard',       1),
('Croissant',           'Bread',      95.00, 30, '🥐', 'Buttery, flaky French croissant',     1),
('Blueberry Muffin',    'Muffins',   120.00, 18, '🫐', 'Loaded with fresh blueberries',       1),
('Caramel Flan',        'Desserts',  200.00,  8, '🍮', 'Classic Filipino leche flan',         1),
('Ube Pandesal',        'Bread',      45.00, 50, '🍞', 'Purple yam Filipino bread roll',      1),
('Tiramisu Slice',      'Cakes',     280.00,  3, '☕', 'Italian coffee dessert',              1),
('Macarons (6pcs)',     'Pastries',  320.00, 12, '🍭', 'Assorted French macarons',            1);

-- Ingredients
INSERT INTO ingredients (name, unit, stock, threshold, expiry) VALUES
('All-purpose Flour', 'kg',  25.000, 5.000, '2025-08-30'),
('Butter',            'kg',   8.000, 2.000, '2025-05-15'),
('Sugar',             'kg',  20.000, 4.000, '2026-01-01'),
('Eggs',              'pcs',120.000,24.000, '2025-05-10'),
('Fresh Cream',       'L',    6.000, 2.000, '2025-05-08'),
('Chocolate',         'kg',   4.000, 1.000, '2025-12-31'),
('Strawberries',      'kg',   2.000, 1.000, '2025-05-06'),
('Blueberries',       'kg',   1.500, 0.500, '2025-05-07');

-- Orders
INSERT INTO orders (id, customer, email, type, status, total, payment, address, order_date) VALUES
(1001,'Maria Santos',  'maria@email.com', 'Standard',  'Completed', 530.00,'GCash',  '123 Rizal St, Tanauan',      '2025-05-01'),
(1002,'Juan Dela Cruz','juan@email.com',  'Pre-order', 'Preparing', 700.00,'PayMaya','456 Mabini Ave, Batangas',   '2025-05-03'),
(1003,'Ana Reyes',     'ana@email.com',   'Rush',      'Confirmed', 280.00,'GCash',  '789 Bonifacio St, Lipa',     '2025-05-04'),
(1004,'Pedro Lim',     'pedro@email.com', 'Standard',  'Pending',   455.00,'COD',    '321 Luna St, Tanauan',       '2025-05-04'),
(1005,'Sofia Garcia',  'sofia@email.com', 'Standard',  'Completed',1050.00,'GCash',  '654 Del Pilar, Batangas',    '2025-04-28'),
(1006,'Carlo Mendoza', 'carlo@email.com', 'Pre-order', 'Completed', 640.00,'PayMaya','987 Aguinaldo, Lipa',        '2025-04-25');

-- Order items
INSERT INTO order_items (order_id, product, qty, price) VALUES
(1001,'Chocolate Lava Cake', 1, 350.00),
(1001,'Blueberry Muffin',    1, 120.00),
(1001,'Croissant',           1,  95.00),
(1002,'Strawberry Tart',     2, 360.00),
(1002,'Macarons (6pcs)',     1, 320.00),
(1003,'Tiramisu Slice',      1, 280.00),
(1004,'Caramel Flan',        1, 200.00),
(1004,'Ube Pandesal',        3, 135.00),
(1004,'Croissant',           1,  95.00),
(1005,'Chocolate Lava Cake', 3,1050.00),
(1006,'Macarons (6pcs)',     2, 640.00);

-- Daily sales cache
INSERT INTO daily_sales (sale_date, total) VALUES
('2025-04-25', 640.00),
('2025-04-28',1050.00),
('2025-04-29', 780.00),
('2025-04-30', 920.00),
('2025-05-01', 530.00),
('2025-05-02', 660.00),
('2025-05-03', 700.00),
('2025-05-04', 735.00)
ON DUPLICATE KEY UPDATE total = VALUES(total);
