-- ============================================================
-- ROLLBACK for migration 2026_08_25_06 (analytics tables)
-- Drops the analytics_* tables. Check they hold no data you need
-- before running (they are regenerated from orders on demand).
-- ============================================================

USE pastry_db;

DROP TABLE IF EXISTS analytics_procurement_alerts;
DROP TABLE IF EXISTS analytics_reorder_logs;
DROP TABLE IF EXISTS analytics_forecasts;
DROP TABLE IF EXISTS analytics_sales_history;
DROP TABLE IF EXISTS analytics_imports;