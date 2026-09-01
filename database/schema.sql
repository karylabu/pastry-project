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
        minimum_stock INT               NOT NULL DEFAULT 5,
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
    reference_type  VARCHAR(40),
    reference_id    INT,
    created_at      TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_ingredient (ingredient_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_inventory_movements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    product_variant_id INT NULL,
    movement_type   VARCHAR(40) NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    previous_stock  DECIMAL(10,3) NOT NULL,
    new_stock       DECIMAL(10,3) NOT NULL,
    reason          VARCHAR(255),
    reference_type  VARCHAR(40),
    reference_id    INT,
    user_id         INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_product_reference (product_id, product_variant_id, movement_type, reference_type, reference_id),
    INDEX idx_product_created (product_id, created_at),
    INDEX idx_reference (reference_type, reference_id)
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
    active         TINYINT(1)          NOT NULL DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS waste_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    datetime        DATETIME NOT NULL,
    item            VARCHAR(150) NOT NULL,
    qty             DECIMAL(10,3) NOT NULL,
    unit_cost       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    item_type       ENUM('Raw Material','Finished Product') NOT NULL DEFAULT 'Raw Material',
    reason          VARCHAR(255) NOT NULL,
    ingredient_id   INT NULL,
    product_id      INT NULL,
    user_id         INT NULL,
    reference_type  VARCHAR(40) NULL,
    reference_id    INT NULL,
    idempotency_key VARCHAR(100) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_waste_datetime (datetime),
    INDEX idx_waste_item (item_type, ingredient_id, product_id),
    UNIQUE KEY uq_waste_idempotency (idempotency_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS production_transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    quantity    INT NOT NULL,
    user_id     INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_production_product (product_id, created_at)
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
    product_id  INT             NULL,
    product     VARCHAR(150)    NOT NULL,
    qty         INT             NOT NULL DEFAULT 1,
    price       DECIMAL(10,2)   NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_order_product (order_id, product_id),
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

