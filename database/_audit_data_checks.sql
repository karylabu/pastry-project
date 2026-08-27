-- ============================================================
-- Data integrity audit queries (read-only). Run against pastry_db.
-- ============================================================
USE pastry_db;

SELECT '=== ROW COUNTS ===' AS section;
SELECT 'addresses' t, COUNT(*) c FROM addresses
UNION ALL SELECT 'analytics_imports', COUNT(*) FROM analytics_imports
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL SELECT 'custom_cake_orders', COUNT(*) FROM custom_cake_orders
UNION ALL SELECT 'daily_sales', COUNT(*) FROM daily_sales
UNION ALL SELECT 'demand_forecasts', COUNT(*) FROM demand_forecasts
UNION ALL SELECT 'favorites', COUNT(*) FROM favorites
UNION ALL SELECT 'ingredient_movements', COUNT(*) FROM ingredient_movements
UNION ALL SELECT 'ingredients', COUNT(*) FROM ingredients
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'password_resets', COUNT(*) FROM password_resets
UNION ALL SELECT 'procurement_alerts', COUNT(*) FROM procurement_alerts
UNION ALL SELECT 'product_inventory_movements', COUNT(*) FROM product_inventory_movements
UNION ALL SELECT 'product_recipes', COUNT(*) FROM product_recipes
UNION ALL SELECT 'product_sizes', COUNT(*) FROM product_sizes
UNION ALL SELECT 'production_transactions', COUNT(*) FROM production_transactions
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'reorder_logs', COUNT(*) FROM reorder_logs
UNION ALL SELECT 'reorder_recommendations', COUNT(*) FROM reorder_recommendations
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'sales_daily_snapshots', COUNT(*) FROM sales_daily_snapshots
UNION ALL SELECT 'simulated_baselines', COUNT(*) FROM simulated_baselines
UNION ALL SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'variance', COUNT(*) FROM variance
UNION ALL SELECT 'waste_log', COUNT(*) FROM waste_log;

