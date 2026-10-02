-- Add the post-payment pickup-ready state for customized cake orders.
USE pastry_db;

ALTER TABLE orders
    MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','To Receive','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending';