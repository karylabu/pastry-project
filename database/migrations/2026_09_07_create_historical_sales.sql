-- Historical sales imported from external Excel files.
-- These rows are intentionally separate from orders and products.
USE pastry_db;

CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cake_name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    down_payment DECIMAL(12,2) NOT NULL,
    remaining_balance DECIMAL(12,2) NOT NULL,
    sale_date DATE NOT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'excel_import',
    import_batch_hash CHAR(64) NULL,
    data_fingerprint CHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sales_batch_row (import_batch_hash, cake_name, price, sale_date),
    UNIQUE KEY uq_sales_data_fingerprint (data_fingerprint),
    INDEX idx_sales_date (sale_date),
    INDEX idx_sales_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
