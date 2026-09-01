-- ============================================================
-- Migration 2026_08_25_03: product_sizes dedupe + widen size values
-- ------------------------------------------------------------
-- Problem:
--   product_sizes contained exact duplicate rows: every
--   (product_id, size) combination existed twice
--   (78 rows = 39 real rows x 2). Nothing enforces uniqueness,
--   so any re-seed script doubles the catalogue again.
--
--   The `size` column is ENUM('slice','small','big') but the
--   application code (customer/api_products.php, starter setup
--   scripts) also uses 'regular', 'meal', 'combo', 'solo' and
--   'sharing'. The ENUM silently blocks those values.
--
-- Strategy:
--   1. Archive duplicate rows into product_sizes_archive
--      (nothing is destroyed).
--   2. Delete the duplicates, keeping the LOWEST id per pair.
--   3. Widen `size` from ENUM to VARCHAR(30) so all sizes used
--      by the code are storable. Existing data ('slice','small',
--      'big') maps 1:1 — no value conversion needed.
--   4. Add UNIQUE (product_id, size) to make duplicates impossible.
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_03_product_sizes_dedupe_rollback.sql
-- ============================================================

USE pastry_db;

-- 1. Archive table (created only if missing)
CREATE TABLE IF NOT EXISTS product_sizes_archive LIKE product_sizes;

-- 2. Copy the duplicates we are about to remove into the archive
INSERT INTO product_sizes_archive
SELECT ps.*
FROM product_sizes ps
JOIN (
    SELECT product_id, size, MIN(id) AS keep_id
    FROM product_sizes
    GROUP BY product_id, size
    HAVING COUNT(*) > 1
) d ON d.product_id = ps.product_id AND d.size = ps.size AND ps.id <> d.keep_id;

-- 3. Remove the duplicates (keep lowest id)
DELETE ps
FROM product_sizes ps
JOIN (
    SELECT product_id, size, MIN(id) AS keep_id
    FROM product_sizes
    GROUP BY product_id, size
    HAVING COUNT(*) > 1
) d ON d.product_id = ps.product_id AND d.size = ps.size AND ps.id <> d.keep_id;

-- 4. Widen the size column (ENUM -> VARCHAR). Safe: current values fit.
ALTER TABLE product_sizes MODIFY size VARCHAR(30) NOT NULL;

-- 5. Enforce one row per product+size
ALTER TABLE product_sizes ADD UNIQUE KEY uq_product_size (product_id, size);