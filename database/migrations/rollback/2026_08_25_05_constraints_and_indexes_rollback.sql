-- ============================================================
-- ROLLBACK for migration 2026_08_25_05 (constraints & indexes)
-- ============================================================

USE pastry_db;

ALTER TABLE ingredient_movements DROP FOREIGN KEY fk_ingmov_user;
ALTER TABLE custom_cake_orders DROP FOREIGN KEY fk_custom_cake_order;

ALTER TABLE products DROP INDEX uq_product_name_category;
ALTER TABLE ingredients DROP INDEX uq_ingredient_name;

ALTER TABLE orders DROP INDEX idx_status;
ALTER TABLE orders DROP INDEX idx_created_at;
ALTER TABLE orders DROP INDEX idx_email;

ALTER TABLE password_resets DROP INDEX idx_password_resets_email;