-- ============================================================
-- ROLLBACK for migration 2026_08_25_04 (order_items integrity)
-- Restores archived orphan rows and drops the new FK.
-- Run ONLY if you need to revert.
-- ============================================================

USE pastry_db;

ALTER TABLE order_items DROP FOREIGN KEY fk_order_items_order;
ALTER TABLE order_items MODIFY order_id INT NULL;

INSERT INTO order_items (order_id, product, variant, qty, price, details, image, product_id)
SELECT order_id, product, variant, qty, price, details, image, product_id
FROM order_items_orphan_archive;