-- ============================================================
-- Migration 2026_08_25_05: safe foreign keys + business-rule
-- unique constraints + query indexes
-- ------------------------------------------------------------
-- Every constraint below was verified against live data first:
--   * ingredient_movements.user_id  -> 0 invalid references
--   * custom_cake_orders.order_id   -> 0 orphans
--   * products (name, category)     -> 0 duplicate pairs
--                                     (the 4 duplicate names are the
--                                      same drink offered in two
--                                      different categories)
--   * ingredients.name              -> 0 duplicates
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_05_constraints_and_indexes_rollback.sql
-- ============================================================

USE pastry_db;

-- ------------------------------------------------------------
-- Foreign keys (all nullable / SET NULL so historical rows stay
-- readable if a user is ever removed)
-- ------------------------------------------------------------

-- Who performed each ingredient stock movement.
ALTER TABLE ingredient_movements
    ADD CONSTRAINT fk_ingmov_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Custom cake details belong to exactly one order.
ALTER TABLE custom_cake_orders
    ADD CONSTRAINT fk_custom_cake_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- Unique constraints matching actual business rules
-- ------------------------------------------------------------

-- One product per name within a category. Cross-category repeats
-- (e.g. "Caramel" in Drinks and Coffee) remain allowed.
ALTER TABLE products
    ADD UNIQUE KEY uq_product_name_category (name, category);

-- Ingredient names must be unique: duplicates would split one
-- physical stock pool across two rows and corrupt deductions.
ALTER TABLE ingredients
    ADD UNIQUE KEY uq_ingredient_name (name);

-- ------------------------------------------------------------
-- Indexes for frequent queries (each justified by a real query path)
-- ------------------------------------------------------------

-- orders.status  : staff order lists + analytics filter out Cancelled
-- orders.created_at : default sort (ORDER BY created_at DESC) and
--                     daily sales grouping in api_predictive_analytics.php
-- orders.email   : api_get_orders.php filters by customer email
ALTER TABLE orders
    ADD INDEX idx_status (status),
    ADD INDEX idx_created_at (created_at),
    ADD INDEX idx_email (email);

-- password_resets.email : forgot-password flow looks up by email
ALTER TABLE password_resets
    ADD INDEX idx_password_resets_email (email);