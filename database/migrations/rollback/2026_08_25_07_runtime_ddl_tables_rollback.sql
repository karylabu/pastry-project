-- ============================================================
-- ROLLBACK for migration 2026_08_25_07 (runtime DDL tables)
-- ============================================================

USE pastry_db;

ALTER TABLE messages DROP COLUMN IF EXISTS user_id;
ALTER TABLE messages DROP COLUMN IF EXISTS updated_at;
ALTER TABLE users DROP COLUMN IF EXISTS profile_image;
DROP TABLE IF EXISTS customize_orders;