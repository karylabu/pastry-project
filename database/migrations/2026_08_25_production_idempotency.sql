-- Migration: production idempotency support 
-- Adds an optional client-supplied idempotency key to production 
-- transactions so duplicate Produce submissions cannot double-count. 
-- Applied: 2026-08-25 
 
ALTER TABLE production_transactions 
    ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER quantity; 
 
ALTER TABLE production_transactions 
    ADD UNIQUE KEY uq_production_idempotency (idempotency_key);
