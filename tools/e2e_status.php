<?php
// E2E integration pass: environment + data status snapshot
$conn = @new mysqli("localhost", "root", "", "pastry_db");
if ($conn->connect_error) {
    echo "DB_FAIL: " . $conn->connect_error . PHP_EOL;
    exit(1);
}
echo "DB_OK" . PHP_EOL;

function q(mysqli $c, string $sql): array {
    $r = $c->query($sql);
    if ($r === false) { return [["ERR" => $c->error]]; }
    return $r->fetch_all(MYSQLI_ASSOC);
}

function dump(string $title, array $rows): void {
    echo "=== {$title} ===" . PHP_EOL;
    foreach ($rows as $row) {
        echo json_encode($row) . PHP_EOL;
    }
    if (!$rows) echo "(empty)" . PHP_EOL;
}

dump("ingredients", q($conn, "SELECT id,name,unit,stock,min_stock,unit_cost FROM ingredients ORDER BY id"));
dump("products", q($conn, "SELECT id,name,category,stock,minimum_stock,price,production_cost FROM products ORDER BY id"));
dump("product_recipes", q($conn, "SELECT * FROM product_recipes ORDER BY product_id"));
dump("users", q($conn, "SELECT id,name,email,role FROM users ORDER BY id LIMIT 20"));
dump("orders_recent", q($conn, "SELECT id,customer,status,total_price,created_at FROM orders ORDER BY id DESC LIMIT 5"));
dump("tables", array_map(fn($r) => array_values($r)[0], q($conn,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='pastry_db' ORDER BY table_name")));
$conn->close();
