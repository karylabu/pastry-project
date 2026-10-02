-- Store short-lived order/chat invalidation events for authenticated SSE clients.
USE pastry_db;

CREATE TABLE realtime_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audience ENUM('admins', 'user') NOT NULL,
    user_id INT NULL,
    event_name VARCHAR(48) NOT NULL,
    order_id INT NULL,
    conversation_id VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_realtime_admin_stream (audience, id),
    INDEX idx_realtime_user_stream (audience, user_id, id),
    INDEX idx_realtime_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;