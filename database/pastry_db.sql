-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 01, 2026 at 04:20 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pastry_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `addresses`
--

CREATE TABLE `addresses` (
  `address_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `address_label` varchar(50) NOT NULL,
  `recipient_name` varchar(100) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `house_no` varchar(50) DEFAULT NULL,
  `street` varchar(100) NOT NULL,
  `barangay` varchar(100) NOT NULL,
  `city` varchar(100) NOT NULL,
  `province` varchar(100) NOT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `landmark` varchar(255) DEFAULT NULL,
  `delivery_instructions` text DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `addresses`
--

INSERT INTO `addresses` (`address_id`, `customer_id`, `address_label`, `recipient_name`, `contact_number`, `house_no`, `street`, `barangay`, `city`, `province`, `zip_code`, `landmark`, `delivery_instructions`, `is_default`, `created_at`, `updated_at`) VALUES
(1, 8, 'Home', 'Karyl Hernandez', '09994840687', '114', 'Purok 1', 'Trapiche', 'Tanauan', 'Batangas', '4232', '', '0', 1, '2026-06-24 16:06:35', '2026-06-24 16:06:35');

-- --------------------------------------------------------

--
-- Table structure for table `analytics_forecasts`
--

CREATE TABLE `analytics_forecasts` (
  `id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `forecast_date` date NOT NULL,
  `predicted_units` decimal(10,2) NOT NULL DEFAULT 0.00,
  `confidence_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `generated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `analytics_imports`
--

CREATE TABLE `analytics_imports` (
  `id` int(11) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `source_name` varchar(100) NOT NULL DEFAULT 'POS Export',
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL DEFAULT 'completed',
  `rows_received` int(11) NOT NULL DEFAULT 0,
  `rows_processed` int(11) NOT NULL DEFAULT 0,
  `error_message` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `analytics_procurement_alerts`
--

CREATE TABLE `analytics_procurement_alerts` (
  `id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `ingredient_name` varchar(255) NOT NULL,
  `severity` varchar(20) NOT NULL DEFAULT 'warning',
  `message` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `analytics_reorder_logs`
--

CREATE TABLE `analytics_reorder_logs` (
  `id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `ingredient_name` varchar(255) NOT NULL,
  `recommended_qty` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `analytics_sales_history`
--

CREATE TABLE `analytics_sales_history` (
  `id` int(11) NOT NULL,
  `import_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `sale_date` date NOT NULL,
  `units_sold` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `context` varchar(50) NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_log`
--

INSERT INTO `audit_log` (`id`, `user_id`, `context`, `action`, `entity_type`, `entity_id`, `note`, `created_at`) VALUES
(1, 35, 'orders', 'status_change', 'order', 142, 'Order #142 status changed from Pending to Pending', '2026-08-25 03:09:17'),
(2, 35, 'orders', 'status_change', 'order', 142, 'Order #142 status changed from Pending to Cancelled', '2026-08-25 03:09:17'),
(3, 35, 'orders', 'status_change', 'order', 142, 'Order #142 status changed from Cancelled to Cancelled', '2026-08-25 03:09:17'),
(4, 38, 'stocks', 'stock_in', 'product', 124, 'Product increased stock in via api_update_stocks', '2026-08-25 03:15:05'),
(5, 38, 'stocks', 'stock_out', 'product', 124, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:15:05'),
(6, 38, 'stocks', 'stock_out', 'product', 124, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:15:05'),
(7, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Pending to Confirmed', '2026-08-25 03:15:05'),
(8, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Confirmed to Pending', '2026-08-25 03:15:05'),
(9, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Pending to Confirmed', '2026-08-25 03:15:05'),
(10, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Confirmed to Cancelled', '2026-08-25 03:15:05'),
(11, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Cancelled to Cancelled', '2026-08-25 03:15:05'),
(12, 38, 'orders', 'status_change', 'order', 144, 'Order #144 status changed from Cancelled to Confirmed', '2026-08-25 03:15:05'),
(13, 38, 'orders', 'status_change', 'order', 145, 'Order #145 status changed from Confirmed to Confirmed', '2026-08-25 03:15:05'),
(14, 38, 'orders', 'status_change', 'order', 145, 'Order #145 status changed from Pending to Confirmed', '2026-08-25 03:15:05'),
(15, 40, 'stocks', 'stock_out', 'product', 125, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:17:44'),
(16, 40, 'orders', 'status_change', 'order', 146, 'Order #146 status changed from Pending to Confirmed', '2026-08-25 03:17:44'),
(17, 40, 'orders', 'status_change', 'order', 146, 'Order #146 status changed from Confirmed to Pending', '2026-08-25 03:17:44'),
(18, 40, 'orders', 'status_change', 'order', 146, 'Order #146 status changed from Pending to Confirmed', '2026-08-25 03:17:44'),
(19, 43, 'stocks', 'stock_in', 'product', 126, 'Product increased stock in via api_update_stocks', '2026-08-25 03:36:35'),
(20, 43, 'stocks', 'stock_out', 'product', 126, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:36:35'),
(21, 43, 'stocks', 'stock_out', 'product', 126, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:36:35'),
(22, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Pending to Confirmed', '2026-08-25 03:36:36'),
(23, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Confirmed to Pending', '2026-08-25 03:36:36'),
(24, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Pending to Confirmed', '2026-08-25 03:36:36'),
(25, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Confirmed to Cancelled', '2026-08-25 03:36:36'),
(26, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Cancelled to Cancelled', '2026-08-25 03:36:36'),
(27, 43, 'orders', 'status_change', 'order', 147, 'Order #147 status changed from Cancelled to Confirmed', '2026-08-25 03:36:36'),
(28, 43, 'orders', 'status_change', 'order', 148, 'Order #148 status changed from Pending to Confirmed', '2026-08-25 03:36:36'),
(29, 43, 'orders', 'status_change', 'order', 148, 'Order #148 status changed from Confirmed to Confirmed', '2026-08-25 03:36:36'),
(30, 45, 'stocks', 'stock_in', 'product', 127, 'Product increased stock in via api_update_stocks', '2026-08-25 03:40:43'),
(31, 45, 'stocks', 'stock_out', 'product', 127, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:40:43'),
(32, 45, 'stocks', 'stock_out', 'product', 127, 'Product decreased stock out via api_update_stocks', '2026-08-25 03:40:43'),
(33, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Pending to Confirmed', '2026-08-25 03:40:43'),
(34, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Confirmed to Pending', '2026-08-25 03:40:43'),
(35, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Pending to Confirmed', '2026-08-25 03:40:43'),
(36, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Confirmed to Cancelled', '2026-08-25 03:40:43'),
(37, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Cancelled to Cancelled', '2026-08-25 03:40:44'),
(38, 45, 'orders', 'status_change', 'order', 149, 'Order #149 status changed from Cancelled to Confirmed', '2026-08-25 03:40:44'),
(39, 45, 'orders', 'status_change', 'order', 150, 'Order #150 status changed from Pending to Confirmed', '2026-08-25 03:40:44'),
(40, 45, 'orders', 'status_change', 'order', 150, 'Order #150 status changed from Confirmed to Confirmed', '2026-08-25 03:40:44'),
(41, 2, 'orders', 'status_change', 'order', 3, 'Order #3 status changed from Preparing to To Receive', '2026-08-26 05:23:37'),
(42, 2, 'orders', 'status_change', 'order', 5, 'Order #5 status changed from Preparing to To Receive', '2026-08-26 05:23:43');

-- --------------------------------------------------------

--
-- Table structure for table `customize_orders`
--

CREATE TABLE `customize_orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `cake_size` varchar(100) DEFAULT NULL,
  `servings` int(11) DEFAULT NULL,
  `cake_flavor` varchar(100) DEFAULT NULL,
  `filling_flavor` varchar(100) DEFAULT NULL,
  `frosting_type` varchar(100) DEFAULT NULL,
  `occasion` varchar(100) DEFAULT NULL,
  `theme` varchar(255) DEFAULT NULL,
  `cake_color` varchar(100) DEFAULT NULL,
  `custom_message` text DEFAULT NULL,
  `special_instructions` text DEFAULT NULL,
  `addons` text DEFAULT NULL,
  `estimated_price` decimal(10,2) DEFAULT NULL,
  `delivery_method` varchar(50) DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `pickup_date` date DEFAULT NULL,
  `pickup_time` time DEFAULT NULL,
  `reference_images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`reference_images`)),
  `status` varchar(50) DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `custom_cake_orders`
--

CREATE TABLE `custom_cake_orders` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `cake_size` varchar(50) DEFAULT NULL,
  `quantity` int(11) DEFAULT 1,
  `flavor` varchar(100) DEFAULT NULL,
  `filling` varchar(100) DEFAULT NULL,
  `frosting` varchar(100) DEFAULT NULL,
  `occasion` varchar(100) DEFAULT NULL,
  `theme_design` varchar(255) DEFAULT NULL,
  `preferred_colors` varchar(255) DEFAULT NULL,
  `tiers` varchar(50) DEFAULT NULL,
  `dedication` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `estimated_price` decimal(10,2) DEFAULT 0.00,
  `inspo_images` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `custom_cake_orders`
--

INSERT INTO `custom_cake_orders` (`id`, `order_id`, `cake_size`, `quantity`, `flavor`, `filling`, `frosting`, `occasion`, `theme_design`, `preferred_colors`, `tiers`, `dedication`, `notes`, `estimated_price`, `inspo_images`) VALUES
(4, 132, '8 inches', 2, 'Vanilla', 'Buttercream', 'Whipped Cream', 'Birthday', 'Ocean', 'Blue', '8 inches', 'Happy Birthday', '{\"customer_name\":\"Test Customized Order\",\"email\":\"test@example.com\",\"phone\":\"09999999999\",\"delivery_method\":\"Pickup\",\"delivery_address\":\"Test Address\",\"pickup_date\":\"2026-07-10\",\"pickup_time\":\"14:00\",\"cake_size\":\"8 inches\",\"servings\":\"10\",\"cake_flavor\":\"Vanilla\",\"filling_flavor\":\"Buttercream\",\"frosting_type\":\"Whipped Cream\",\"occasion\":\"Birthday\",\"theme\":\"Ocean\",\"cake_color\":\"Blue\",\"custom_message\":\"Happy Birthday\",\"special_instructions\":\"No nuts\",\"addons\":[\"Candles\"],\"estimated_price\":\"1500\",\"quantity\":2,\"total_amount\":\"3000\",\"details\":\"Test request\"}', 1500.00, '[]'),
(5, 133, '6 inches', 1, 'Chocolate', 'Chocolate Ganache', 'Buttercream', 'Birthday', 'Barbie', 'Pink', '6 inches', 'Happy Birthday', '{\"customer_name\":\"Karyl Hernandez\",\"email\":\"hernandezkaryl78@gmail.com\",\"phone\":\"09994840687\",\"delivery_method\":\"Pickup\",\"delivery_address\":\"\",\"pickup_date\":\"2026-07-31\",\"pickup_time\":\"11:30\",\"cake_size\":\"6 inches\",\"servings\":\"1\",\"cake_flavor\":\"Chocolate\",\"filling_flavor\":\"Chocolate Ganache\",\"frosting_type\":\"Buttercream\",\"occasion\":\"Birthday\",\"theme\":\"Barbie\",\"cake_color\":\"Pink\",\"custom_message\":\"Happy Birthday\",\"special_instructions\":\"N\\/A\",\"addons\":[\"Candles\"],\"estimated_price\":\"2000\",\"quantity\":1,\"total_amount\":\"2000\",\"details\":\"\"}', 2000.00, '[]');

-- --------------------------------------------------------

--
-- Table structure for table `daily_sales`
--

CREATE TABLE `daily_sales` (
  `sale_date` date NOT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `daily_sales`
--

INSERT INTO `daily_sales` (`sale_date`, `total`) VALUES
('2025-04-25', 640.00),
('2025-04-28', 1050.00),
('2025-04-29', 780.00),
('2025-04-30', 920.00),
('2025-05-01', 530.00),
('2025-05-02', 660.00),
('2025-05-03', 700.00),
('2025-05-04', 735.00);

-- --------------------------------------------------------

--
-- Table structure for table `demand_forecasts`
--

CREATE TABLE `demand_forecasts` (
  `id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `forecast_date` date NOT NULL,
  `predicted_units` decimal(10,2) NOT NULL,
  `lower_bound` decimal(10,2) DEFAULT 0.00,
  `upper_bound` decimal(10,2) DEFAULT 0.00,
  `model_type` varchar(50) NOT NULL DEFAULT 'rule_regression',
  `generated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `discard_requests`
--

CREATE TABLE `discard_requests` (
  `id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `ingredient_batch_id` int(11) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `reason` varchar(50) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `requested_by` int(11) DEFAULT NULL,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_by` int(11) DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `discarded_at` datetime DEFAULT NULL,
  `rejection_note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `favorites`
--

CREATE TABLE `favorites` (
  `favorite_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `favorites`
--

INSERT INTO `favorites` (`favorite_id`, `customer_id`, `product_id`, `created_at`) VALUES
(2, 8, 32, '2026-06-24 16:38:00'),
(3, 8, 18, '2026-06-24 16:38:01');

-- --------------------------------------------------------

--
-- Table structure for table `ingredients`
--

CREATE TABLE `ingredients` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock` decimal(10,3) NOT NULL DEFAULT 0.000,
  `threshold` decimal(10,3) NOT NULL DEFAULT 0.000,
  `expiry` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ingredients`
--

INSERT INTO `ingredients` (`id`, `name`, `unit`, `unit_cost`, `stock`, `threshold`, `expiry`, `created_at`, `updated_at`) VALUES
(1, 'All-purpose Flour', 'kg', 0.00, 35.000, 5.000, '2025-08-30', '2026-05-03 10:53:37', '2026-08-25 13:16:25'),
(2, 'Butter', 'kg', 0.00, 8.000, 2.000, '2025-05-15', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(3, 'Sugar', 'kg', 0.00, 20.000, 4.000, '2026-01-01', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(4, 'Eggs', 'pcs', 0.00, 120.000, 24.000, '2025-05-10', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(5, 'Fresh Cream', 'L', 0.00, 6.000, 2.000, '2025-05-08', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(6, 'Chocolate', 'kg', 0.00, 4.000, 1.000, '2025-12-31', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(7, 'Strawberries', 'kg', 0.00, 2.000, 1.000, '2025-05-06', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(8, 'Blueberries', 'kg', 0.00, 1.500, 0.500, '2025-05-07', '2026-05-03 10:53:37', '2026-05-03 10:53:37'),
(9, 'Carrot Topper', '0', 0.00, 45.000, 6.000, '0000-00-00', '2026-07-07 12:45:29', '2026-07-07 12:45:29'),
(19, '[DEV] All-Purpose Flour', 'kg', 0.00, 21.000, 5.000, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(20, '[DEV] Sugar', 'kg', 0.00, 9.000, 2.000, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(21, '[DEV] Butter', 'kg', 0.00, 4.500, 1.000, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(22, '[DEV] Eggs', 'pcs', 0.00, 50.000, 10.000, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(23, '[DEV] Cocoa Powder', 'kg', 0.00, 1.800, 0.500, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48');

-- --------------------------------------------------------

--
-- Table structure for table `ingredient_batches`
--

CREATE TABLE `ingredient_batches` (
  `id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `quantity_received` decimal(10,3) NOT NULL,
  `quantity_remaining` decimal(10,3) NOT NULL,
  `purchase_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `supplier` varchar(150) DEFAULT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ingredient_batches`
--

INSERT INTO `ingredient_batches` (`id`, `ingredient_id`, `batch_number`, `quantity_received`, `quantity_remaining`, `purchase_date`, `expiry_date`, `supplier`, `unit_cost`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'LEGACY-1', 35.000, 35.000, NULL, '2025-08-30', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:16:25'),
(2, 2, 'LEGACY-2', 8.000, 8.000, NULL, '2025-05-15', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(3, 3, 'LEGACY-3', 20.000, 20.000, NULL, '2026-01-01', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(4, 4, 'LEGACY-4', 120.000, 120.000, NULL, '2025-05-10', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(5, 5, 'LEGACY-5', 6.000, 6.000, NULL, '2025-05-08', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(6, 6, 'LEGACY-6', 4.000, 4.000, NULL, '2025-12-31', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(7, 7, 'LEGACY-7', 2.000, 2.000, NULL, '2025-05-06', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(8, 8, 'LEGACY-8', 1.500, 1.500, NULL, '2025-05-07', NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(9, 9, 'LEGACY-9', 45.000, 45.000, NULL, NULL, NULL, 0.00, 'Migrated from ingredient-level inventory', NULL, '2026-08-25 13:11:18', '2026-08-25 13:11:18'),
(10, 19, 'DEV-BATCH-FLOUR-001', 5.000, 1.000, NULL, '2026-09-05', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(11, 19, 'DEV-BATCH-FLOUR-002', 10.000, 10.000, NULL, '2026-09-15', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:29:07'),
(12, 19, 'DEV-BATCH-FLOUR-003', 10.000, 10.000, NULL, '2026-08-30', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(13, 20, 'DEV-BATCH-SUGAR-001', 5.000, 4.000, NULL, '2026-09-10', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(14, 20, 'DEV-BATCH-SUGAR-002', 5.000, 5.000, NULL, '2026-09-20', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(15, 21, 'DEV-BATCH-BUTTER-001', 3.000, 2.500, NULL, '2026-09-10', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(16, 21, 'DEV-BATCH-BUTTER-002', 2.000, 2.000, NULL, '2026-09-20', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(17, 22, 'DEV-BATCH-EGGS-001', 30.000, 30.000, NULL, '2026-09-07', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(18, 22, 'DEV-BATCH-EGGS-002', 20.000, 20.000, NULL, '2026-09-14', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33'),
(19, 23, 'DEV-BATCH-COCOA-001', 1.500, 1.300, NULL, '2026-09-30', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:31:48'),
(20, 23, 'DEV-BATCH-COCOA-002', 0.500, 0.500, NULL, '2026-10-30', NULL, 0.00, NULL, NULL, '2026-08-31 15:20:33', '2026-08-31 15:20:33');

-- --------------------------------------------------------

--
-- Table structure for table `ingredient_movements`
--

CREATE TABLE `ingredient_movements` (
  `id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `action` enum('stock_in','stock_out') NOT NULL,
  `qty` decimal(10,3) NOT NULL,
  `note` text DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reference_type` varchar(40) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `previous_stock` decimal(10,3) DEFAULT NULL,
  `new_stock` decimal(10,3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ingredient_movements`
--

INSERT INTO `ingredient_movements` (`id`, `ingredient_id`, `batch_id`, `action`, `qty`, `note`, `user_id`, `created_at`, `reference_type`, `reference_id`, `previous_stock`, `new_stock`) VALUES
(1, 1, NULL, 'stock_in', 10.000, '', NULL, '2026-07-07 12:30:23', NULL, NULL, NULL, NULL),
(50, 19, 10, 'stock_out', 2.000, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 27, 25.000, 23.000),
(51, 20, 13, 'stock_out', 0.500, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 27, 10.000, 9.500),
(52, 21, 15, 'stock_out', 0.250, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 27, 5.000, 4.750),
(53, 23, 19, 'stock_out', 0.100, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 27, 2.000, 1.900),
(54, 19, 10, 'stock_out', 2.000, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 28, 23.000, 21.000),
(55, 20, 13, 'stock_out', 0.500, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 28, 9.500, 9.000),
(56, 21, 15, 'stock_out', 0.250, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 28, 4.750, 4.500),
(57, 23, 19, 'stock_out', 0.100, 'Produced 1 unit(s)', 999, '2026-08-31 15:31:48', 'production', 28, 1.900, 1.800);

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `sender` enum('customer','staff','ai','admin') NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `order_id`, `sender`, `message`, `is_read`, `created_at`, `user_id`, `updated_at`) VALUES
(1, 52, 'customer', 'Hi! I have a question about my order.', 1, '2026-05-14 05:34:42', NULL, '2026-08-25 06:03:04'),
(2, 52, 'customer', 'hi', 1, '2026-05-14 05:34:50', NULL, '2026-08-25 06:03:04'),
(3, 52, 'customer', 'where is my order now?', 1, '2026-05-14 05:35:56', NULL, '2026-08-25 06:03:04'),
(4, 52, 'staff', 'wait sir on the way', 0, '2026-05-14 05:51:10', NULL, '2026-08-25 06:03:04'),
(5, 78, 'customer', 'Hi! I have a question about my order.', 1, '2026-05-15 21:13:00', NULL, '2026-08-25 06:03:04'),
(6, 78, 'customer', 'hello', 1, '2026-05-15 21:13:04', NULL, '2026-08-25 06:03:04'),
(7, 84, 'customer', 'Hi! I have a question about my order.', 1, '2026-05-16 01:17:58', NULL, '2026-08-25 06:03:04'),
(8, 84, 'customer', 'may problema ako', 1, '2026-05-16 01:18:04', NULL, '2026-08-25 06:03:04'),
(9, 89, 'customer', 'Hi! I have a question about my order.', 1, '2026-05-20 13:54:37', NULL, '2026-08-25 06:03:04'),
(10, 89, 'customer', 'hello', 1, '2026-05-20 13:54:41', NULL, '2026-08-25 06:03:04'),
(11, 115, 'customer', 'Hi! I have a question about my order.', 1, '2026-06-17 08:35:47', NULL, '2026-08-25 06:03:04'),
(12, 115, 'customer', 'hello', 1, '2026-06-17 08:35:50', NULL, '2026-08-25 06:03:04'),
(13, 105, 'customer', 'Hi! I have a question about my order.', 1, '2026-06-24 07:28:55', NULL, '2026-08-25 06:03:04'),
(14, 105, 'customer', 'hi', 1, '2026-06-24 07:28:58', NULL, '2026-08-25 06:03:04'),
(15, 105, 'staff', 'hi po', 0, '2026-06-24 07:29:20', NULL, '2026-08-25 06:03:04'),
(16, 133, 'customer', 'Hi! I have a question about my order.', 1, '2026-07-01 08:03:06', NULL, '2026-08-25 06:03:04'),
(17, 1, 'customer', 'Product Inquiry', 1, '2026-07-01 10:27:41', NULL, '2026-08-25 06:03:04'),
(18, 1, 'customer', 'good afternoon', 1, '2026-07-01 10:27:51', NULL, '2026-08-25 06:03:04'),
(19, 1, 'staff', 'hi', 0, '2026-07-01 10:29:22', NULL, '2026-08-25 06:03:04');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `type` enum('Info','Warning','Alert','Success') NOT NULL DEFAULT 'Info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `action_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `action_url`, `created_at`) VALUES
(1, 3, '🧾 Order Placed', 'Your order #1016 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 02:13:41'),
(2, 3, '🧾 Order Placed', 'Your order #1017 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 02:26:10'),
(3, 3, '🧾 Order Placed', 'Your order #1018 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 02:29:05'),
(4, 3, '🧾 Order Placed', 'Your order #1019 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 12:02:35'),
(5, 3, '🧾 Order Placed', 'Your order #1020 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 12:11:16'),
(6, 3, '🧾 Order Placed', 'Your order #1021 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 12:39:11'),
(7, 3, '🧾 Order Placed', 'Your order #1022 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 12:50:40'),
(8, 3, '🧾 Order Placed', 'Your order #1023 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 13:39:58'),
(9, 3, '🧾 Order Placed', 'Your order #1024 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-04 15:52:50'),
(10, 3, '🧾 Order Placed', 'Your order #1025 has been placed successfully and is now pending.', 'Success', 0, 'orders.php', '2026-05-05 03:39:23'),
(11, 8, 'Order Confirmed', 'Your order has been confirmed and is being prepared', '', 1, '/customer/orders', '2026-07-01 09:02:19');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`items`)),
  `subtotal` decimal(10,2) NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `method` varchar(50) NOT NULL,
  `delivery_date` date DEFAULT NULL,
  `delivery_time` time DEFAULT NULL,
  `payment` varchar(50) NOT NULL,
  `address` text NOT NULL,
  `phone` varchar(20) NOT NULL,
  `lat` decimal(10,7) DEFAULT NULL,
  `lng` decimal(10,7) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  `payment_status` varchar(50) DEFAULT 'pending',
  `payment_link` text DEFAULT NULL,
  `payment_reference` varchar(255) DEFAULT NULL,
  `customer` varchar(255) DEFAULT '',
  `email` varchar(255) DEFAULT '',
  `user_id` int(11) DEFAULT NULL,
  `address_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `items`, `subtotal`, `delivery_fee`, `total`, `method`, `delivery_date`, `delivery_time`, `payment`, `address`, `phone`, `lat`, `lng`, `created_at`, `status`, `payment_status`, `payment_link`, `payment_reference`, `customer`, `email`, `user_id`, `address_id`) VALUES
(1, '[{\"id\":1778352456149,\"name\":\"Chocolate S\\u2019mores Cake\",\"category\":\"Cakes\",\"price\":100,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"cake2.png\",\"description\":\"\",\"available\":1,\"created_at\":\"2026-05-03 19:12:22\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"100.00\",\"small_price\":\"450.00\",\"big_price\":\"790.00\",\"meal_price\":\"0.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"SLICE\",\"qty\":1}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', '12121', '09123456789', NULL, NULL, '2026-05-09 18:47:45', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(2, '[]', 0.00, 0.00, 0.00, 'Pickup', NULL, NULL, 'Gcash', '168 maravilla', '09123456789', NULL, NULL, '2026-05-09 18:56:08', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(3, '[]', 0.00, 45.00, 45.00, 'Deliver', NULL, NULL, 'COD', 'sdffd', 'dfddf', NULL, NULL, '2026-05-09 18:59:24', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(4, '[{\"id\":1778353569518,\"name\":\"Chocolate S\\u2019mores Cake\",\"category\":\"Cakes\",\"price\":100,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"cake2.png\",\"description\":\"\",\"available\":1,\"created_at\":\"2026-05-03 19:12:22\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"100.00\",\"small_price\":\"450.00\",\"big_price\":\"790.00\",\"meal_price\":\"0.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"SLICE\",\"qty\":1}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', '123', '09123456789', NULL, NULL, '2026-05-09 19:06:25', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(5, '[{\"id\":1778353744053,\"name\":\"Chocolate S\\u2019mores Cake\",\"category\":\"Cakes\",\"price\":100,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"cake2.png\",\"description\":\"\",\"available\":1,\"created_at\":\"2026-05-03 19:12:22\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"100.00\",\"small_price\":\"450.00\",\"big_price\":\"790.00\",\"meal_price\":\"0.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"SLICE\",\"qty\":2}]', 200.00, 45.00, 245.00, 'Deliver', NULL, NULL, 'COD', 'dfdfd', 'dfdfdf', NULL, NULL, '2026-05-09 19:09:17', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(6, '[{\"id\":1778354918528,\"name\":\"Tinapa Pasta\",\"category\":\"Pasta\",\"price\":165,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"tinapa_pasta.png\",\"description\":null,\"available\":1,\"created_at\":\"2026-05-08 22:53:57\",\"updated_at\":\"2026-05-09 12:39:15\",\"slice_price\":\"0.00\",\"small_price\":\"0.00\",\"big_price\":\"0.00\",\"meal_price\":\"165.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"MEAL\",\"basePrice\":165,\"qty\":2,\"selectionDetails\":{\"drink\":\"Iced Tea\",\"cake\":null,\"extras\":[]}},{\"id\":1778354909776,\"name\":\"Chocolate S\\u2019mores Cake\",\"category\":\"Cakes\",\"price\":100,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"cake2.png\",\"description\":\"\",\"available\":1,\"created_at\":\"2026-05-03 19:12:22\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"100.00\",\"small_price\":\"450.00\",\"big_price\":\"790.00\",\"meal_price\":\"0.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"SLICE\",\"qty\":1}]', 445.00, 45.00, 490.00, 'Deliver', NULL, NULL, 'COD', '168', '09123456789', NULL, NULL, '2026-05-09 19:29:02', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(7, '[{\"id\":1778354963176,\"name\":\"Strawberry Pistachio Cake\",\"category\":\"Cakes\",\"price\":110,\"solo_price\":null,\"sharing_price\":null,\"stock\":10,\"image\":\"cake8.png\",\"description\":\"\",\"available\":1,\"created_at\":\"2026-05-03 19:12:22\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"110.00\",\"small_price\":\"510.00\",\"big_price\":\"920.00\",\"meal_price\":\"0.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"SLICE\",\"qty\":1}]', 110.00, 0.00, 110.00, 'Pickup', NULL, NULL, 'COD', '168', '09123456789', NULL, NULL, '2026-05-09 19:29:31', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(8, '[{\"id\":1778355160882,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":209,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"REGULAR\",\"basePrice\":199,\"qty\":1,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[{\"name\":\"Extra Sauce\",\"price\":10}]}}]', 209.00, 0.00, 209.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-09 19:32:54', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(9, '[{\"id\":1778384726931,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":344,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"COMBO\",\"basePrice\":309,\"qty\":1,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":\"Chocolate Oreo Cake\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}},{\"id\":1778384718043,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":209,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"REGULAR\",\"basePrice\":199,\"qty\":1,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[{\"name\":\"Extra Sauce\",\"price\":10}]}}]', 553.00, 45.00, 598.00, 'Deliver', NULL, NULL, 'COD', '168', '09123456789', NULL, NULL, '2026-05-10 03:47:17', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(10, '[{\"id\":1778385084447,\"name\":\"Tinapa Pasta\",\"category\":\"Pasta\",\"price\":180,\"solo_price\":null,\"sharing_price\":null,\"stock\":0,\"image\":\"tinapa_pasta.png\",\"description\":null,\"available\":1,\"created_at\":\"2026-05-08 22:53:57\",\"updated_at\":\"2026-05-09 12:39:15\",\"slice_price\":\"0.00\",\"small_price\":\"0.00\",\"big_price\":\"0.00\",\"meal_price\":\"165.00\",\"combo_price\":\"0.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"MEAL\",\"basePrice\":165,\"qty\":1,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":null,\"extras\":[{\"name\":\"Garlic Bread\",\"price\":15}]}}]', 180.00, 0.00, 180.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 03:51:42', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(11, '[{\"id\":1778385297118,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":254,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"MEAL\",\"basePrice\":219,\"qty\":1,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":null,\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 254.00, 0.00, 254.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 03:55:11', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(12, '[{\"id\":1778385436296,\"name\":\"Tempura\",\"category\":\"Meals\",\"price\":309,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal4.png\",\"description\":\"Crispy shrimp tempura\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"COMBO\",\"basePrice\":309,\"qty\":1,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":\"Chocolate Oreo Cake\",\"extras\":[]}}]', 309.00, 45.00, 354.00, 'Deliver', NULL, NULL, 'COD', '123', '09123456789', NULL, NULL, '2026-05-10 03:58:41', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(13, '[{\"id\":1778386017929,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":219,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"MEAL\",\"basePrice\":219,\"qty\":1,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":null,\"extras\":[]}}]', 219.00, 45.00, 264.00, 'Deliver', NULL, NULL, 'COD', '123', '09123456789', NULL, NULL, '2026-05-10 04:07:45', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(14, '[{\"id\":1778386238665,\"name\":\"Tempura\",\"category\":\"Meals\",\"price\":309,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal4.png\",\"description\":\"Crispy shrimp tempura\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"COMBO\",\"basePrice\":309,\"qty\":1,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":\"Chocolate Ganache Cake\",\"extras\":[]}}]', 309.00, 45.00, 354.00, 'Deliver', NULL, NULL, 'COD', 'yes', '09123456789', NULL, NULL, '2026-05-10 04:11:23', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(15, '[{\"id\":1778386700973,\"name\":\"Pork Barbecue\",\"category\":\"Meals\",\"price\":344,\"solo_price\":null,\"sharing_price\":null,\"stock\":100,\"image\":\"meal5.png\",\"description\":\"Grilled pork barbecue skewers\",\"available\":1,\"created_at\":\"2026-05-03 21:28:16\",\"updated_at\":\"2026-05-08 17:24:55\",\"slice_price\":\"199.00\",\"small_price\":\"219.00\",\"big_price\":\"309.00\",\"meal_price\":\"219.00\",\"combo_price\":\"309.00\",\"tag\":null,\"is_custom\":0,\"reorder_level\":5,\"variant\":\"COMBO\",\"basePrice\":309,\"qty\":1,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":\"Chocolate Ganache Cake\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 344.00, 0.00, 344.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 04:18:44', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(16, '[{\"name\":\"Tempura\",\"qty\":1,\"price\":254,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":null,\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}},{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 1044.00, 0.00, 1044.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 04:25:04', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(17, '[{\"name\":\"Pork Barbecue\",\"qty\":1,\"price\":254,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":null,\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 254.00, 0.00, 254.00, 'Pickup', NULL, NULL, 'COD', '', '09195808745', NULL, NULL, '2026-05-10 04:28:15', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(18, '[{\"name\":\"Pork Barbecue\",\"qty\":1,\"price\":309,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":\"Chocolate Ganache Cake\",\"extras\":[]}}]', 309.00, 0.00, 309.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 04:37:07', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(19, '[{\"name\":\"Pork Barbecue\",\"qty\":1,\"price\":344,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":\"Tiramisu\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 344.00, 45.00, 389.00, 'Deliver', NULL, NULL, 'COD', '123mara', '09123456789', NULL, NULL, '2026-05-10 04:45:24', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(20, '[{\"name\":\"Chicken Pasta\",\"qty\":1,\"price\":140,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]}}]', 140.00, 0.00, 140.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-05-10 04:55:18', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(21, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]},{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 210.00, 0.00, 210.00, 'Pickup', NULL, NULL, 'COD', '', 'ok', NULL, NULL, '2026-05-10 05:05:20', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(22, '[{\"name\":\"Chicken Fillet\",\"qty\":1,\"price\":309,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":\"Tiramisu\",\"extras\":[]}},{\"name\":\"Strawberry Pistachio Cake\",\"qty\":1,\"price\":510,\"selectionDetails\":[]}]', 819.00, 45.00, 864.00, 'Deliver', NULL, NULL, 'COD', 'yes po', 'number', NULL, NULL, '2026-05-10 05:14:46', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(23, '[{\"name\":\"Tempura\",\"qty\":1,\"price\":344,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":\"Tiramisu\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 344.00, 0.00, 344.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 05:29:48', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(24, '[{\"name\":\"Strawberry Pistachio Cake\",\"qty\":2,\"price\":110,\"selectionDetails\":[]}]', 220.00, 0.00, 220.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 05:30:29', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(25, '[{\"name\":\"Strawberry Pistachio Cake\",\"qty\":1,\"price\":110,\"selectionDetails\":[]}]', 110.00, 0.00, 110.00, 'Pickup', NULL, NULL, 'COD', '', '0919234567', 0.0000000, 0.0000000, '2026-05-10 05:42:15', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(26, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', '', '090909909909', 0.0000000, 0.0000000, '2026-05-10 05:52:19', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(27, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 0.00, 880.00, 'Pickup', NULL, NULL, 'COD', '', '09195808745', 0.0000000, 0.0000000, '2026-05-10 06:08:42', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(28, '[{\"name\":\"Tinapa Pasta\",\"qty\":1,\"price\":165,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":null,\"extras\":[]}}]', 165.00, 0.00, 165.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 06:12:49', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(29, '[{\"name\":\"Pork Barbecue\",\"qty\":1,\"price\":344,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":\"Chocolate Ganache Cake\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 344.00, 45.00, 389.00, 'Deliver', NULL, NULL, 'COD', '123', '09102345678', 0.0000000, 0.0000000, '2026-05-10 06:13:51', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(30, '[{\"name\":\"Custom Cake - Ube Flan Cake\",\"qty\":1,\"price\":500,\"selectionDetails\":[]},{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 1380.00, 45.00, 1425.00, 'Deliver', NULL, NULL, 'COD', '168', '09123456789', 13.9555589, 121.1121655, '2026-05-10 07:32:47', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(31, '[{\"name\":\"Tinapa Pasta\",\"qty\":1,\"price\":165,\"selectionDetails\":{\"drink\":\"Blue Lemonade\",\"cake\":null,\"extras\":[]}},{\"name\":\"Lumpiang Shanghai\",\"qty\":1,\"price\":354,\"selectionDetails\":{\"drink\":\"Cucumber\",\"cake\":\"Carrot Cake\",\"extras\":[{\"name\":\"Extra Rice\",\"price\":35},{\"name\":\"Extra Sauce\",\"price\":10}]}},{\"name\":\"Custom Cake - Strawberry Pistachio Cake\",\"qty\":1,\"price\":1500,\"selectionDetails\":[]},{\"name\":\"Carrot Cake\",\"qty\":1,\"price\":950,\"selectionDetails\":[]}]', 2969.00, 45.00, 3014.00, 'Deliver', NULL, NULL, 'COD', '168 matasnakahoy', '09123456789', 13.9558088, 121.1116076, '2026-05-10 07:38:07', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(32, '[{\"name\":\"Tinapa Pasta\",\"qty\":1,\"price\":155,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[{\"name\":\"Garlic Bread\",\"price\":15}]}},{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 260.00, 0.00, 260.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 12:10:58', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(33, '[{\"name\":\"Custom Cake - Chocolate Oreo Cake\",\"qty\":1,\"price\":500,\"selectionDetails\":[]}]', 500.00, 0.00, 500.00, 'Pickup', NULL, NULL, 'COD', '', '09192323443', 0.0000000, 0.0000000, '2026-05-10 12:12:17', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(34, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 12:33:50', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(35, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', 0.0000000, 0.0000000, '2026-05-10 12:37:21', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(36, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', '', '8778799908', 0.0000000, 0.0000000, '2026-05-10 12:42:16', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(37, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', '', '980y86786987', 0.0000000, 0.0000000, '2026-05-10 12:43:17', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(38, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', '', '8767979897', 0.0000000, 0.0000000, '2026-05-10 12:46:18', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(39, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":450,\"selectionDetails\":[]},{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":450,\"selectionDetails\":[]}]', 900.00, 45.00, 945.00, 'Deliver', NULL, NULL, 'COD', 'Trapiche 1, Tanauan City, Batangas', '09994840687', 13.7630623, 121.0531998, '2026-05-12 14:49:19', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(40, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'COD', 'Batangas CIty', '09123456890', 0.0000000, 0.0000000, '2026-05-12 15:50:42', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(41, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":3,\"price\":490,\"selectionDetails\":[]}]', 1470.00, 45.00, 1515.00, 'Deliver', NULL, NULL, 'COD', 'Namuco, Itlugan, Rosario, Batangas, Calabarzon, 4225, Philippines', '09994840687', 13.8354131, 121.2025452, '2026-05-13 06:16:15', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(42, '[{\"name\":\"Tiramisu\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'Dalig, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7670639, 121.0851288, '2026-05-13 18:38:11', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(43, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":30,\"selectionDetails\":[]}]', 30.00, 45.00, 75.00, 'Deliver', NULL, NULL, 'COD', 'Pallocan East, Sampaga Kanluran, Dalig, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7573933, 121.0885620, '2026-05-13 18:46:52', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(44, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-13 18:47:26', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(45, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'COD', 'Batangas City National Road, Buklod Unlad I, Sampaga Kanluran, Dumantay, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7647296, 121.1170578, '2026-05-13 18:52:15', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(46, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":3,\"price\":790,\"selectionDetails\":[]}]', 2370.00, 45.00, 2415.00, 'Deliver', NULL, NULL, 'COD', 'Kumintang Ibaba, Dalig, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7657300, 121.0713959, '2026-05-13 18:53:10', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(47, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'Guava Street, Greenwoods Subdivision, Pallocan East, Sampaga Kanluran, Sampaga, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7523912, 121.0847855, '2026-05-13 19:08:21', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(48, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'San Pedro Proper, Pulo, San Pedro, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7750668, 121.1043549, '2026-05-13 19:13:18', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(49, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7565000, 121.0583000, '2026-05-13 19:15:03', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(50, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7565000, 121.0583000, '2026-05-13 19:16:51', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(51, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]},{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]},{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 305.00, 45.00, 350.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '639956453609', 13.7565000, 121.0583000, '2026-05-13 19:17:01', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(52, '[{\"name\":\"Custom Cake - Test Update\",\"qty\":1,\"price\":500,\"selectionDetails\":[]}]', 500.00, 45.00, 545.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-14 04:38:20', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(53, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'San Pedro Proper, Pulo, San Pedro, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7777343, 121.1012650, '2026-05-14 04:52:23', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(54, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-14 04:55:14', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(55, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-14 04:57:42', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(56, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-14 04:59:04', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(57, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":3,\"price\":880,\"selectionDetails\":[]}]', 2640.00, 45.00, 2685.00, 'Deliver', NULL, NULL, 'COD', 'Greenwoods Subdivision, Pallocan East, Sampaga Kanluran, Sirang Lupa, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7500568, 121.0834122, '2026-05-14 05:02:06', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(58, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'COD', 'Anthurium Street, Gulod Itaas, Sampaga Kanluran, Dalig, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7650631, 121.0851288, '2026-05-14 05:16:45', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(59, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":8,\"price\":100,\"selectionDetails\":[]}]', 800.00, 45.00, 845.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09956453609', 13.7565000, 121.0583000, '2026-05-14 18:11:38', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(60, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":5,\"price\":100,\"selectionDetails\":[]}]', 500.00, 45.00, 545.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 11:00:37', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(61, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:03:49', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(62, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:06:05', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(63, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":3,\"price\":105,\"selectionDetails\":[]}]', 315.00, 45.00, 360.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:09:43', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(64, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":3,\"price\":105,\"selectionDetails\":[]}]', 315.00, 45.00, 360.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:14:02', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(65, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":3,\"price\":105,\"selectionDetails\":[]}]', 315.00, 45.00, 360.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:14:09', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(66, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:22:36', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(67, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:30:40', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(68, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:33:17', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(69, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:34:17', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(70, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:35:46', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(71, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:36:08', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(72, '[{\"name\":\"Test Update\",\"qty\":1,\"price\":10,\"selectionDetails\":[]}]', 10.00, 45.00, 55.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-05-15 12:39:42', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(73, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-15 14:46:59', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(74, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]},{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 985.00, 45.00, 1030.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09979517755', 13.7565000, 121.0583000, '2026-05-15 14:48:53', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(75, '[{\"name\":\"Strawberry Pistachio Cake\",\"qty\":1,\"price\":110,\"selectionDetails\":[]}]', 110.00, 0.00, 110.00, 'Pickup', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09267077217', 13.7565000, 121.0583000, '2026-05-15 14:53:46', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(76, '[{\"name\":\"Strawberry Pistachio Cake\",\"qty\":1,\"price\":110,\"selectionDetails\":[]}]', 110.00, 45.00, 155.00, 'Deliver', NULL, NULL, 'COD', 'District I, Upa, Mataasnakahoy, Batangas, Calabarzon, 4223, Philippines', '09267077217', 13.9547259, 121.1064122, '2026-05-15 14:54:59', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(77, '[{\"name\":\"Strawberry Pistachio Cake\",\"qty\":1,\"price\":110,\"selectionDetails\":[]}]', 110.00, 0.00, 110.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09267077217', 13.7565000, 121.0583000, '2026-05-15 14:55:46', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(78, '[{\"name\":\"Custom Cake - Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":1500,\"selectionDetails\":[]}]', 1500.00, 0.00, 1500.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-15 15:44:23', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(79, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":2,\"price\":790,\"selectionDetails\":[]}]', 1580.00, 45.00, 1625.00, 'Deliver', NULL, NULL, 'COD', 'Ingco Street, Poblacion 3, Aplaya, Bauan, Batangas, Calabarzon, 4201, Philippines', '09509002527', 13.7867371, 121.0068267, '2026-05-15 23:51:17', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(80, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 0.00, 880.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-15 23:53:39', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(81, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', '13.756500, 121.058300', '09509002527', 13.7565000, 121.0583000, '2026-05-16 00:54:33', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(82, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 0.00, 789.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-16 01:08:35', 'To Receive', 'pending', NULL, NULL, '', '', NULL, NULL),
(83, '[{\"product_id\":10,\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-16 01:09:36', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(84, '[{\"product_id\":10,\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":790,\"selectionDetails\":[]}]', 790.00, 45.00, 835.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-16 01:11:29', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(85, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 01:43:17', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(86, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 01:43:46', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(87, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'COD', 'Pallocan East, Sampaga Kanluran, Sirang Lupa, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7520577, 121.0837676, '2026-05-16 01:44:56', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(88, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'COD', 'Gulod Itaas, Dalig, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7640627, 121.0786153, '2026-05-16 01:51:09', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(89, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'COD', '91, Gulod Labac, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7587272, 121.0700226, '2026-05-16 02:39:39', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(90, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 0.00, 789.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 02:54:27', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(91, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 0.00, 789.00, 'Pickup', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 02:57:59', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(92, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 02:58:19', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(93, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 02:59:17', 'Cancelled', 'pending', NULL, NULL, '', '', NULL, NULL),
(94, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":789,\"selectionDetails\":[]}]', 789.00, 45.00, 834.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 03:00:25', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(95, '[{\"product_id\":9,\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09954121900', 13.7565000, 121.0583000, '2026-05-16 03:01:18', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(96, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-05-26 02:34:25', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(97, '[]', 0.00, 0.00, 0.00, 'Pickup', NULL, NULL, 'COD', 'Test', '09123456789', 0.0000000, 0.0000000, '2026-06-03 05:01:50', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(98, '[{\"name\":\"Beef Broccoli\",\"qty\":1,\"price\":234,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[{\"name\":\"Extra Rice\",\"price\":35}]}}]', 234.00, 0.00, 234.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 06:19:28', 'Completed', 'pending', NULL, NULL, '', '', NULL, NULL),
(99, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 06:29:43', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(100, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 06:35:34', 'Pending', 'pending', NULL, NULL, '', '', NULL, NULL),
(101, '[{\"name\":\"Tiramisu\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 07:01:41', 'Pending', 'pending', NULL, NULL, '', '', NULL, NULL),
(102, '[{\"price\":100,\"name\":\"Test Cake\",\"qty\":1}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'Test Address', '09171234567', 0.0000000, 0.0000000, '2026-06-17 07:48:06', 'Pending', 'pending', NULL, NULL, 'Jane Doe', 'jane@example.com', NULL, NULL),
(103, '[{\"price\":100,\"name\":\"Test Cake\",\"qty\":1}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'Test Address', '09171234567', 0.0000000, 0.0000000, '2026-06-17 07:48:12', 'Pending', 'pending', NULL, NULL, 'Jane Doe', 'jane@example.com', NULL, NULL),
(104, '[{\"name\":\"UI Test Cake\",\"qty\":1,\"price\":150}]', 150.00, 0.00, 150.00, 'Pickup', NULL, NULL, 'COD', 'UI Test Address', '09000000000', 0.0000000, 0.0000000, '2026-06-17 07:49:17', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', NULL, NULL),
(105, '[{\"name\":\"UI Auto Cake\",\"qty\":1,\"price\":120}]', 120.00, 0.00, 120.00, 'Pickup', NULL, NULL, 'COD', 'UI Auto Address', '09000000000', 0.0000000, 0.0000000, '2026-06-17 07:52:57', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', NULL, NULL),
(106, '[{\"name\":\"Test Cake\",\"qty\":1,\"price\":150}]', 150.00, 50.00, 200.00, 'Deliver', NULL, NULL, 'COD', '123 Test St', '09123456789', 13.7000000, 121.0000000, '2026-06-17 08:12:07', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 2, NULL),
(107, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09123456789', 13.7565000, 121.0583000, '2026-06-17 08:14:07', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(108, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 08:16:06', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(109, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":3,\"price\":100,\"selectionDetails\":[]}]', 300.00, 45.00, 345.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09123456789', 13.7565000, 121.0583000, '2026-06-17 08:20:15', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(110, '[{\"price\":100,\"selectionDetails\":[],\"name\":\"Test Item\",\"qty\":1}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'GCash', '123 Test St', '09123456789', 0.0000000, 0.0000000, '2026-06-17 08:20:35', 'Pending', 'pending', NULL, NULL, 'Test Customer', 'test@example.com', 2, NULL),
(111, '[{\"name\":\"Test\",\"qty\":1}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'GCash', '123 St', '09123456789', NULL, NULL, '2026-06-17 08:22:21', 'Pending', 'pending', NULL, NULL, 'Test', 'test@test.com', 2, NULL),
(112, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":3,\"price\":100,\"selectionDetails\":[]}]', 300.00, 45.00, 345.00, 'Deliver', NULL, NULL, 'GCash', '123 Test Street', '09123456789', 13.7565000, 121.0583000, '2026-06-17 08:24:26', 'Pending', 'pending', NULL, NULL, 'Test Customer', 'test@test.com', 2, NULL),
(113, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":3,\"price\":100,\"selectionDetails\":[]}]', 300.00, 45.00, 345.00, 'Deliver', NULL, NULL, 'GCash', '123 Test Street', '09123456789', 13.7565000, 121.0583000, '2026-06-17 08:28:18', 'Pending', 'pending', NULL, NULL, 'Test Customer', 'test@test.com', 2, NULL),
(114, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 08:34:15', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(115, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 0.00, 105.00, 'Pickup', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-17 08:34:39', 'Completed', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(116, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]},{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 205.00, 45.00, 250.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-19 10:09:26', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(117, '[{\"name\":\"Red Velvet Cake\",\"qty\":1,\"price\":105,\"selectionDetails\":[]}]', 105.00, 45.00, 150.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09509002527', 13.7565000, 121.0583000, '2026-06-19 10:26:33', 'Pending', 'pending', NULL, NULL, 'Customer', 'customer@pastry.com', 3, NULL),
(118, '[{\"name\":\"Test\",\"qty\":1,\"price\":100}]', 100.00, 0.00, 100.00, 'Pickup', NULL, NULL, 'COD', 'Test', '09123456789', 0.0000000, 0.0000000, '2026-06-24 06:52:15', 'Pending', 'pending', NULL, NULL, 'Tester', 'test@example.com', NULL, NULL);
INSERT INTO `orders` (`id`, `items`, `subtotal`, `delivery_fee`, `total`, `method`, `delivery_date`, `delivery_time`, `payment`, `address`, `phone`, `lat`, `lng`, `created_at`, `status`, `payment_status`, `payment_link`, `payment_reference`, `customer`, `email`, `user_id`, `address_id`) VALUES
(119, '[{\"name\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-06-24 07:03:21', 'Pending', 'pending', NULL, NULL, '', '', NULL, NULL),
(120, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":[]}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-06-24 07:04:26', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(121, '[{\"name\":\"Chocolate S\\u2019mores Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":[]}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-06-24 07:13:54', 'Completed', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL),
(122, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"\"}}]', 0.00, 0.00, 0.00, 'Pickup', NULL, NULL, 'COD', '', '09123456789', NULL, NULL, '2026-06-24 15:28:15', '', 'pending', NULL, NULL, 'Test User', '', NULL, NULL),
(123, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"\"}}]', 0.00, 0.00, 0.00, 'Pickup', NULL, NULL, 'COD', '', '09994840687', NULL, NULL, '2026-06-24 15:30:28', '', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', NULL, NULL),
(124, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":2,\"price\":105,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]}}]', 210.00, 45.00, 255.00, 'Deliver', NULL, NULL, 'GCash', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-06-24 15:36:36', 'Cancelled', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL),
(125, '[]', 0.00, 0.00, 0.00, '', NULL, NULL, '', '', '', 0.0000000, 0.0000000, '2026-06-24 16:39:16', 'Pending', 'pending', NULL, NULL, '', '', NULL, NULL),
(126, '[]', 0.00, 0.00, 0.00, '', NULL, NULL, '', '', '', 0.0000000, 0.0000000, '2026-06-24 16:39:21', 'Pending', 'pending', NULL, NULL, '', '', NULL, NULL),
(127, '[{\"name\":\"Chocolate Oreo Cake\",\"qty\":1,\"price\":880,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]}}]', 880.00, 45.00, 925.00, 'Deliver', NULL, NULL, 'COD', 'McDonald\'s, 12, P. Burgos Street, Barangay 9, Pallocan West, Tramo, Batangas City, Batangas, Calabarzon, 4200, Philippines', '09994840687', 13.7565000, 121.0583000, '2026-07-01 02:12:09', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(128, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"\"}}]', 0.00, 0.00, 0.00, 'Pickup', NULL, NULL, 'COD', '', '09994840687', NULL, NULL, '2026-07-01 02:59:16', '', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', NULL, NULL),
(129, '[]', 0.00, 0.00, 0.00, '', NULL, NULL, '', '', '', 0.0000000, 0.0000000, '2026-07-01 02:59:44', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(131, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"Test request\"}}]', 0.00, 0.00, 0.00, 'Pickup', '2026-07-10', '14:00:00', 'COD', 'Test Address', '09999999999', NULL, NULL, '2026-07-01 03:27:37', '', 'pending', NULL, NULL, 'Test Customized Order', 'test@example.com', NULL, NULL),
(132, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"Test request\"}}]', 0.00, 0.00, 0.00, 'Pickup', '2026-07-10', '14:00:00', 'COD', 'Test Address', '09999999999', NULL, NULL, '2026-07-01 03:28:07', '', 'pending', NULL, NULL, 'Test Customized Order', 'test@example.com', NULL, NULL),
(133, '[{\"name\":\"Custom Cake Request\",\"qty\":1,\"price\":0,\"selectionDetails\":{\"details\":\"\"}}]', 0.00, 0.00, 3500.00, 'Pickup', '2026-07-31', '11:30:00', 'COD', '', '09994840687', NULL, NULL, '2026-07-01 03:30:00', 'Completed', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL),
(134, '[]', 0.00, 0.00, 0.00, '', NULL, NULL, '', '', '', 0.0000000, 0.0000000, '2026-07-01 03:34:33', 'Preparing', 'pending', NULL, NULL, '', '', NULL, NULL),
(135, '[{\"name\":\"Chocolate Ganache Cake\",\"qty\":1,\"price\":100,\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]}}]', 100.00, 45.00, 145.00, 'Deliver', NULL, NULL, 'COD', 'Trapiche Road, Trapiche 1, Sambat, Tanauan, Hidalgo, Batangas, Calabarzon, 4232, Philippines', '09994840687', 14.0885680, 121.1414030, '2026-07-04 05:03:44', 'Preparing', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL),
(136, '[{\"name\":\"Cheesy Bacon Fries\",\"product\":\"Cheesy Bacon Fries\",\"qty\":2,\"price\":230,\"image\":\"cheesy.jpg\",\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]},\"variant\":\"SHARING\"}]', 460.00, 45.00, 605.00, 'Deliver', NULL, NULL, 'COD', 'Tanauan Institute, 3rd Street, Gloria Compound, Barangay 6, Tanauan, Poblacion, Batangas, Calabarzon, 4232, Philippines', '09994840687', 14.0894701, 121.1420492, '2026-07-10 07:33:05', 'Preparing', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL),
(137, '[{\"name\":\"Chocolate Caramel Cake\",\"product\":\"Chocolate Caramel Cake\",\"qty\":1,\"price\":105,\"image\":\"cake3.png\",\"selectionDetails\":{\"drink\":null,\"cake\":null,\"extras\":[]},\"variant\":\"SLICE\"}]', 105.00, 45.00, 150.00, 'Deliver', NULL, NULL, 'COD', 'Tanauan Institute, 3rd Street, Gloria Compound, Barangay 6, Tanauan, Poblacion, Batangas, Calabarzon, 4232, Philippines', '09994840687', 14.0894603, 121.1420335, '2026-07-10 07:45:15', 'Preparing', 'pending', NULL, NULL, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', 8, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product` varchar(150) NOT NULL,
  `variant` varchar(50) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `details` text DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product`, `variant`, `qty`, `price`, `details`, `image`, `product_id`) VALUES
(159, 136, 'Cheesy Bacon Fries', NULL, 2, 230.00, NULL, NULL, 113),
(160, 137, 'Chocolate Caramel Cake', NULL, 1, 105.00, NULL, NULL, 11);

-- --------------------------------------------------------

--
-- Table structure for table `order_items_orphan_archive`
--

CREATE TABLE `order_items_orphan_archive` (
  `id` int(11) NOT NULL DEFAULT 0,
  `order_id` int(11) DEFAULT NULL,
  `product` varchar(150) NOT NULL,
  `variant` varchar(50) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `details` text DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items_orphan_archive`
--

INSERT INTO `order_items_orphan_archive` (`id`, `order_id`, `product`, `variant`, `qty`, `price`, `details`, `image`, `product_id`) VALUES
(1, 1001, 'Chocolate Lava Cake', NULL, 1, 350.00, NULL, NULL, NULL),
(2, 1001, 'Blueberry Muffin', NULL, 1, 120.00, NULL, NULL, NULL),
(3, 1001, 'Croissant', NULL, 1, 95.00, NULL, NULL, NULL),
(4, 1002, 'Strawberry Tart', NULL, 2, 360.00, NULL, NULL, NULL),
(5, 1002, 'Macarons (6pcs)', NULL, 1, 320.00, NULL, NULL, NULL),
(6, 1003, 'Tiramisu Slice', NULL, 1, 280.00, NULL, NULL, NULL),
(7, 1004, 'Caramel Flan', NULL, 1, 200.00, NULL, NULL, NULL),
(8, 1004, 'Ube Pandesal', NULL, 3, 135.00, NULL, NULL, NULL),
(9, 1004, 'Croissant', NULL, 1, 95.00, NULL, NULL, NULL),
(10, 1005, 'Chocolate Lava Cake', NULL, 3, 1050.00, NULL, NULL, NULL),
(11, 1006, 'Macarons (6pcs)', NULL, 2, 640.00, NULL, NULL, NULL),
(12, 1007, 'Chocolate Ganache Cake', NULL, 3, 450.00, NULL, NULL, NULL),
(13, 1007, 'Chocolate S’mores Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(14, 1008, 'Chocolate Ganache Cake', NULL, 3, 790.00, NULL, NULL, NULL),
(15, 1009, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(16, 1010, 'Chocolate Ganache Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(17, 1011, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(18, 1011, 'Chocolate Oreo Cake', NULL, 3, 105.00, NULL, NULL, NULL),
(19, 1012, 'Strawberry Pistachio Cake', NULL, 2, 510.00, NULL, NULL, NULL),
(20, 1013, 'Strawberry Pistachio Cake', NULL, 2, 920.00, NULL, NULL, NULL),
(21, 1014, 'Chocolate Caramel Cake', NULL, 2, 880.00, NULL, NULL, NULL),
(22, 1015, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(23, 1016, 'Chocolate Ganache Cake', NULL, 3, 790.00, NULL, NULL, NULL),
(24, 1017, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(25, 1018, 'Strawberry Pistachio Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(26, 1018, 'Red Velvet Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(27, 1019, 'Chocolate S’mores Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(28, 1020, 'Chocolate Ganache Cake', NULL, 2, 100.00, NULL, NULL, NULL),
(29, 1021, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(30, 1021, 'Chicken Fillet', NULL, 1, 309.00, NULL, NULL, NULL),
(31, 1022, 'Chocolate Ganache Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(32, 1023, 'Chocolate S’mores Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(33, 1023, 'Chocolate Oreo Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(34, 1024, 'Chocolate S’mores Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(35, 1025, 'Chocolate Oreo Cake', NULL, 1, 105.00, NULL, NULL, NULL),
(36, 1026, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(37, 1027, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(38, 1027, 'Chocolate Oreo Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(39, 1028, 'Tiramisu', NULL, 1, 105.00, NULL, NULL, NULL),
(40, 1029, 'Chocolate Caramel Cake', NULL, 2, 105.00, NULL, NULL, NULL),
(41, 1030, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(42, 1031, 'Beef Broccoli', NULL, 1, 309.00, NULL, NULL, NULL),
(43, 1032, 'Chocolate Caramel Cake', NULL, 1, 105.00, NULL, NULL, NULL),
(44, 1033, 'Chocolate Oreo Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(45, 1034, 'Sansrival', NULL, 1, 950.00, NULL, NULL, NULL),
(46, 1034, 'Chocolate Mousse', NULL, 1, 1000.00, NULL, NULL, NULL),
(47, 1035, 'Tempura', NULL, 1, 199.00, NULL, NULL, NULL),
(48, 1035, 'Strawberry Pistachio Cake', NULL, 1, 510.00, NULL, NULL, NULL),
(49, 1035, 'Tempura', NULL, 1, 219.00, NULL, NULL, NULL),
(50, 1035, 'Sansrival', NULL, 1, 530.00, NULL, NULL, NULL),
(51, 1036, 'Chocolate Caramel Cake', NULL, 2, 880.00, NULL, NULL, NULL),
(52, 1036, 'Chocolate Caramel Cake', NULL, 3, 105.00, NULL, NULL, NULL),
(53, 1036, 'Choco Pistachio Dream', NULL, 1, 1750.00, NULL, NULL, NULL),
(54, 1036, 'Strawberry Pistachio Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(55, 1036, 'Chocolate S’mores Cake', NULL, 4, 790.00, NULL, NULL, NULL),
(56, 1036, 'Sansrival', NULL, 1, 950.00, NULL, NULL, NULL),
(57, 1036, 'Chocolate Caramel Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(58, 1037, 'Lumpiang Shanghai', NULL, 1, 219.00, NULL, NULL, NULL),
(59, 1038, 'Chocolate S’mores Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(60, 1039, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(61, 1039, 'Chocolate Caramel Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(62, 1040, 'Strawberry Pistachio Cake', NULL, 1, 510.00, NULL, NULL, NULL),
(63, 1041, 'Ube Flan Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(64, 1042, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(65, 1042, 'Chocolate Caramel Cake', NULL, 3, 880.00, NULL, NULL, NULL),
(66, 1042, 'Chocolate Caramel Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(67, 1042, 'Tiramisu', NULL, 1, 490.00, NULL, NULL, NULL),
(68, 1042, 'Red Velvet Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(69, 1042, 'Chocolate Caramel Cake', NULL, 2, 105.00, NULL, NULL, NULL),
(70, 1042, 'Carrot Cake', NULL, 2, 530.00, NULL, NULL, NULL),
(71, 1043, 'Choco Pistachio Dream', NULL, 1, 1750.00, NULL, NULL, NULL),
(72, 1043, 'Chocolate S’mores Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(73, 1043, 'Chocolate S’mores Cake', NULL, 2, 450.00, NULL, NULL, NULL),
(74, 1043, 'Chicken Fillet', NULL, 1, 219.00, NULL, NULL, NULL),
(75, 1044, 'Chocolate Caramel Cake', NULL, 2, 880.00, NULL, NULL, NULL),
(76, 1044, 'Beef Broccoli', NULL, 2, 199.00, NULL, NULL, NULL),
(77, 1045, 'Beef Broccoli', NULL, 1, 309.00, NULL, NULL, NULL),
(78, 1046, 'Chocolate Caramel Cake', NULL, 2, 490.00, NULL, NULL, NULL),
(79, 1046, 'Sansrival', NULL, 2, 950.00, NULL, NULL, NULL),
(80, 1046, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(81, 1046, 'Strawberry Pistachio Cake', NULL, 2, 510.00, NULL, NULL, NULL),
(82, 1046, 'Carrot Cake', NULL, 2, 950.00, NULL, NULL, NULL),
(83, 1046, 'Chocolate Oreo Cake', NULL, 2, 880.00, NULL, NULL, NULL),
(84, 1046, 'Chicken Teriyaki', NULL, 3, 199.00, NULL, NULL, NULL),
(85, 1046, 'Ube Flan Cake', NULL, 3, 920.00, NULL, NULL, NULL),
(86, 1046, 'Strawberry Pistachio Cake', NULL, 1, 110.00, NULL, NULL, NULL),
(87, 1046, 'Chocolate Caramel Cake', NULL, 2, 105.00, NULL, NULL, NULL),
(88, 1046, 'Chocolate S’mores Cake', NULL, 2, 790.00, NULL, NULL, NULL),
(89, 1046, 'Fish Fillet', NULL, 2, 309.00, NULL, NULL, NULL),
(90, 1046, 'Lumpiang Shanghai', NULL, 1, 309.00, NULL, NULL, NULL),
(91, 1046, 'Blueberry Cheesecake', NULL, 1, 700.00, NULL, NULL, NULL),
(92, 1047, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(93, 1048, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(94, 1048, 'Strawberry Pistachio Cake', NULL, 2, 510.00, NULL, NULL, NULL),
(95, 1048, 'Chicken Fillet', NULL, 2, 199.00, NULL, NULL, NULL),
(96, 1048, 'Strawberry Pistachio Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(97, 1048, 'Strawberry Pistachio Cake', NULL, 1, 110.00, NULL, NULL, NULL),
(98, 1049, 'Sansrival', NULL, 1, 530.00, NULL, NULL, NULL),
(99, 1049, 'Lumpiang Shanghai', NULL, 2, 219.00, NULL, NULL, NULL),
(100, 1049, 'Lumpiang Shanghai', NULL, 1, 309.00, NULL, NULL, NULL),
(101, 1050, 'Strawberry Pistachio Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(102, 1050, 'Chocolate Mousse', NULL, 1, 1000.00, NULL, NULL, NULL),
(103, 1051, 'Choco Pistachio Dream', NULL, 1, 1750.00, NULL, NULL, NULL),
(104, 1052, 'Strawberry Pistachio Cake', NULL, 1, 920.00, NULL, NULL, NULL),
(105, 1053, 'Tiramisu', NULL, 1, 490.00, NULL, NULL, NULL),
(106, 1053, 'Red Velvet Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(107, 1054, 'Chocolate Ganache Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(108, 1054, 'Chocolate Caramel Cake', NULL, 1, 880.00, NULL, NULL, NULL),
(109, 1055, 'Tiramisu', NULL, 1, 880.00, NULL, NULL, NULL),
(110, 1056, 'Carrot Cake', NULL, 1, 950.00, NULL, NULL, NULL),
(111, 1057, 'Tempura', NULL, 1, 199.00, NULL, NULL, NULL),
(112, 1058, 'Chocolate Caramel Cake', NULL, 1, 105.00, NULL, NULL, NULL),
(113, 1059, 'Chocolate Caramel Cake', NULL, 7, 490.00, NULL, NULL, NULL),
(114, 1060, 'Beef Broccoli', NULL, 2, 199.00, NULL, NULL, NULL),
(115, 1061, 'Carrot Cake', NULL, 1, 950.00, NULL, NULL, NULL),
(116, 1061, 'Sansrival', NULL, 2, 530.00, NULL, NULL, NULL),
(117, 1062, 'Blueberry Cheesecake', NULL, 1, 1300.00, NULL, NULL, NULL),
(118, 1063, 'Chocolate Caramel Cake', NULL, 3, 105.00, NULL, NULL, NULL),
(119, 1064, 'Product', NULL, 1, 110.00, NULL, NULL, NULL),
(120, 1064, 'Product', NULL, 1, 110.00, NULL, NULL, NULL),
(121, 1065, 'Product', NULL, 1, 110.00, NULL, NULL, NULL),
(122, 1065, 'Product', NULL, 1, 110.00, NULL, NULL, NULL),
(123, 1066, 'Product', NULL, 1, 100.00, NULL, NULL, NULL),
(124, 1066, 'Product', NULL, 1, 100.00, NULL, NULL, NULL),
(125, 1066, 'Product', NULL, 1, 100.00, NULL, NULL, NULL),
(126, 1067, 'Product', NULL, 2, 920.00, NULL, NULL, NULL),
(127, 1068, 'Product', NULL, 1, 880.00, NULL, NULL, NULL),
(128, 1069, 'Product', NULL, 2, 100.00, NULL, NULL, NULL),
(129, 1070, 'Chocolate Caramel Cake', NULL, 2, 880.00, NULL, NULL, NULL),
(130, 1071, 'Pork Barbecue', NULL, 1, 219.00, NULL, NULL, NULL),
(131, 1072, 'Beef Broccoli', NULL, 2, 219.00, NULL, NULL, NULL),
(132, 1073, 'Chicken Fillet', NULL, 2, 309.00, NULL, NULL, NULL),
(133, 1073, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(134, 1074, 'Chocolate Oreo Cake', NULL, 1, 100.00, NULL, NULL, NULL),
(135, 1074, 'Honey Garlic Chicken', NULL, 1, 199.00, NULL, NULL, NULL),
(136, 1075, 'Chocolate Ganache Cake', NULL, 1, 450.00, NULL, NULL, NULL),
(137, 1075, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(138, 1076, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(139, 1076, 'Chocolate Ganache Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(140, 1077, 'Tiramisu', NULL, 1, 105.00, NULL, NULL, NULL),
(141, 1077, 'Strawberry Pistachio Cake', NULL, 1, 110.00, NULL, NULL, NULL),
(142, 1078, 'Tiramisu', NULL, 1, 105.00, NULL, NULL, NULL),
(143, 1078, 'Strawberry Pistachio Cake', NULL, 1, 110.00, NULL, NULL, NULL),
(144, 1078, 'Chocolate Ganache Cake', NULL, 1, 100.00, NULL, NULL, NULL),
(145, 1079, 'Chocolate Ganache Cake', NULL, 1, 100.00, NULL, NULL, NULL),
(146, 1079, 'Chocolate S’mores Cake', NULL, 1, 100.00, NULL, NULL, NULL),
(147, 1080, 'Chocolate S’mores Cake', NULL, 1, 790.00, NULL, NULL, NULL),
(148, 1080, 'Chocolate Caramel Cake', NULL, 1, 490.00, NULL, NULL, NULL),
(149, 1081, 'Chocolate S’mores Cake', 'SLICE', 1, 100.00, '', NULL, NULL),
(150, 1082, 'Chocolate S’mores Cake', 'SLICE', 1, 100.00, '', NULL, NULL),
(151, 1083, 'Chocolate S’mores Cake', 'SLICE', 1, 100.00, '', NULL, NULL),
(152, 1084, 'Chocolate S’mores Cake', 'SLICE', 1, 100.00, '', NULL, NULL),
(153, 1085, 'Chocolate S’mores Cake', 'SLICE', 4, 100.00, '', NULL, NULL),
(154, 1086, 'Strawberry Pistachio Cake', 'BIG', 2, 920.00, '', NULL, NULL),
(155, 1087, 'Chocolate S’mores Cake', 'SLICE', 3, 100.00, '', NULL, NULL),
(156, 1088, 'Chocolate Caramel Cake', 'SLICE', 1, 105.00, '', NULL, NULL),
(157, 1089, 'Chocolate Caramel Cake', 'SLICE', 1, 105.00, '', NULL, NULL),
(158, 1090, 'Chocolate Caramel Cake', 'SMALL', 1, 490.00, '', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `token` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `password_resets`
--

INSERT INTO `password_resets` (`id`, `email`, `token`, `expires_at`, `used`, `created_at`) VALUES
(1, 'karyl8350@gmail.com', '848703', '2026-05-15 09:09:51', 0, '2026-05-15 06:54:51'),
(2, 'abistadoerryca@gmail.com', '435321', '2026-05-15 09:20:50', 1, '2026-05-15 07:05:50'),
(3, 'abistadoerryca@gmail.com', '440321', '2026-05-15 18:14:28', 1, '2026-05-15 15:59:28'),
(4, 'abistadoerryca@gmail.com', '040798', '2026-05-15 18:16:18', 1, '2026-05-15 16:01:18'),
(5, 'abistadoerryca@gmail.com', '503959', '2026-05-15 18:30:45', 1, '2026-05-15 16:15:45'),
(6, 'abistadoerryca@gmail.com', '474887', '2026-05-16 00:34:53', 1, '2026-05-15 16:19:53'),
(7, 'hernandezkaryl78@gmail.com', '353598', '2026-07-04 18:33:05', 0, '2026-07-04 10:18:05');

-- --------------------------------------------------------

--
-- Table structure for table `procurement_alerts`
--

CREATE TABLE `procurement_alerts` (
  `id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `ingredient_id` bigint(20) NOT NULL,
  `alert_type` varchar(100) NOT NULL,
  `severity` enum('info','warning','high','critical') DEFAULT 'warning',
  `message` text NOT NULL,
  `is_resolved` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `production_batch_allocations`
--

CREATE TABLE `production_batch_allocations` (
  `id` int(11) NOT NULL,
  `production_transaction_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `ingredient_batch_id` int(11) NOT NULL,
  `quantity_consumed` decimal(10,3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `production_batch_allocations`
--

INSERT INTO `production_batch_allocations` (`id`, `production_transaction_id`, `ingredient_id`, `ingredient_batch_id`, `quantity_consumed`, `created_at`) VALUES
(30, 27, 19, 10, 2.000, '2026-08-31 15:31:48'),
(31, 27, 20, 13, 0.500, '2026-08-31 15:31:48'),
(32, 27, 21, 15, 0.250, '2026-08-31 15:31:48'),
(33, 27, 23, 19, 0.100, '2026-08-31 15:31:48'),
(34, 28, 19, 10, 2.000, '2026-08-31 15:31:48'),
(35, 28, 20, 13, 0.500, '2026-08-31 15:31:48'),
(36, 28, 21, 15, 0.250, '2026-08-31 15:31:48'),
(37, 28, 23, 19, 0.100, '2026-08-31 15:31:48');

-- --------------------------------------------------------

--
-- Table structure for table `production_transactions`
--

CREATE TABLE `production_transactions` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `idempotency_key` varchar(100) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `production_transactions`
--

INSERT INTO `production_transactions` (`id`, `product_id`, `quantity`, `idempotency_key`, `user_id`, `created_at`) VALUES
(27, 128, 1, 'TEST-1788190308-001', 999, '2026-08-31 15:31:48'),
(28, 128, 1, 'TEST-1788190308', 999, '2026-08-31 15:31:48');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `category` varchar(80) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `production_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `solo_price` decimal(10,2) DEFAULT NULL,
  `sharing_price` decimal(10,2) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `image` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `available` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `slice_price` decimal(10,2) DEFAULT 0.00,
  `small_price` decimal(10,2) DEFAULT 0.00,
  `big_price` decimal(10,2) DEFAULT 0.00,
  `meal_price` decimal(10,2) DEFAULT 0.00,
  `combo_price` decimal(10,2) DEFAULT 0.00,
  `tag` varchar(50) DEFAULT NULL,
  `is_custom` tinyint(1) DEFAULT 0,
  `reorder_level` int(11) NOT NULL DEFAULT 5,
  `minimum_stock` int(11) NOT NULL DEFAULT 5
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `category`, `price`, `production_cost`, `solo_price`, `sharing_price`, `stock`, `image`, `description`, `available`, `created_at`, `updated_at`, `slice_price`, `small_price`, `big_price`, `meal_price`, `combo_price`, `tag`, `is_custom`, `reorder_level`, `minimum_stock`) VALUES
(9, 'Chocolate Ganache Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 28, 'cake1.png', '', 1, '2026-05-03 11:12:22', '2026-06-24 07:17:59', 100.00, 450.00, 789.00, 0.00, 0.00, NULL, 0, 5, 5),
(10, 'Chocolate S’mores Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 25, 'cake2.png', '', 1, '2026-05-03 11:12:22', '2026-05-16 01:14:42', 100.00, 450.00, 790.00, 0.00, 0.00, NULL, 0, 5, 5),
(11, 'Chocolate Caramel Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 23, 'cake3.png', '', 1, '2026-05-03 11:12:22', '2026-06-17 08:16:06', 105.00, 490.00, 880.00, 0.00, 0.00, NULL, 0, 5, 5),
(12, 'Chocolate Oreo Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 9, 'cake4.png', '', 1, '2026-05-03 11:12:22', '2026-06-17 06:29:43', 105.00, 490.00, 880.00, 0.00, 0.00, NULL, 0, 5, 5),
(13, 'Tiramisu', 'Cakes', 0.00, 0.00, NULL, NULL, 4, 'cake5.png', '', 1, '2026-05-03 11:12:22', '2026-06-17 07:01:41', 105.00, 490.00, 880.00, 0.00, 0.00, NULL, 0, 5, 5),
(14, 'Red Velvet Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 20, 'cake6.png', '', 1, '2026-05-03 11:12:22', '2026-05-08 09:24:55', 105.00, 490.00, 880.00, 0.00, 0.00, NULL, 0, 5, 5),
(15, 'Ube Flan Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 30, 'cake7.png', '', 1, '2026-05-03 11:12:22', '2026-07-11 14:55:03', 110.00, 510.00, 920.00, 0.00, 0.00, NULL, 0, 5, 5),
(16, 'Strawberry Pistachio Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 10, 'cake8.png', '', 1, '2026-05-03 11:12:22', '2026-05-08 09:24:55', 110.00, 510.00, 920.00, 0.00, 0.00, NULL, 0, 5, 5),
(17, 'Carrot Cake', 'Cakes', 0.00, 0.00, NULL, NULL, 10, 'cake9.png', '', 1, '2026-05-03 11:12:22', '2026-05-08 09:24:55', 110.00, 530.00, 950.00, 0.00, 0.00, NULL, 0, 5, 5),
(18, 'Sansrival', 'Cakes', 0.00, 0.00, NULL, NULL, 10, 'cake10.png', '', 1, '2026-05-03 11:12:22', '2026-05-08 09:24:55', 110.00, 530.00, 950.00, 0.00, 0.00, NULL, 0, 5, 5),
(19, 'Chocolate Mousse', 'Cakes', 0.00, 0.00, NULL, NULL, 10, 'cake11.png', '', 1, '2026-05-03 11:12:22', '2026-05-08 09:24:55', 105.00, 530.00, 1000.00, 0.00, 0.00, NULL, 0, 5, 5),
(20, 'Blueberry Cheesecake', 'Cakes', 0.00, 0.00, NULL, NULL, 10, 'cake12.png', '', 1, '2026-05-03 11:12:22', '2026-07-05 08:07:08', 135.00, 700.00, 1300.00, 0.00, 0.00, NULL, 0, 5, 5),
(21, 'Choco Pistachio Dream', 'Cakes', 0.00, 0.00, NULL, NULL, 4, 'cake13.png', '', 1, '2026-05-03 11:12:22', '2026-07-06 01:23:22', 175.00, 900.00, 1750.00, 0.00, 0.00, NULL, 0, 5, 5),
(22, 'Chicken Fillet', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal1.png', 'Crispy chicken fillet served with rice', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(23, 'Beef Broccoli', 'Meals', 199.00, 0.00, NULL, NULL, 99, 'meal2.png', 'Beef with broccoli in savory sauce', 1, '2026-05-03 13:28:16', '2026-06-17 06:19:28', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(24, 'Lumpiang Shanghai', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal3.png', 'Fried spring rolls with dipping sauce', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(25, 'Tempura', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal4.png', 'Crispy shrimp tempura', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(26, 'Pork Barbecue', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal5.png', 'Grilled pork barbecue skewers', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(27, 'Fish Fillet', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal6.png', 'Breaded fish fillet with sauce', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(28, 'Honey Garlic Chicken', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal7.png', 'Chicken in honey garlic glaze', 0, '2026-05-03 13:28:16', '2026-05-08 09:47:42', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(29, 'Chicken Teriyaki', 'Meals', 199.00, 0.00, NULL, NULL, 100, 'meal8.png', 'Chicken with teriyaki sauce', 1, '2026-05-03 13:28:16', '2026-05-08 09:24:55', 199.00, 219.00, 309.00, 219.00, 309.00, NULL, 0, 5, 5),
(32, 'Tuna Pasta', 'Pasta', 140.00, 0.00, NULL, NULL, 79, 'tuna_pasta.png', NULL, 1, '2026-05-08 14:53:57', '2026-05-13 08:41:21', 0.00, 0.00, 0.00, 165.00, 0.00, NULL, 0, 5, 5),
(33, 'Baked Mac', 'Pasta', 140.00, 0.00, NULL, NULL, 0, 'baked_mac.png', NULL, 1, '2026-05-08 14:53:57', '2026-05-09 04:39:15', 0.00, 0.00, 0.00, 165.00, 0.00, NULL, 0, 5, 5),
(34, 'Beef Spaghetti', 'Pasta', 140.00, 0.00, NULL, NULL, 0, 'beef_spaghetti.png', NULL, 1, '2026-05-08 14:53:57', '2026-05-09 04:39:15', 0.00, 0.00, 0.00, 165.00, 0.00, NULL, 0, 5, 5),
(35, 'Tinapa Pasta', 'Pasta', 140.00, 0.00, NULL, NULL, 0, 'tinapa_pasta.png', NULL, 1, '2026-05-08 14:53:57', '2026-05-09 04:39:15', 0.00, 0.00, 0.00, 165.00, 0.00, NULL, 0, 5, 5),
(36, 'Chicken Pasta', 'Pasta', 140.00, 0.00, NULL, NULL, 0, 'chicken_pasta.png', NULL, 1, '2026-05-08 14:53:57', '2026-05-09 04:39:15', 0.00, 0.00, 0.00, 165.00, 0.00, NULL, 0, 5, 5),
(53, 'Spinach Pizza', 'Pizza', 480.00, 0.00, NULL, NULL, 0, 'Spinach.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 10:00:30', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(54, 'Pepperoni Pizza', 'Pizza', 430.00, 0.00, NULL, NULL, 0, 'Pepperoni.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 09:56:46', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(55, 'Four-Cheese Pizza', 'Pizza', 460.00, 0.00, NULL, NULL, 0, 'Fourcheese.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 09:45:21', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(56, 'Breakfast Pizza', 'Pizza', 460.00, 0.00, NULL, NULL, 0, 'Breakfast.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 09:36:41', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(57, 'Hawaiian Pizza', 'Pizza', 430.00, 0.00, NULL, NULL, 0, 'Hawaiian.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 09:45:51', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(58, 'Veggie Pizza', 'Pizza', 420.00, 0.00, NULL, NULL, 0, 'Veggie.png', NULL, 1, '2026-05-08 15:27:02', '2026-08-31 10:02:49', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(59, 'Caramel', 'Drinks', 150.00, 0.00, NULL, NULL, 0, 'Caramel.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:40:21', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(60, 'Salted Caramel', 'Drinks', 150.00, 0.00, NULL, NULL, 0, 'Saltedcaramel (1).png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:59:39', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(61, 'Chocolate', 'Drinks', 150.00, 0.00, NULL, NULL, 0, 'Chocolate.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:42:46', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(62, 'White Chocolate', 'Drinks', 150.00, 0.00, NULL, NULL, 0, 'white.png', NULL, 1, '2026-05-08 15:30:26', '2026-05-08 15:30:26', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(63, 'Oreo', 'Drinks', 145.00, 0.00, NULL, NULL, 0, 'Oreo.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:55:13', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(64, 'Matcha', 'Drinks', 170.00, 0.00, NULL, NULL, 0, 'Matcha.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:54:20', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(65, 'Vanilla', 'Drinks', 155.00, 0.00, NULL, NULL, 0, 'Vanilla.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 10:02:11', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(66, 'Chocolate Chip Cream', 'Drinks', 170.00, 0.00, NULL, NULL, 0, 'chocolate.png', NULL, 1, '2026-05-08 15:30:26', '2026-05-08 15:30:26', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(67, 'Strawberry Yogurt Smoothie', 'Drinks', 165.00, 0.00, NULL, NULL, 0, 'Strawberryyogurtsmoothie.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 10:01:53', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(68, 'Mango Yogurt Smoothie', 'Drinks', 165.00, 0.00, NULL, NULL, 0, 'Mangoyogurtsmoothie.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:53:11', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(69, 'Blueberry Yogurt Smoothie', 'Drinks', 165.00, 0.00, NULL, NULL, 0, 'Blueberryyogurtsmoothie.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:32:56', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(70, 'Raspberry Yogurt Smoothie', 'Drinks', 165.00, 0.00, NULL, NULL, 0, 'Rasberryyogurtsmoothie.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:59:09', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(71, 'Plain Yogurt Smoothie', 'Drinks', 145.00, 0.00, NULL, NULL, 0, 'Plainyogurtsmoothie.png', NULL, 1, '2026-05-08 15:30:26', '2026-08-31 09:57:20', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(72, 'Blueberry Ade', 'Drinks', 125.00, 0.00, NULL, NULL, 0, 'Blueberryade.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:34:19', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(73, 'Strawberry Ade', 'Drinks', 125.00, 0.00, NULL, NULL, 0, 'Strawberryade.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 10:00:52', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(74, 'Mango Ade', 'Drinks', 125.00, 0.00, NULL, NULL, 0, 'Mangoade.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:50:49', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(75, 'Raspberry Ade', 'Drinks', 125.00, 0.00, NULL, NULL, 0, 'raspberry.png', NULL, 1, '2026-05-08 15:31:35', '2026-05-08 15:31:35', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(76, 'Passion Fruit Fizz', 'Drinks', 135.00, 0.00, NULL, NULL, 0, 'Passionfruitfizz.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:55:35', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(77, 'Blueberry Fizz', 'Drinks', 135.00, 0.00, NULL, NULL, 0, 'Blueberryfizz.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:33:51', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(78, 'Mango Fizz', 'Drinks', 135.00, 0.00, NULL, NULL, 0, 'Mangofizz.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:51:14', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(79, 'Strawberry Fizz', 'Drinks', 135.00, 0.00, NULL, NULL, 0, 'Strawberryfizz.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 10:01:15', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(80, 'Kiwi Fizz', 'Drinks', 135.00, 0.00, NULL, NULL, 0, 'Kiwifizz.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:48:47', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(81, 'Passion Fruit Tea', 'Drinks', 130.00, 0.00, NULL, NULL, 0, 'Passionfruittea.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:56:04', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(82, 'Blueberry Fruit Tea', 'Drinks', 130.00, 0.00, NULL, NULL, 0, 'Blueberryfruittea.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:33:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(83, 'Mango Fruit Tea', 'Drinks', 130.00, 0.00, NULL, NULL, 0, 'Mangofruittea.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:51:36', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(84, 'Strawberry Fruit Tea', 'Drinks', 130.00, 0.00, NULL, NULL, 0, 'Strawberryfruittea.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 10:01:34', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(85, 'Kiwi Fruit Tea', 'Drinks', 130.00, 0.00, NULL, NULL, 0, 'Kiwifruittea.png', NULL, 1, '2026-05-08 15:31:35', '2026-08-31 09:50:14', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(86, 'Americano', 'Coffee', 125.00, 0.00, NULL, NULL, 0, 'americano.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(87, 'Cappuccino', 'Coffee', 135.00, 0.00, NULL, NULL, 0, 'Cappuccino.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:37:39', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(88, 'Latte', 'Coffee', 135.00, 0.00, NULL, NULL, 0, 'Latte.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:50:31', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(89, 'White Chocolate', 'Coffee', 145.00, 0.00, NULL, NULL, 0, 'Whitechocolate.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 10:03:06', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(90, 'Caramel', 'Coffee', 145.00, 0.00, NULL, NULL, 0, 'Caramel2.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:41:52', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(91, 'Salted Caramel', 'Coffee', 145.00, 0.00, NULL, NULL, 0, 'Saltedcaramel.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:59:59', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(92, 'Mocha', 'Coffee', 145.00, 0.00, NULL, NULL, 0, 'Mocha.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:54:42', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(93, 'Hazelnut', 'Coffee', 150.00, 0.00, NULL, NULL, 0, 'Hazelnut.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:46:33', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(94, 'Vanilla', 'Coffee', 150.00, 0.00, NULL, NULL, 0, 'Vanilla (1).png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 10:02:31', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(95, 'Pastry Project Latte', 'Coffee', 155.00, 0.00, NULL, NULL, 0, 'Pastryprojlatte.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:56:27', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(96, 'Dirty Matcha', 'Coffee', 165.00, 0.00, NULL, NULL, 0, 'Dirtymatcha.png', NULL, 1, '2026-05-08 15:32:29', '2026-08-31 09:43:48', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(97, 'Matcha Latte', 'Coffee', 160.00, 0.00, NULL, NULL, 0, 'matcha.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(98, 'Spanish Latte', 'Coffee', 155.00, 0.00, NULL, NULL, 0, 'spanish.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(99, 'Matcha Cream Latte', 'Coffee', 155.00, 0.00, NULL, NULL, 0, 'matcha.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(100, 'Ube Cream Latte', 'Coffee', 155.00, 0.00, NULL, NULL, 0, 'ube.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(101, 'Vietnamese Latte', 'Coffee', 155.00, 0.00, NULL, NULL, 0, 'vietnamese.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(102, 'Tiramisu Latte', 'Coffee', 199.00, 0.00, NULL, NULL, 0, 'tiramisu.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(103, 'Affogato', 'Coffee', 120.00, 0.00, NULL, NULL, 0, 'affogato.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(104, 'Matchagato', 'Coffee', 150.00, 0.00, NULL, NULL, 0, 'matchagato.png', NULL, 1, '2026-05-08 15:32:29', '2026-05-08 15:32:29', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(112, 'French Fries', 'Starter', 0.00, 0.00, 75.00, 140.00, 10, 'french.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-07-05 08:06:43', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(113, 'Cheesy Bacon Fries', 'Starter', 0.00, 0.00, 120.00, 230.00, 60, 'cheesy.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-05-13 08:40:53', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(114, 'Potato Wedges', 'Starter', 0.00, 0.00, 75.00, 140.00, 0, 'potato.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-05-08 15:47:33', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(115, 'Mozzarella Sticks', 'Starter', 0.00, 0.00, 140.00, 200.00, 0, 'mozarella.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-05-08 15:47:33', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(116, 'Mojos', 'Starter', 0.00, 0.00, 75.00, 140.00, 0, 'mojos.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-05-08 15:47:33', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(117, 'Mojos Hot', 'Starter', 0.00, 0.00, 75.00, 140.00, 10, 'mojos_hot.jpg', NULL, 1, '2026-05-08 15:47:33', '2026-07-11 14:55:25', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(118, 'Chicken Nuggets', 'Starter', 0.00, 0.00, 120.00, 230.00, 0, 'chicken.png', NULL, 1, '2026-05-08 15:47:33', '2026-05-08 15:54:03', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(128, '[DEV] Chocolate Cake', '', 25.00, 0.00, NULL, NULL, 2, NULL, 'Development test product - chocolate cake for FEFO testing', 1, '2026-08-31 15:20:46', '2026-08-31 15:31:48', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5),
(129, '[DEV] Vanilla Cake', '', 20.00, 0.00, NULL, NULL, 0, NULL, 'Development test product - vanilla cake for recipe testing', 1, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 0.00, 0.00, 0.00, 0.00, 0.00, NULL, 0, 5, 5);

-- --------------------------------------------------------

--
-- Table structure for table `product_inventory_movements`
--

CREATE TABLE `product_inventory_movements` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `movement_type` varchar(40) NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `previous_stock` decimal(10,3) NOT NULL,
  `new_stock` decimal(10,3) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `reference_type` varchar(40) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `product_variant_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_inventory_movements`
--

INSERT INTO `product_inventory_movements` (`id`, `product_id`, `movement_type`, `quantity`, `previous_stock`, `new_stock`, `reason`, `reference_type`, `reference_id`, `user_id`, `created_at`, `product_variant_id`) VALUES
(48, 128, 'Production', 1.000, 0.000, 1.000, 'Produced 1 unit(s)', 'production', 27, 999, '2026-08-31 15:31:48', NULL),
(49, 128, 'Production', 1.000, 1.000, 2.000, 'Produced 1 unit(s)', 'production', 28, 999, '2026-08-31 15:31:48', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `product_recipes`
--

CREATE TABLE `product_recipes` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `qty` decimal(10,3) NOT NULL DEFAULT 0.000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_recipes`
--

INSERT INTO `product_recipes` (`id`, `product_id`, `ingredient_id`, `qty`, `created_at`, `updated_at`, `active`) VALUES
(10, 128, 19, 2.000, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(11, 128, 20, 0.500, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(12, 128, 21, 0.250, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(13, 128, 23, 0.100, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(14, 129, 19, 2.000, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(15, 129, 20, 0.500, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(16, 129, 21, 0.250, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1),
(17, 129, 22, 4.000, '2026-08-31 15:20:46', '2026-08-31 15:20:46', 1);

-- --------------------------------------------------------

--
-- Table structure for table `product_sizes`
--

CREATE TABLE `product_sizes` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size` varchar(30) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `available` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_sizes`
--

INSERT INTO `product_sizes` (`id`, `product_id`, `size`, `price`, `available`) VALUES
(40, 9, 'slice', 100.00, 1),
(41, 9, 'small', 450.00, 1),
(42, 9, 'big', 790.00, 1),
(43, 10, 'slice', 100.00, 1),
(44, 10, 'small', 450.00, 1),
(45, 10, 'big', 790.00, 1),
(46, 11, 'slice', 105.00, 1),
(47, 11, 'small', 490.00, 1),
(48, 11, 'big', 880.00, 1),
(49, 12, 'slice', 105.00, 1),
(50, 12, 'small', 490.00, 1),
(51, 12, 'big', 880.00, 1),
(52, 13, 'slice', 105.00, 1),
(53, 13, 'small', 490.00, 1),
(54, 13, 'big', 880.00, 1),
(55, 14, 'slice', 105.00, 1),
(56, 14, 'small', 490.00, 1),
(57, 14, 'big', 880.00, 1),
(58, 15, 'slice', 110.00, 1),
(59, 15, 'small', 510.00, 1),
(60, 15, 'big', 920.00, 1),
(61, 16, 'slice', 110.00, 1),
(62, 16, 'small', 510.00, 1),
(63, 16, 'big', 920.00, 1),
(64, 17, 'slice', 110.00, 1),
(65, 17, 'small', 530.00, 1),
(66, 17, 'big', 950.00, 1),
(67, 18, 'slice', 110.00, 1),
(68, 18, 'small', 530.00, 1),
(69, 18, 'big', 950.00, 1),
(70, 19, 'slice', 105.00, 1),
(71, 19, 'small', 530.00, 1),
(72, 19, 'big', 1000.00, 1),
(73, 20, 'slice', 135.00, 1),
(74, 20, 'small', 700.00, 1),
(75, 20, 'big', 1300.00, 1),
(76, 21, 'slice', 175.00, 1),
(77, 21, 'small', 900.00, 1),
(78, 21, 'big', 1750.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `product_sizes_archive`
--

CREATE TABLE `product_sizes_archive` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `size` enum('slice','small','big') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `available` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_sizes_archive`
--

INSERT INTO `product_sizes_archive` (`id`, `product_id`, `size`, `price`, `available`) VALUES
(79, 9, 'slice', 100.00, 1),
(80, 9, 'small', 450.00, 1),
(81, 9, 'big', 790.00, 1),
(82, 10, 'slice', 100.00, 1),
(83, 10, 'small', 450.00, 1),
(84, 10, 'big', 790.00, 1),
(85, 11, 'slice', 105.00, 1),
(86, 11, 'small', 490.00, 1),
(87, 11, 'big', 880.00, 1),
(88, 12, 'slice', 105.00, 1),
(89, 12, 'small', 490.00, 1),
(90, 12, 'big', 880.00, 1),
(91, 13, 'slice', 105.00, 1),
(92, 13, 'small', 490.00, 1),
(93, 13, 'big', 880.00, 1),
(94, 14, 'slice', 105.00, 1),
(95, 14, 'small', 490.00, 1),
(96, 14, 'big', 880.00, 1),
(97, 15, 'slice', 110.00, 1),
(98, 15, 'small', 510.00, 1),
(99, 15, 'big', 920.00, 1),
(100, 16, 'slice', 110.00, 1),
(101, 16, 'small', 510.00, 1),
(102, 16, 'big', 920.00, 1),
(103, 17, 'slice', 110.00, 1),
(104, 17, 'small', 530.00, 1),
(105, 17, 'big', 950.00, 1),
(106, 18, 'slice', 110.00, 1),
(107, 18, 'small', 530.00, 1),
(108, 18, 'big', 950.00, 1),
(109, 19, 'slice', 105.00, 1),
(110, 19, 'small', 530.00, 1),
(111, 19, 'big', 1000.00, 1),
(112, 20, 'slice', 135.00, 1),
(113, 20, 'small', 700.00, 1),
(114, 20, 'big', 1300.00, 1),
(115, 21, 'slice', 175.00, 1),
(116, 21, 'small', 900.00, 1),
(117, 21, 'big', 1750.00, 1),
(118, 9, 'slice', 100.00, 1),
(119, 9, 'small', 450.00, 1),
(120, 9, 'big', 790.00, 1),
(121, 10, 'slice', 100.00, 1),
(122, 10, 'small', 450.00, 1),
(123, 10, 'big', 790.00, 1),
(124, 11, 'slice', 105.00, 1),
(125, 11, 'small', 490.00, 1),
(126, 11, 'big', 880.00, 1),
(127, 12, 'slice', 105.00, 1),
(128, 12, 'small', 490.00, 1),
(129, 12, 'big', 880.00, 1),
(130, 13, 'slice', 105.00, 1),
(131, 13, 'small', 490.00, 1),
(132, 13, 'big', 880.00, 1),
(133, 14, 'slice', 105.00, 1),
(134, 14, 'small', 490.00, 1),
(135, 14, 'big', 880.00, 1),
(136, 15, 'slice', 110.00, 1),
(137, 15, 'small', 510.00, 1),
(138, 15, 'big', 920.00, 1),
(139, 16, 'slice', 110.00, 1),
(140, 16, 'small', 510.00, 1),
(141, 16, 'big', 920.00, 1),
(142, 17, 'slice', 110.00, 1),
(143, 17, 'small', 530.00, 1),
(144, 17, 'big', 950.00, 1),
(145, 18, 'slice', 110.00, 1),
(146, 18, 'small', 530.00, 1),
(147, 18, 'big', 950.00, 1),
(148, 19, 'slice', 105.00, 1),
(149, 19, 'small', 530.00, 1),
(150, 19, 'big', 1000.00, 1),
(151, 20, 'slice', 135.00, 1),
(152, 20, 'small', 700.00, 1),
(153, 20, 'big', 1300.00, 1),
(154, 21, 'slice', 175.00, 1),
(155, 21, 'small', 900.00, 1),
(156, 21, 'big', 1750.00, 1);

-- --------------------------------------------------------

--
-- Table structure for table `reorder_logs`
--

CREATE TABLE `reorder_logs` (
  `id` bigint(20) NOT NULL,
  `recommendation_id` bigint(20) DEFAULT NULL,
  `product_id` bigint(20) NOT NULL,
  `ingredient_id` bigint(20) NOT NULL,
  `action_taken` varchar(100) NOT NULL,
  `qty_recommended` decimal(10,2) NOT NULL,
  `qty_ordered` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reorder_recommendations`
--

CREATE TABLE `reorder_recommendations` (
  `id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `ingredient_id` bigint(20) NOT NULL,
  `recommendation_date` date NOT NULL,
  `recommended_qty` decimal(10,2) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `reason_code` varchar(100) NOT NULL,
  `priority_level` enum('low','medium','high','critical') DEFAULT 'medium',
  `status` enum('pending','approved','ignored','ordered') DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `review` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_daily_snapshots`
--

CREATE TABLE `sales_daily_snapshots` (
  `id` bigint(20) NOT NULL,
  `import_id` bigint(20) DEFAULT NULL,
  `product_id` bigint(20) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `sale_date` date NOT NULL,
  `units_sold` decimal(10,2) NOT NULL DEFAULT 0.00,
  `revenue` decimal(12,2) DEFAULT 0.00,
  `source_system` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `simulated_baselines`
--

CREATE TABLE `simulated_baselines` (
  `id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `model_version` varchar(50) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `avg_daily_demand` decimal(10,2) NOT NULL,
  `trend_factor` decimal(10,4) DEFAULT 0.0000,
  `seasonality_index` decimal(10,4) DEFAULT 1.0000,
  `confidence_score` decimal(5,2) DEFAULT 0.00,
  `generated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','staff','customer') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `profile_picture` text DEFAULT NULL,
  `profile_image` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `created_at`, `phone`, `address`, `username`, `profile_picture`, `profile_image`) VALUES
(1, 'Shop Owner', 'admin@pastry.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '2026-05-03 10:53:37', NULL, NULL, NULL, NULL, NULL),
(2, 'Staff Member', 'staff@pastry.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '2026-05-03 10:53:37', NULL, NULL, NULL, NULL, NULL),
(3, 'Customer', 'customer@pastry.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', '2026-05-03 10:53:37', NULL, NULL, NULL, NULL, NULL),
(4, 'erryca bianca', 'erryca27@gmail.com', '$2y$10$xI/8KdEbqUjIzCjdmp/e6uXzM5KG7RPz0xWj8/dbWTJtQgcCo7GFu', 'customer', '2026-05-05 05:42:38', NULL, NULL, NULL, NULL, NULL),
(5, 'Admin', 'abistadoerryca@gmail.com', '$2y$10$FEHRC4MtN3fPsMKslhpOkOpI66hXSMRIPAJYyKT9IHqNrmxKtKyLu', 'admin', '2026-05-09 17:04:27', NULL, NULL, NULL, NULL, NULL),
(6, 'Karyl Hernandez', 'karyl8350@gmail.com', 'hernandez06', 'customer', '2026-05-12 15:02:27', NULL, NULL, NULL, NULL, NULL),
(7, 'Karyl Hernandez', 'hernandezkaryl78@gmailcom', 'hernandez06', 'customer', '2026-05-15 07:12:51', NULL, NULL, NULL, NULL, NULL),
(8, 'Karyl Hernandez', 'hernandezkaryl78@gmail.com', '$2y$10$QRuXJ2keswTOOCZQQiywweS/AMdPwZ3gE4tdcJ23xRduqt2V.zflm', 'customer', '2026-05-15 07:18:52', '09994840687', NULL, '', '', NULL),
(9, 'Erryca Abistado', 'chitaegandalalake@gmail.com', 'haldohhhh', 'customer', '2026-05-15 07:20:48', NULL, NULL, NULL, NULL, NULL),
(10, 'Sonlei Peladra', 'peladrasonlei@gmail.com', 'lelei2506', 'customer', '2026-05-15 07:22:35', NULL, NULL, NULL, NULL, NULL),
(11, 'Mika Silva', 'chitae@gmail.com', 'ewan', 'customer', '2026-05-15 07:49:08', NULL, NULL, NULL, NULL, NULL),
(12, 'Erryca Abistado', 'abistadoerryca2@gmail.com', '$2y$10$sZ1K2V2twcj2XuONXqBVeOjPFizDiABvo8S9W/4kE.oryxo7ODBhS', 'customer', '2026-05-15 07:53:02', NULL, NULL, NULL, NULL, NULL),
(13, 'Test User', 'testuser@example.com', '$2y$12$EiACF72.GD5Ucj/C2MnKkOl9Plbr/e/2UVii0I6iv7cde7SvGY0ya', 'customer', '2026-05-31 22:10:50', NULL, NULL, NULL, NULL, NULL),
(14, 'John Doe', 'testuser202406031145@example.com', '$2y$12$089BM1xXpJwkrJPmnH2KVuM3.CJRx/jWkKAu37DU4JrDBwLg9YEOG', 'customer', '2026-06-02 20:17:30', NULL, NULL, NULL, NULL, NULL),
(15, 'Test Google User', 'testgoogle1780460791@gmail.com', '$2y$12$vdmKwaB/DgZzCY8VwWuFh.aJ6ifhn7PQdu3TkSmi.N6NIiRC88Fum', 'customer', '2026-06-02 20:26:31', NULL, NULL, NULL, NULL, NULL),
(16, 'Test Google User', 'testgoogle1780462151@gmail.com', '$2y$12$Y2h7mccx9ZzFJQ8pEzEuduDJ2jAqYSUTAZOOqYAK5xxqLZke08p32', 'customer', '2026-06-02 20:49:11', NULL, NULL, NULL, NULL, NULL),
(17, 'Test Google User', 'testgoogle1780464280@gmail.com', '$2y$12$51rH.T1Ec0Nayba/IylA/eq3uR8d27xlewUpICP31wVf2MHj9/L6S', 'customer', '2026-06-02 21:24:40', NULL, NULL, NULL, NULL, NULL),
(18, 'Test Google User', 'testgoogle1780982877@gmail.com', '$2y$12$WVYlBbw5HPF1tmLIVzGUa.Zz17PwOs1chKDRJiXMPJ49S5RdVJYsG', 'customer', '2026-06-08 21:27:57', NULL, NULL, NULL, NULL, NULL),
(19, 'Test Google User', 'testgoogle1780983480@gmail.com', '$2y$12$41h7zm5m1cyMTgByvRspxOoXJ4unRcCTQuSE5McdZEiB5Jk3vO1Ni', 'customer', '2026-06-08 21:38:00', NULL, NULL, NULL, NULL, NULL),
(20, 'eca', 'bia@gmail.com', '$2y$10$ueepeKe7vJmZemGoJcD9ju2zhTlz/F1K8gcJ1X5/ccDKXMDWTOgbq', 'customer', '2026-06-17 10:39:12', NULL, NULL, NULL, NULL, NULL),
(21, 'Test Google User', 'testgoogle1783160606@gmail.com', '$2y$12$sWTsmTbJ58nmh61kseXZWecCka9CYweW97u/SiMyOp0oFqSHDkzWS', 'customer', '2026-07-04 02:23:27', NULL, NULL, NULL, NULL, NULL),
(22, 'Test Google User', 'testgoogle1783160893@gmail.com', '$2y$12$..e5sjVB21KxU8hPdeRlnOADh/8Agh3jZIwr7BBPBZw.B.dFMoUnW', 'customer', '2026-07-04 02:28:14', NULL, NULL, NULL, NULL, NULL),
(23, 'Test Google User', 'testgoogle1783161042@gmail.com', '$2y$12$RNjhtL/C3xyFgGljNGem6uQYmMmbX97k9hNr4J4D6Qclljkf8HhVe', 'customer', '2026-07-04 02:30:43', NULL, NULL, NULL, NULL, NULL),
(24, 'Test Google User', 'testgoogle1783161323@gmail.com', '$2y$12$8G2ag2KCURj/BbTdFxP1YeQEwmR51hHkJ6jK2KNXEHYcvMBmYhMDC', 'customer', '2026-07-04 02:35:24', NULL, NULL, NULL, NULL, NULL),
(25, 'Test Google User', 'testgoogle1783238204@gmail.com', '$2y$12$f0zkKS7sZqp.cKjfQ4g1rOEEWU7QuBbyURSSBnNkRR19F/Xpzvnm6', 'customer', '2026-07-04 23:56:44', NULL, NULL, NULL, NULL, NULL),
(26, 'Test Google User', 'testgoogle1783239229@gmail.com', '$2y$12$rNWUnshDj13chTTJLjsQHe9USK7RTSrK7msJW6kY5LceeyPscCKOq', 'customer', '2026-07-05 00:13:49', NULL, NULL, NULL, NULL, NULL),
(999, '[DEV] Test User', 'test@dev.local', 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae', 'admin', '2026-08-31 15:26:16', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `token`, `created_at`, `expires_at`) VALUES
(1, 8, 'fa422c466b848e3cdfebe5c8ccc2e2d7b4198523f13457b45bb603669edbc71c', '2026-08-24 21:16:23', '2026-09-23 21:16:23'),
(2, 8, 'ea66dd448c326189495ab3fc0ffe65a4b022506d6cb44c11ba809891ce65d1c5', '2026-08-24 22:22:20', '2026-09-23 22:22:20'),
(3, 8, '2e14f409cbd605bab0332a9c0746a20c11014080b2342d0b0fc69e892f2ce75e', '2026-08-24 23:48:05', '2026-09-23 23:48:05'),
(4, 2, '6436a2131fb8f56b91af800580d13e65aed5ab1071cf7649fa13949ea8ada763', '2026-08-25 00:07:26', '2026-09-24 00:07:26'),
(5, 2, '77e9452e005fc0f43949149e895f6f3c48e6c67b5191e149f4f9b5978585c49d', '2026-08-25 00:13:54', '2026-09-24 00:13:54'),
(13, 2, 'e5ee0f1e2cc91b3150f8a12e5f8404c030669b9723f35d048838a67928e10545', '2026-08-25 02:13:39', '2026-09-24 02:13:39'),
(14, 2, '19f5911fbc95715b5d721053e8dcc0830a2f4dee9e5be3f9e7758e98ecfb7c07', '2026-08-25 02:16:05', '2026-09-24 02:16:05'),
(15, 2, 'c364096ad05e55e7b4f079a4e9bc68d5074974754d2e3a89f6653fd7921e1f62', '2026-08-25 02:17:19', '2026-09-24 02:17:19'),
(33, 2, '82bf3ba1d2abe1d8dc9ae603c7fafdee377ff2b14611c237c075246fd9059d77', '2026-08-25 11:25:35', '2026-09-24 11:25:35'),
(38, 2, '3060f8efb2bd450cfadf104dbacf4af793605c88a049ed904a05816158c6debf', '2026-08-25 12:17:07', '2026-09-24 12:17:07'),
(39, 2, '5a470af00e7d9db02b49bb94a33afc6ba6115a8ad8541e94c1795857ee47d2f8', '2026-08-25 20:50:56', '2026-09-24 20:50:56'),
(40, 1, '90231ac4fec23edb491039ae6f8c6fe64ea34aaf8890111eb42d53f7676f108f', '2026-08-25 21:09:35', '2026-09-24 21:09:35'),
(41, 2, 'f66025536cfbff9de94284527411c8c3b4246c96e704216c96a964796df04665', '2026-08-25 21:28:58', '2026-09-24 21:28:58'),
(42, 2, '8b982d2242b06f80b296f8966034ce8b375d214a526a5b76990e068c5ec99607', '2026-08-26 12:24:09', '2026-09-25 12:24:09'),
(44, 2, 'cfd97d521672bd73246a50a7c1413ffe8b4bb02e46c0e5855d164ecbe3d2123f', '2026-08-26 13:07:47', '2026-09-25 13:07:47'),
(45, 2, 'be30af90e321f979bd0ed66c4dc19ee93e7605e6f1e7eab9f79b32cb335bb4e9', '2026-08-26 21:58:27', '2026-09-25 21:58:27'),
(46, 2, '901b84c637d68e03ff90706749b23a67e94fe71eacb1be2d0bab22b6407d3e78', '2026-08-31 17:27:12', '2026-09-30 17:27:12'),
(47, 8, '00efe7d81b72799304d30cd55f46924c37441cc31836e161a925519c8ea31d22', '2026-08-31 17:28:43', '2026-09-30 17:28:43'),
(48, 8, 'a8ede59e9de7466f54e3711dedd1b3074cbec3f17653951ab750b8b48d42bab1', '2026-08-31 18:03:54', '2026-09-30 18:03:54'),
(49, 2, '4ac9d12656f185bd5f0462f5b16f7295d4daafddcd0b2c4cb717c4efff6509e5', '2026-09-01 12:06:21', '2026-10-01 12:06:21');

-- --------------------------------------------------------

--
-- Table structure for table `variance`
--

CREATE TABLE `variance` (
  `id` int(11) NOT NULL,
  `ingredient_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `variance_type` enum('Waste','Spoilage','Damage','Unaccounted') NOT NULL,
  `qty_lost` decimal(10,3) NOT NULL,
  `reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `recorded_by` int(11) NOT NULL,
  `recorded_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `waste_log`
--

CREATE TABLE `waste_log` (
  `id` int(11) NOT NULL,
  `datetime` datetime NOT NULL,
  `item` varchar(100) NOT NULL,
  `qty` decimal(10,2) NOT NULL,
  `unit_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `item_type` enum('Raw Material','Finished Product') NOT NULL DEFAULT 'Raw Material',
  `reason` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ingredient_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `reference_type` varchar(40) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `idempotency_key` varchar(100) DEFAULT NULL,
  `ingredient_batch_id` int(11) DEFAULT NULL,
  `requested_by` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `discarded_at` datetime DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `discard_request_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `waste_log`
--

INSERT INTO `waste_log` (`id`, `datetime`, `item`, `qty`, `unit_cost`, `item_type`, `reason`, `created_at`, `ingredient_id`, `product_id`, `user_id`, `reference_type`, `reference_id`, `idempotency_key`, `ingredient_batch_id`, `requested_by`, `approved_by`, `approved_at`, `discarded_at`, `unit`, `discard_request_id`) VALUES
(1, '2026-07-07 11:23:00', 'Sugar', 1.00, 0.00, 'Raw Material', 'production', '2026-07-07 11:23:51', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, '2026-07-07 11:31:00', 'Blueberries', 1.00, 0.00, 'Raw Material', 'expired', '2026-07-07 11:31:59', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, '2026-07-07 11:32:00', 'All-purpose Flour', 1.00, 0.00, 'Raw Material', 'unsold', '2026-07-07 11:32:17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4, '2026-07-07 11:32:00', 'Chocolate', 2.00, 0.00, 'Raw Material', 'unsold', '2026-07-07 11:32:31', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5, '2026-07-10 09:29:56', 'Chocolate Oreo Cake', 1.00, 0.00, 'Finished Product', 'Production loss', '2026-07-10 07:29:56', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(13, '2026-08-25 05:36:35', 'TEST Cake', 2.00, 20.00, 'Finished Product', 'Expired', '2026-08-25 03:36:35', NULL, NULL, NULL, 'waste', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(14, '2026-08-25 05:36:36', 'TEST Cake', 1.00, 20.00, 'Finished Product', 'Spoiled', '2026-08-25 03:36:36', NULL, NULL, NULL, 'waste', NULL, 'wtest-6a8d0dc4189e2', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(15, '2026-08-25 05:40:43', 'TEST Cake', 2.00, 20.00, 'Finished Product', 'Expired', '2026-08-25 03:40:43', NULL, NULL, NULL, 'waste', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(16, '2026-08-25 05:40:43', 'TEST Cake', 1.00, 20.00, 'Finished Product', 'Spoiled', '2026-08-25 03:40:43', NULL, NULL, NULL, 'waste', NULL, 'wtest-6a8d0ebb9e432', NULL, NULL, NULL, NULL, NULL, NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `addresses`
--
ALTER TABLE `addresses`
  ADD PRIMARY KEY (`address_id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `analytics_forecasts`
--
ALTER TABLE `analytics_forecasts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_forecast_product` (`product_name`,`forecast_date`);

--
-- Indexes for table `analytics_imports`
--
ALTER TABLE `analytics_imports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `analytics_procurement_alerts`
--
ALTER TABLE `analytics_procurement_alerts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `analytics_reorder_logs`
--
ALTER TABLE `analytics_reorder_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `analytics_sales_history`
--
ALTER TABLE `analytics_sales_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_product_date` (`product_name`,`sale_date`);

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_created` (`created_at`);

--
-- Indexes for table `customize_orders`
--
ALTER TABLE `customize_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `custom_cake_orders`
--
ALTER TABLE `custom_cake_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `daily_sales`
--
ALTER TABLE `daily_sales`
  ADD PRIMARY KEY (`sale_date`);

--
-- Indexes for table `demand_forecasts`
--
ALTER TABLE `demand_forecasts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_forecast_product_date` (`product_id`,`forecast_date`);

--
-- Indexes for table `discard_requests`
--
ALTER TABLE `discard_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ingredient_id` (`ingredient_id`),
  ADD KEY `requested_by` (`requested_by`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `rejected_by` (`rejected_by`),
  ADD KEY `idx_discard_status` (`status`,`requested_at`),
  ADD KEY `idx_discard_batch` (`ingredient_batch_id`);

--
-- Indexes for table `favorites`
--
ALTER TABLE `favorites`
  ADD PRIMARY KEY (`favorite_id`),
  ADD UNIQUE KEY `unique_favorite` (`customer_id`,`product_id`);

--
-- Indexes for table `ingredients`
--
ALTER TABLE `ingredients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ingredient_name` (`name`);

--
-- Indexes for table `ingredient_batches`
--
ALTER TABLE `ingredient_batches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ingredient_batch` (`ingredient_id`,`batch_number`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_batch_expiry` (`expiry_date`),
  ADD KEY `idx_batch_ingredient` (`ingredient_id`);

--
-- Indexes for table `ingredient_movements`
--
ALTER TABLE `ingredient_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ingredient` (`ingredient_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `fk_ingmov_user` (`user_id`),
  ADD KEY `idx_ingredient_batch` (`batch_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_unread` (`user_id`,`is_read`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order` (`order_id`),
  ADD KEY `fk_order_items_product` (`product_id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_password_resets_email` (`email`);

--
-- Indexes for table `procurement_alerts`
--
ALTER TABLE `procurement_alerts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `production_batch_allocations`
--
ALTER TABLE `production_batch_allocations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_production_batch_allocations_txn` (`production_transaction_id`),
  ADD KEY `idx_production_batch_allocations_batch` (`ingredient_batch_id`),
  ADD KEY `idx_production_batch_allocations_ingredient` (`ingredient_id`);

--
-- Indexes for table `production_transactions`
--
ALTER TABLE `production_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_production_idempotency` (`idempotency_key`),
  ADD UNIQUE KEY `uq_production_idempotency_key` (`idempotency_key`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_production_product` (`product_id`,`created_at`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_name_category` (`name`,`category`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_available` (`available`);

--
-- Indexes for table `product_inventory_movements`
--
ALTER TABLE `product_inventory_movements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_reference` (`product_id`,`product_variant_id`,`movement_type`,`reference_type`,`reference_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_product_created` (`product_id`,`created_at`),
  ADD KEY `idx_reference` (`reference_type`,`reference_id`);

--
-- Indexes for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_ingredient` (`product_id`,`ingredient_id`),
  ADD KEY `ingredient_id` (`ingredient_id`);

--
-- Indexes for table `product_sizes`
--
ALTER TABLE `product_sizes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_size` (`product_id`,`size`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `product_sizes_archive`
--
ALTER TABLE `product_sizes_archive`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `reorder_logs`
--
ALTER TABLE `reorder_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `reorder_recommendations`
--
ALTER TABLE `reorder_recommendations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_recommendation_product` (`product_id`,`recommendation_date`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `sales_daily_snapshots`
--
ALTER TABLE `sales_daily_snapshots`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sales_date_product` (`sale_date`,`product_id`),
  ADD KEY `idx_product_date` (`product_id`,`sale_date`);

--
-- Indexes for table `simulated_baselines`
--
ALTER TABLE `simulated_baselines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_baseline_product` (`product_id`,`generated_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `variance`
--
ALTER TABLE `variance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ingredient_id` (`ingredient_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `recorded_by` (`recorded_by`),
  ADD KEY `idx_date` (`recorded_date`),
  ADD KEY `idx_type` (`variance_type`);

--
-- Indexes for table `waste_log`
--
ALTER TABLE `waste_log`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_waste_idempotency` (`idempotency_key`),
  ADD KEY `fk_waste_ingredient` (`ingredient_id`),
  ADD KEY `fk_waste_product` (`product_id`),
  ADD KEY `fk_waste_user` (`user_id`),
  ADD KEY `idx_waste_discard_request` (`discard_request_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `addresses`
--
ALTER TABLE `addresses`
  MODIFY `address_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `analytics_forecasts`
--
ALTER TABLE `analytics_forecasts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `analytics_imports`
--
ALTER TABLE `analytics_imports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `analytics_procurement_alerts`
--
ALTER TABLE `analytics_procurement_alerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `analytics_reorder_logs`
--
ALTER TABLE `analytics_reorder_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `analytics_sales_history`
--
ALTER TABLE `analytics_sales_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `customize_orders`
--
ALTER TABLE `customize_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `custom_cake_orders`
--
ALTER TABLE `custom_cake_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `demand_forecasts`
--
ALTER TABLE `demand_forecasts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `discard_requests`
--
ALTER TABLE `discard_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `favorites`
--
ALTER TABLE `favorites`
  MODIFY `favorite_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `ingredients`
--
ALTER TABLE `ingredients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `ingredient_batches`
--
ALTER TABLE `ingredient_batches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `ingredient_movements`
--
ALTER TABLE `ingredient_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=151;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=161;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `procurement_alerts`
--
ALTER TABLE `procurement_alerts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `production_batch_allocations`
--
ALTER TABLE `production_batch_allocations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `production_transactions`
--
ALTER TABLE `production_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=130;

--
-- AUTO_INCREMENT for table `product_inventory_movements`
--
ALTER TABLE `product_inventory_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `product_recipes`
--
ALTER TABLE `product_recipes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `product_sizes`
--
ALTER TABLE `product_sizes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=181;

--
-- AUTO_INCREMENT for table `product_sizes_archive`
--
ALTER TABLE `product_sizes_archive`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=157;

--
-- AUTO_INCREMENT for table `reorder_logs`
--
ALTER TABLE `reorder_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reorder_recommendations`
--
ALTER TABLE `reorder_recommendations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sales_daily_snapshots`
--
ALTER TABLE `sales_daily_snapshots`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `simulated_baselines`
--
ALTER TABLE `simulated_baselines`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1000;

--
-- AUTO_INCREMENT for table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

--
-- AUTO_INCREMENT for table `variance`
--
ALTER TABLE `variance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `waste_log`
--
ALTER TABLE `waste_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `addresses`
--
ALTER TABLE `addresses`
  ADD CONSTRAINT `addresses_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `customize_orders`
--
ALTER TABLE `customize_orders`
  ADD CONSTRAINT `customize_orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `custom_cake_orders`
--
ALTER TABLE `custom_cake_orders`
  ADD CONSTRAINT `fk_custom_cake_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `discard_requests`
--
ALTER TABLE `discard_requests`
  ADD CONSTRAINT `discard_requests_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `discard_requests_ibfk_2` FOREIGN KEY (`ingredient_batch_id`) REFERENCES `ingredient_batches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `discard_requests_ibfk_3` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `discard_requests_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `discard_requests_ibfk_5` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `ingredient_batches`
--
ALTER TABLE `ingredient_batches`
  ADD CONSTRAINT `ingredient_batches_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ingredient_batches_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `ingredient_movements`
--
ALTER TABLE `ingredient_movements`
  ADD CONSTRAINT `fk_ingmov_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ingredient_movements_batch` FOREIGN KEY (`batch_id`) REFERENCES `ingredient_batches` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `ingredient_movements_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `production_batch_allocations`
--
ALTER TABLE `production_batch_allocations`
  ADD CONSTRAINT `fk_production_batch_allocations_batch` FOREIGN KEY (`ingredient_batch_id`) REFERENCES `ingredient_batches` (`id`),
  ADD CONSTRAINT `fk_production_batch_allocations_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_production_batch_allocations_production` FOREIGN KEY (`production_transaction_id`) REFERENCES `production_transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `production_transactions`
--
ALTER TABLE `production_transactions`
  ADD CONSTRAINT `production_transactions_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `production_transactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `product_inventory_movements`
--
ALTER TABLE `product_inventory_movements`
  ADD CONSTRAINT `product_inventory_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_inventory_movements_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD CONSTRAINT `product_recipes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_recipes_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `product_sizes`
--
ALTER TABLE `product_sizes`
  ADD CONSTRAINT `product_sizes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `variance`
--
ALTER TABLE `variance`
  ADD CONSTRAINT `variance_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `variance_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `variance_ibfk_3` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `waste_log`
--
ALTER TABLE `waste_log`
  ADD CONSTRAINT `fk_waste_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_waste_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_waste_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
