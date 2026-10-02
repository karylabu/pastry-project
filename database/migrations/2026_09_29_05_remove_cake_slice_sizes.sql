-- Remove Slice from the active cake catalog while preserving historical orders and archives.
USE pastry_db;

DELETE product_size
FROM product_sizes AS product_size
JOIN products AS product ON product.id = product_size.product_id
WHERE LOWER(product_size.size) = 'slice'
  AND LOWER(product.category) IN ('cake', 'cakes');

UPDATE products
SET slice_price = 0
WHERE LOWER(category) IN ('cake', 'cakes');