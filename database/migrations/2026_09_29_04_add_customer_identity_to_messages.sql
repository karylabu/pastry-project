-- Preserve the customer identity associated with each chat message.
USE pastry_db;

ALTER TABLE messages
    ADD COLUMN customer_name VARCHAR(255) DEFAULT NULL AFTER user_id,
    ADD COLUMN customer_email VARCHAR(255) DEFAULT NULL AFTER customer_name;