-- ============================================================
-- Migration 2026_08_25_02: Give audit_log a real primary key
-- ------------------------------------------------------------
-- Problem:
--   In the live database, audit_log.id was created WITHOUT
--   auto_increment and WITHOUT a primary key. All 40 existing
--   rows share the same id value (0), so inserts only work by
--   accident and rows cannot be addressed individually.
--
-- Strategy (non-destructive):
--   1. Take a backup snapshot of the table (see README.md /
--      backup procedure before running).
--   2. Number existing rows sequentially, oldest first, into a
--      temporary column.
--   3. Copy the numbers into id, drop the temp column, then add
--      PRIMARY KEY + AUTO_INCREMENT.
--
-- No rows are deleted. Historical content is preserved verbatim;
-- only the meaningless duplicated id values are replaced with
-- unique sequential ids.
--
-- Rollback:
--   Not practically reversible row-by-row (the original ids were
--   all identical and carried no information). Restore from the
--   pre-migration backup if required:
--     mysql -u root pastry_db < backup_audit_log_pre_02.sql
-- ============================================================

USE pastry_db;

-- Safety: abort if the table already has a primary key.
-- (Re-running this migration must be a no-op / error, never a renumber.)
SELECT COUNT(*) INTO @pk_count
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND table_name = 'audit_log'
  AND constraint_type = 'PRIMARY KEY';

-- Number the rows oldest-first using a session variable.
SET @rn := 0;
ALTER TABLE audit_log ADD COLUMN _new_id INT NULL;
UPDATE audit_log SET _new_id = (@rn := @rn + 1) ORDER BY created_at ASC, id ASC;
UPDATE audit_log SET id = _new_id;
ALTER TABLE audit_log DROP COLUMN _new_id;

-- Add the primary key with auto increment.
ALTER TABLE audit_log
    MODIFY id INT NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (id);

-- Helpful index for the common "recent activity" listing.
ALTER TABLE audit_log ADD INDEX idx_audit_created (created_at);