SELECT '=== ORPHANS ===' AS section;
SELECT 'order_items->orders' chk, COUNT(*) cnt FROM order_items oi LEFT JOIN orders o ON oi.order_id=o.id WHERE oi.order_id IS NOT NULL AND o.id IS NULL
UNION ALL SELECT 'order_items->products', COUNT(*) FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id WHERE oi.product_id IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'custom_cake_orders->orders', COUNT(*) FROM custom_cake_orders c LEFT JOIN orders o ON c.order_id=o.id WHERE o.id IS NULL
UNION ALL SELECT 'messages->orders', COUNT(*) FROM messages m LEFT JOIN orders o ON m.order_id=o.id WHERE o.id IS NULL
UNION ALL SELECT 'favorites->users', COUNT(*) FROM favorites f LEFT JOIN users u ON f.customer_id=u.id WHERE u.id IS NULL
UNION ALL SELECT 'favorites->products', COUNT(*) FROM favorites f LEFT JOIN products p ON f.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'reviews->products', COUNT(*) FROM reviews r LEFT JOIN products p ON r.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'reviews->users', COUNT(*) FROM reviews r LEFT JOIN users u ON r.customer_id=u.id WHERE u.id IS NULL
UNION ALL SELECT 'addresses->users', COUNT(*) FROM addresses a LEFT JOIN users u ON a.customer_id=u.id WHERE u.id IS NULL
UNION ALL SELECT 'user_sessions->users', COUNT(*) FROM user_sessions s LEFT JOIN users u ON s.user_id=u.id WHERE u.id IS NULL
UNION ALL SELECT 'notifications->users', COUNT(*) FROM notifications n LEFT JOIN users u ON n.user_id=u.id WHERE u.id IS NULL
UNION ALL SELECT 'ingredient_movements->ingredients', COUNT(*) FROM ingredient_movements im LEFT JOIN ingredients i ON im.ingredient_id=i.id WHERE i.id IS NULL
UNION ALL SELECT 'ingredient_movements->users', COUNT(*) FROM ingredient_movements im LEFT JOIN users u ON im.user_id=u.id WHERE im.user_id IS NOT NULL AND u.id IS NULL
UNION ALL SELECT 'pim->products', COUNT(*) FROM product_inventory_movements m LEFT JOIN products p ON m.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'pim->users', COUNT(*) FROM product_inventory_movements m LEFT JOIN users u ON m.user_id=u.id WHERE m.user_id IS NOT NULL AND u.id IS NULL
UNION ALL SELECT 'pim->variant(nonnull)', COUNT(*) FROM product_inventory_movements WHERE product_variant_id IS NOT NULL
UNION ALL SELECT 'production->products', COUNT(*) FROM production_transactions pt LEFT JOIN products p ON pt.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'waste->ingredients', COUNT(*) FROM waste_log w LEFT JOIN ingredients i ON w.ingredient_id=i.id WHERE w.ingredient_id IS NOT NULL AND i.id IS NULL
UNION ALL SELECT 'waste->products', COUNT(*) FROM waste_log w LEFT JOIN products p ON w.product_id=p.id WHERE w.product_id IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'variance->ingredients', COUNT(*) FROM variance v LEFT JOIN ingredients i ON v.ingredient_id=i.id WHERE v.ingredient_id IS NOT NULL AND i.id IS NULL
UNION ALL SELECT 'variance->products', COUNT(*) FROM variance v LEFT JOIN products p ON v.product_id=p.id WHERE v.product_id IS NOT NULL AND p.id IS NULL
UNION ALL SELECT 'recipes->products', COUNT(*) FROM product_recipes r LEFT JOIN products p ON r.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'recipes->ingredients', COUNT(*) FROM product_recipes r LEFT JOIN ingredients i ON r.ingredient_id=i.id WHERE i.id IS NULL
UNION ALL SELECT 'demand_forecasts->products', COUNT(*) FROM demand_forecasts d LEFT JOIN products p ON d.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'reorder_recs->products', COUNT(*) FROM reorder_recommendations r LEFT JOIN products p ON r.product_id=p.id WHERE p.id IS NULL
UNION ALL SELECT 'reorder_recs->ingredients', COUNT(*) FROM reorder_recommendations r LEFT JOIN ingredients i ON r.ingredient_id=i.id WHERE i.id IS NULL
UNION ALL SELECT 'reorder_logs->recs', COUNT(*) FROM reorder_logs l LEFT JOIN reorder_recommendations r ON l.recommendation_id=r.id WHERE l.recommendation_id IS NOT NULL AND r.id IS NULL
UNION ALL SELECT 'snapshots->imports', COUNT(*) FROM sales_daily_snapshots s LEFT JOIN analytics_imports a ON s.import_id=a.id WHERE s.import_id IS NOT NULL AND a.id IS NULL;

SELECT '=== NEGATIVE / INVALID QUANTITIES ===' AS section;
SELECT 'negative ingredient stock' chk, COUNT(*) cnt FROM ingredients WHERE stock < 0
UNION ALL SELECT 'negative product stock', COUNT(*) FROM products WHERE stock < 0
UNION ALL SELECT 'zero/neg recipe qty', COUNT(*) FROM product_recipes WHERE qty <= 0
UNION ALL SELECT 'neg movement qty (ing)', COUNT(*) FROM ingredient_movements WHERE qty <= 0
UNION ALL SELECT 'neg movement qty (prod)', COUNT(*) FROM product_inventory_movements WHERE quantity <= 0
UNION ALL SELECT 'neg order item qty', COUNT(*) FROM order_items WHERE qty <= 0
UNION ALL SELECT 'neg order total', COUNT(*) FROM orders WHERE total < 0
UNION ALL SELECT 'neg waste qty', COUNT(*) FROM waste_log WHERE qty <= 0
UNION ALL SELECT 'neg production qty', COUNT(*) FROM production_transactions WHERE quantity <= 0;

