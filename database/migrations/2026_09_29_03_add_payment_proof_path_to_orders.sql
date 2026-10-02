-- Store customer payment proofs privately for Admin review.
USE pastry_db;

ALTER TABLE orders
    ADD COLUMN payment_proof_path VARCHAR(255) DEFAULT NULL AFTER payment_reference;