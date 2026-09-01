-- Ingredient batch tracking and owner-approved discard workflow.
-- Apply after the existing inventory migrations.
USE pastry_db;

CREATE TABLE IF NOT EXISTS ingredient_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingredient_id INT NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity_received DECIMAL(10,3) NOT NULL,
    quantity_remaining DECIMAL(10,3) NOT NULL,
    purchase_date DATE NULL,
    expiry_date DATE NULL,
    supplier VARCHAR(150) NULL,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_ingredient_batch (ingredient_id, batch_number),
    INDEX idx_batch_expiry (expiry_date),
    INDEX idx_batch_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS discard_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingredient_id INT NOT NULL,
    ingredient_batch_id INT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    notes TEXT NULL,
    status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    requested_by INT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    rejected_by INT NULL,
    rejected_at DATETIME NULL,
    discarded_at DATETIME NULL,
    rejection_note TEXT NULL,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_batch_id) REFERENCES ingredient_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_discard_status (status, requested_at),
    INDEX idx_discard_batch (ingredient_batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS ingredient_batch_id INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS requested_by INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS approved_by INT NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS discarded_at DATETIME NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NULL;
ALTER TABLE waste_log ADD COLUMN IF NOT EXISTS discard_request_id INT NULL;
ALTER TABLE waste_log ADD INDEX IF NOT EXISTS idx_waste_discard_request (discard_request_id);
ALTER TABLE ingredient_movements ADD COLUMN IF NOT EXISTS previous_stock DECIMAL(10,3) NULL;
ALTER TABLE ingredient_movements ADD COLUMN IF NOT EXISTS new_stock DECIMAL(10,3) NULL;

-- Preserve pre-batch inventory as one identifiable batch per ingredient.
INSERT INTO ingredient_batches
    (ingredient_id, batch_number, quantity_received, quantity_remaining, expiry_date, unit_cost, notes)
SELECT i.id, CONCAT('LEGACY-', i.id), i.stock, i.stock, NULLIF(i.expiry, '0000-00-00'), i.unit_cost,
       'Migrated from ingredient-level inventory'
FROM ingredients i
WHERE NOT EXISTS (SELECT 1 FROM ingredient_batches b WHERE b.ingredient_id = i.id);
