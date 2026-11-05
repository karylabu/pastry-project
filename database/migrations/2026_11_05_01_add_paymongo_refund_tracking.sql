ALTER TABLE orders
    ADD COLUMN refund_reference VARCHAR(255) DEFAULT NULL,
    ADD COLUMN refund_status VARCHAR(32) DEFAULT NULL,
    ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT NULL,
    MODIFY status ENUM(
        'Awaiting Payment',
        'Awaiting Balance Payment',
        'Pending',
        'Confirmed',
        'Preparing',
        'Ready for Pickup',
        'Completed',
        'Return/Refund',
        'Cancellation Pending',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending';
