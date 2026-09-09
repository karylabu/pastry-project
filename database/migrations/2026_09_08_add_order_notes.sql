-- Add checkout notes used by customer/api_orders.php and staff order history.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS notes TEXT NULL;
