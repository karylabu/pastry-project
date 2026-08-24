# Setup Instructions for Customized Orders Feature

## Database Setup

### Option 1: Via phpMyAdmin or MySQL CLI
Copy and paste the SQL from `create_customize_orders.sql` into your MySQL interface:

```sql
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
```

### Option 2: Via Admin Script
Visit this URL to auto-create the table:
`http://yourserver/customer/admin_init_db.php`

This will automatically create the table if it doesn't exist.

## API Endpoints

### Create/Submit Custom Cake Order
**POST** `/customer/api_custom_cake.php`

Saves to both `orders` and `customize_orders` tables.

### Fetch User's Customized Orders
**GET** `/customer/api_customize_orders.php?user_id={userId}`

Returns list of all customized orders for a user with their status.

## Features Implemented

### Backend (PHP APIs)
- ✅ `api_custom_cake.php` - Saves custom cake requests to both `orders` and `customize_orders` tables
- ✅ `api_customize_orders.php` - Fetches user's customized orders with auto-table creation
- ✅ Database auto-initialization if table doesn't exist

### Flutter Frontend
- ✅ **My Orders Tab** - Shows all user's customized cake orders with:
  - Order status (Pending, Confirmed, In Progress, Ready, Completed, Cancelled)
  - Cake details (flavor, size, servings, color, etc.)
  - Customization details (theme, frosting, add-ons)
  - Delivery information
  - Estimated price

- ✅ **New Request Tab** - Form with validation for:
  - Contact Information (Name, Phone, Email)
  - Schedule & Delivery (Date, Time, Method, Address)
  - Cake Specifications (Size, Servings, Flavor, Filling, Frosting)
  - Design & Theme (Theme, Colors, Message) - **All required fields**
  - Add-ons (checkboxes)
  - Reference Images (file picker)

- ✅ Form Validation:
  - All required fields must be filled
  - Email must be valid
  - Phone number required
  - Date and time required
  - Custom size required if selected
  - Servings must be valid number > 0
  - **Theme, Colors, and Message must be filled**

## Status Codes
- **Pending** - Order submitted, awaiting admin confirmation
- **Confirmed** - Admin confirmed the order
- **In Progress** - Cake being prepared
- **Ready** - Ready for pickup/delivery
- **Completed** - Order delivered/picked up
- **Cancelled** - Order cancelled

## Usage Flow

1. User fills the custom cake request form on "New Request" tab
2. All validations must pass before submission
3. Form data sent to `api_custom_cake.php`
4. Order saved to `customize_orders` table
5. User can view all orders on "My Orders" tab
6. Orders show current status and all details
