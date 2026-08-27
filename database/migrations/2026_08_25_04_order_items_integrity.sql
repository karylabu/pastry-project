-- ============================================================
-- Migration 2026_08_25_04: order_items integrity (orphans, product links)
-- ------------------------------------------------------------
-- Problem:
--   order_items.order_id had NO foreign key and was nullable.
--   Audit found 158 of 160 rows reference orders 1001-1090 that
--   no longer exist (old demo/seed data whose parent orders were
--   removed). All 160 rows also have product_id = NULL even when
--   the product name still matches a real product.
--
-- Strategy:
--   1. Archive orphan rows to order_items_orphan_archive
--      (historical information preserved: product name, qty,
--      price at transaction time).
--   2. Delete orphans from the live table.
--   3. Backfill product_id by exact name match.
--   4. Make order_id NOT NULL and add FK -> orders(id)
--      ON DELETE CASCADE so this can never happen again.
--      (product_id already has fk_order_items_product.)
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_04_order_items_integrity_rollback.sql
-- ============================================================

USE pastry_db;

-- 1. Archive orphans (structure + data snapshot)
CREATE TABLE IF NOT EXISTS order_items_orphan_archive AS
SELECT oi.*
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

-- 2. Remove orphans from the live table
DELETE oi
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

-- 3. Backfill product_id from the historical product name
UPDATE order_items oi
JOIN products p ON LOWER(TRIM(p.name)) = LOWER(TRIM(oi.product))
SET oi.product_id = p.id
WHERE oi.product_id IS NULL;

-- 4. Enforce the relationship
ALTER TABLE order_items MODIFY order_id INT NOT NULL;
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;