SELECT '=== DUPLICATES ===' AS section;
SELECT 'duplicate user emails' chk, COUNT(*) cnt FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*)>1) x
UNION ALL SELECT 'duplicate product names', COUNT(*) FROM (SELECT name FROM products GROUP BY name HAVING COUNT(*)>1) x
UNION ALL SELECT 'duplicate ingredient names', COUNT(*) FROM (SELECT name FROM ingredients GROUP BY name HAVING COUNT(*)>1) x
UNION ALL SELECT 'duplicate product_sizes (product,size)', COUNT(*) FROM (SELECT product_id,size FROM product_sizes GROUP BY product_id,size HAVING COUNT(*)>1) x
UNION ALL SELECT 'duplicate active recipes per product+ing', COUNT(*) FROM (SELECT product_id,ingredient_id FROM product_recipes WHERE active=1 GROUP BY product_id,ingredient_id HAVING COUNT(*)>1) x
UNION ALL SELECT 'duplicate daily_sales dates', COUNT(*) FROM (SELECT sale_date FROM daily_sales GROUP BY sale_date HAVING COUNT(*)>1) x;

SELECT '=== STOCK RECONCILIATION (products) ===' AS section;
SELECT p.id, p.name, p.stock AS current_stock,
       COALESCE(m.net,0) AS net_from_movements,
       p.stock - COALESCE(m.net,0) AS drift
FROM products p
LEFT JOIN (
    SELECT product_id,
           SUM(CASE WHEN movement_type IN ('production','stock_in','restock','adjustment_in','return') THEN quantity
                    WHEN movement_type IN ('sale','stock_out','waste','damage','adjustment_out') THEN -quantity
                    ELSE 0 END) AS net
    FROM product_inventory_movements
    GROUP BY product_id
) m ON m.product_id = p.id
WHERE p.stock <> COALESCE(m.net,0)
ORDER BY ABS(p.stock - COALESCE(m.net,0)) DESC
LIMIT 30;

SELECT '=== MOVEMENT TYPES IN USE ===' AS section;
SELECT movement_type, COUNT(*) cnt FROM product_inventory_movements GROUP BY movement_type;
SELECT action, COUNT(*) cnt FROM ingredient_movements GROUP BY action;

SELECT '=== PRODUCT SIZES USAGE ===' AS section;
SELECT ps.size, COUNT(*) cnt, MIN(ps.price) min_p, MAX(ps.price) max_p
FROM product_sizes ps GROUP BY ps.size;
SELECT 'products with sizes' chk, COUNT(DISTINCT product_id) cnt FROM product_sizes;
SELECT 'legacy price cols populated' chk,
  SUM(slice_price>0) slice_, SUM(small_price>0) small_, SUM(big_price>0) big_,
  SUM(meal_price>0) meal_, SUM(combo_price>0) combo_,
  SUM(solo_price IS NOT NULL) solo_, SUM(sharing_price IS NOT NULL) sharing_
FROM products;

SELECT '=== ORDER ITEMS vs ORDERS.ITEMS JSON ===' AS section;
SELECT 'orders with items json' chk, COUNT(*) cnt FROM orders WHERE items IS NOT NULL AND JSON_LENGTH(items)>0
UNION ALL SELECT 'orders with order_items rows', COUNT(DISTINCT order_id) FROM order_items WHERE order_id IS NOT NULL
UNION ALL SELECT 'order_items null order_id', COUNT(*) FROM order_items WHERE order_id IS NULL;

SELECT '=== AUDIT_LOG PK CHECK ===' AS section;
SELECT COUNT(*) total_rows, COUNT(DISTINCT id) distinct_ids FROM audit_log;

SELECT '=== USERS ROLE DISTRIBUTION ===' AS section;
SELECT role, COUNT(*) cnt FROM users GROUP BY role;