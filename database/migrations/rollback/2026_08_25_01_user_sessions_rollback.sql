-- ============================================================
-- ROLLBACK for migration 2026_08_25_01 (user_sessions)
-- Drops the user_sessions table. Login tokens stored there will
-- be lost; users simply log in again.
-- ============================================================

USE pastry_db;

DROP TABLE IF EXISTS user_sessions;