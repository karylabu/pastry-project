-- Inventory tracking migration. Run once against pastry_db.
-- Existing rows are preserved; nullable additions keep legacy records readable.

CREATE TABLE IF NOT EXISTS product_inventory_movements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    product_variant_id INT NULL,
    movement_type   VARCHAR(40) NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    previous_stock  DECIMAL(10,3) NOT NULL,
    new_stock       DECIMAL(10,3) NOT NULL,
    reason          VARCHAR(255) NULL,
    reference_type  VARCHAR(40) NULL,
    reference_id    INT NULL,
    user_id         INT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_product_reference (product_id, product_variant_id, movement_type, reference_type, reference_id),
    INDEX idx_product_created (product_id, created_at),
    INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS production_transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    quantity    INT NOT NULL,
    user_id     INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_production_product (product_id, created_at)
) ENGINE=InnoDB;

ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS minimum_stock INT NOT NULL DEFAULT 5;
ALTER TABLE product_inventory_movements ADD COLUMN IF NOT EXISTS product_variant_id INT NULL;
ALTER TABLE product_inventory_movements DROP INDEX uq_product_reference, ADD UNIQUE KEY uq_product_reference (product_id, product_variant_id, movement_type, reference_type, reference_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS method VARCHAR(50) NOT NULL DEFAULT 'Delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lat DECIMAL(10,8) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lng DECIMAL(11,8) NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS ingredient_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS product_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS user_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS reference_type VARCHAR(40) NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS reference_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) NULL;
ALTER TABLE waste_log ADD UNIQUE KEY uq_waste_idempotency (idempotency_key);
ALTER TABLE ingredient_movements ADD COLUMN IF NOT EXISTS reference_type VARCHAR(40) NULL;
ALTER TABLE ingredient_movements ADD COLUMN IF NOT EXISTS reference_id INT NULL;

-- Add these only when the constraints do not already exist in the target database.
-- Existing historical rows are not changed by these relationships.
-- ALTER TABLE order_items ADD CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
-- ALTER TABLE waste_log ADD CONSTRAINT fk_waste_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL;
-- ALTER TABLE waste_log ADD CONSTRAINT fk_waste_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
-- ALTER TABLE waste_log ADD CONSTRAINT fk_waste_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
