-- ============================================================
-- Migration 2026_08_25_06: create the analytics_* tables properly
-- ------------------------------------------------------------
-- Problem:
--   admin/api/api_predictive_analytics.php used to CREATE these
--   tables at runtime on every request (CREATE TABLE IF NOT
--   EXISTS inside a production API). Schema changes must live in
--   migrations, so the tables are created here instead and the
--   runtime DDL is removed from the API.
--
--   NOTE: these are DIFFERENT from the legacy ID-based analytics
--   tables (sales_daily_snapshots, demand_forecasts,
--   reorder_recommendations, reorder_logs, procurement_alerts,
--   simulated_baselines) which no code references. Those are left
--   untouched and documented as legacy.
--
-- Rollback:
--     mysql -u root pastry_db < database/migrations/rollback/2026_08_25_06_analytics_tables_rollback.sql
-- ============================================================

USE pastry_db;

CREATE TABLE IF NOT EXISTS analytics_imports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    source_name VARCHAR(100) NOT NULL DEFAULT 'POS Export',
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    rows_received INT NOT NULL DEFAULT 0,
    rows_processed INT NOT NULL DEFAULT 0,
    error_message TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS analytics_sales_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    import_id INT NULL,
    product_name VARCHAR(255) NOT NULL,
    sale_date DATE NOT NULL,
    units_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product_date (product_name, sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS analytics_forecasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_units DECIMAL(10,2) NOT NULL DEFAULT 0,
    confidence_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_forecast_product (product_name, forecast_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS analytics_reorder_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    recommended_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS analytics_procurement_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;