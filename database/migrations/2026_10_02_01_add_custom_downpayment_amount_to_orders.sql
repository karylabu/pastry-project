-- Store the accepted custom cake downpayment for final balance calculations.
USE pastry_db;

ALTER TABLE orders
    ADD COLUMN downpayment_amount DECIMAL(10,2) DEFAULT NULL AFTER total;