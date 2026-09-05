-- Allow customer support conversations that are not tied to an order.
ALTER TABLE messages
    MODIFY order_id INT NULL;