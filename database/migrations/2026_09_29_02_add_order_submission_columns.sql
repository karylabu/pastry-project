-- Add fields written by Laravel's customer order endpoint.
USE pastry_db;

ALTER TABLE orders
    ADD COLUMN discount_type VARCHAR(32) NOT NULL DEFAULT 'none' AFTER payment_status,
    ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER discount_type,
    ADD COLUMN discount_id_path VARCHAR(255) DEFAULT NULL AFTER discount;

ALTER TABLE orders
    MODIFY status ENUM('Awaiting Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled')
    NOT NULL DEFAULT 'Pending';