-- Add the custom cake remaining-balance payment review state.
USE pastry_db;

ALTER TABLE orders
    MODIFY status ENUM('Awaiting Payment','Awaiting Balance Payment','Pending','Confirmed','Preparing','To Receive','Completed','Cancelled') NOT NULL DEFAULT 'Pending';