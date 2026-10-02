UPDATE products AS p
LEFT JOIN product_sizes AS ps
    ON ps.product_id = p.id
    AND LOWER(TRIM(ps.size)) = 'big'
SET p.price = CASE
    WHEN COALESCE(ps.price, 0) > 0 THEN ps.price
    WHEN COALESCE(p.big_price, 0) > 0 THEN p.big_price
    ELSE p.price
END
WHERE LOWER(TRIM(p.category)) IN ('cake', 'cakes')
    AND COALESCE(p.price, 0) <= 0
    AND (COALESCE(ps.price, 0) > 0 OR COALESCE(p.big_price, 0) > 0);