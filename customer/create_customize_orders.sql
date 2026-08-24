-- SQL Script to create customize_orders table
-- Run this in phpMyAdmin or MySQL command line

CREATE TABLE IF NOT EXISTS `customize_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `order_id` int(11),
  `cake_size` varchar(100) DEFAULT NULL,
  `servings` int(11) DEFAULT NULL,
  `cake_flavor` varchar(100) DEFAULT NULL,
  `filling_flavor` varchar(100) DEFAULT NULL,
  `frosting_type` varchar(100) DEFAULT NULL,
  `occasion` varchar(100) DEFAULT NULL,
  `theme` varchar(255) DEFAULT NULL,
  `cake_color` varchar(100) DEFAULT NULL,
  `custom_message` text,
  `special_instructions` text,
  `addons` text,
  `estimated_price` decimal(10,2) DEFAULT NULL,
  `delivery_method` varchar(50) DEFAULT NULL,
  `delivery_address` text,
  `pickup_date` date DEFAULT NULL,
  `pickup_time` time DEFAULT NULL,
  `reference_images` json,
  `status` varchar(50) DEFAULT 'Pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `customize_orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
