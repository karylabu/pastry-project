-- ============================================================
-- Migration 2026_09_16_01: order item product-size relationship
-- ------------------------------------------------------------
-- Adds the nullable canonical product-size reference for existing
-- order_items. Historical rows are intentionally not backfilled.
--
-- Apply only after backing up pastry_db and verifying the live schema.
-- ============================================================

USE pastry_db;

ALTER TABLE order_items
    ADD COLUMN product_size_id INT(11) NULL AFTER product_id,
    ADD INDEX idx_order_items_product_size_id (product_size_id),
    ADD CONSTRAINT fk_order_items_product_size
        FOREIGN KEY (product_size_id) REFERENCES product_sizes(id)
        ON DELETE SET NULL;
