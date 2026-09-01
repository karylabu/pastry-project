-- Fictional development data only. Never add production or personal data here.
-- Demo password for these accounts: password

INSERT INTO users (name, email, password, role) VALUES
('Demo Shop Owner', 'demo-admin@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Demo Staff User', 'demo-staff@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff'),
('Demo Customer', 'demo-customer@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO products (name, category, price, stock, image, description, available) VALUES
('Chocolate Lava Cake', 'Cakes', 350.00, 15, 'cake.jpg', 'Rich molten chocolate center', 1),
('Strawberry Tart', 'Pastries', 180.00, 22, 'tart.jpg', 'Fresh strawberries on custard', 1),
('Croissant', 'Bread', 95.00, 30, 'croissant.jpg', 'Buttery, flaky French croissant', 1),
('Blueberry Muffin', 'Muffins', 120.00, 18, 'muffin.jpg', 'Loaded with blueberries', 1);

INSERT INTO ingredients (name, unit, stock, threshold, expiry) VALUES
('All-purpose Flour', 'kg', 25.000, 5.000, '2030-08-30'),
('Butter', 'kg', 8.000, 2.000, '2030-05-15'),
('Sugar', 'kg', 20.000, 4.000, '2030-01-01'),
('Eggs', 'pcs', 120.000, 24.000, '2030-05-10');

INSERT INTO orders (id, customer, email, type, status, total, payment, address, order_date) VALUES
(9001, 'Demo Customer', 'demo-customer@example.com', 'Standard', 'Completed', 445.00, 'COD', '123 Sample Street, Demo City', '2030-05-01');

INSERT INTO order_items (order_id, product, qty, price) VALUES
(9001, 'Chocolate Lava Cake', 1, 350.00),
(9001, 'Croissant', 1, 95.00);

INSERT INTO daily_sales (sale_date, total) VALUES
('2030-05-01', 445.00)
ON DUPLICATE KEY UPDATE total = VALUES(total);