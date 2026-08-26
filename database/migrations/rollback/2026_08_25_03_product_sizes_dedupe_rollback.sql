-- ============================================================
-- ROLLBACK for migration 2026_08_25_03 (product_sizes dedupe)
-- Restores archived duplicate rows and drops the unique key.
-- Run ONLY if you need to revert the dedupe migration.
-- ============================================================

USE pastry_db;

-- Put the archived rows back (unique key must be dropped first,
-- otherwise identical pairs cannot coexist again).
ALTER TABLE product_sizes DROP INDEX uq_product_size;

INSERT INTO product_sizes (product_id, size, price, available)
SELECT product_id, size, price, available FROM product_sizes_archive;

-- Restore the original narrow ENUM (fails if non-enum values exist;
-- that is intentional - it prevents silent data loss on rollback).
ALTER TABLE product_sizes
    MODIFY size ENUM('slice','small','big') NOT NULL;

-- The archive table is kept as an audit trail.