-- Batch-level ingredient tracking and production idempotency preparation.
-- This migration is intentionally additive and does not change existing behavior.
USE pastry_db;

-- -----------------------------------------------------------------------------
-- CHANGE 1: Add batch_id to ingredient_movements (nullable for legacy records)
-- -----------------------------------------------------------------------------
SET @ingredient_movements_batch_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ingredient_movements'
      AND column_name = 'batch_id'
);

SET @ingredient_movements_batch_sql := IF(
    @ingredient_movements_batch_column_exists = 0,
    'ALTER TABLE ingredient_movements ADD COLUMN batch_id INT NULL AFTER ingredient_id',
    'SELECT 1'
);
PREPARE ingredient_movements_batch_stmt FROM @ingredient_movements_batch_sql;
EXECUTE ingredient_movements_batch_stmt;
DEALLOCATE PREPARE ingredient_movements_batch_stmt;

SET @ingredient_movements_batch_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ingredient_movements'
      AND index_name = 'idx_ingredient_batch'
);

SET @ingredient_movements_batch_index_sql := IF(
    @ingredient_movements_batch_index_exists = 0,
    'CREATE INDEX idx_ingredient_batch ON ingredient_movements (batch_id)',
    'SELECT 1'
);
PREPARE ingredient_movements_batch_index_stmt FROM @ingredient_movements_batch_index_sql;
EXECUTE ingredient_movements_batch_index_stmt;
DEALLOCATE PREPARE ingredient_movements_batch_index_stmt;

SET @ingredient_movements_batch_fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
      AND constraint_name = 'fk_ingredient_movements_batch'
);

SET @ingredient_movements_batch_fk_sql := IF(
    @ingredient_movements_batch_fk_exists = 0,
    'ALTER TABLE ingredient_movements ADD CONSTRAINT fk_ingredient_movements_batch FOREIGN KEY (batch_id) REFERENCES ingredient_batches(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE ingredient_movements_batch_fk_stmt FROM @ingredient_movements_batch_fk_sql;
EXECUTE ingredient_movements_batch_fk_stmt;
DEALLOCATE PREPARE ingredient_movements_batch_fk_stmt;

-- -----------------------------------------------------------------------------
-- CHANGE 2: Add idempotency_key to production_transactions
-- -----------------------------------------------------------------------------
SET @production_idempotency_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'production_transactions'
      AND column_name = 'idempotency_key'
);

SET @production_idempotency_column_sql := IF(
    @production_idempotency_column_exists = 0,
    'ALTER TABLE production_transactions ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER quantity',
    'SELECT 1'
);
PREPARE production_idempotency_column_stmt FROM @production_idempotency_column_sql;
EXECUTE production_idempotency_column_stmt;
DEALLOCATE PREPARE production_idempotency_column_stmt;

SET @production_idempotency_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'production_transactions'
      AND index_name = 'uq_production_idempotency_key'
);

SET @production_idempotency_index_sql := IF(
    @production_idempotency_index_exists = 0,
    'CREATE UNIQUE INDEX uq_production_idempotency_key ON production_transactions (idempotency_key)',
    'SELECT 1'
);
PREPARE production_idempotency_index_stmt FROM @production_idempotency_index_sql;
EXECUTE production_idempotency_index_stmt;
DEALLOCATE PREPARE production_idempotency_index_stmt;

-- -----------------------------------------------------------------------------
-- CHANGE 3: Create a batch allocation table for actual production consumption
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_batch_allocations (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    production_transaction_id INT NOT NULL,
    ingredient_id            INT NOT NULL,
    ingredient_batch_id      INT NOT NULL,
    quantity_consumed        DECIMAL(10,3) NOT NULL,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_production_batch_allocations_positive_qty
        CHECK (quantity_consumed > 0),
    CONSTRAINT fk_production_batch_allocations_production
        FOREIGN KEY (production_transaction_id) REFERENCES production_transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_production_batch_allocations_ingredient
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    CONSTRAINT fk_production_batch_allocations_batch
        FOREIGN KEY (ingredient_batch_id) REFERENCES ingredient_batches(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_production_batch_allocations_txn
    ON production_batch_allocations (production_transaction_id);

CREATE INDEX IF NOT EXISTS idx_production_batch_allocations_batch
    ON production_batch_allocations (ingredient_batch_id);

CREATE INDEX IF NOT EXISTS idx_production_batch_allocations_ingredient
    ON production_batch_allocations (ingredient_id);

-- -----------------------------------------------------------------------------
-- Safety note:
-- Existing columns are preserved.
-- Legacy records remain valid because batch_id is nullable and idempotency_key is nullable.
-- This migration is additive and intentionally does not change current runtime logic.
-- -----------------------------------------------------------------------------
