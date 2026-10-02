-- Replace the legacy To Receive value with Ready for Pickup.
USE pastry_db;

UPDATE orders SET status = 'Ready for Pickup' WHERE status = 'To Receive';

ALTER TABLE orders
    MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending';