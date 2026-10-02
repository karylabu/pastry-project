-- Add order classification fields required by Laravel OrderController.
USE pastry_db;

ALTER TABLE orders
    ADD COLUMN order_type VARCHAR(64) NOT NULL DEFAULT 'Standard' AFTER payment_status,
    ADD COLUMN is_customized TINYINT(1) NOT NULL DEFAULT 0 AFTER order_type;