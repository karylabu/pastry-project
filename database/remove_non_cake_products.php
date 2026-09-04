<?php

require_once __DIR__ . '/../includes/db.php';

if (!$conn) {
    fwrite(STDERR, "Database connection failed: {$db_error}\n");
    exit(1);
}

$keepCategories = ["cakes", "customize cakes", "customized cakes", "custom cake", "custom cakes"];
$keepList = "'" . implode("','", array_map([$conn, 'real_escape_string'], $keepCategories)) . "'";

$categoryQuery = "SELECT category, COUNT(*) AS total FROM products GROUP BY category ORDER BY category";
$categoryResult = mysqli_query($conn, $categoryQuery);
if (!$categoryResult) {
    fwrite(STDERR, "Could not inspect products: " . mysqli_error($conn) . "\n");
    exit(1);
}

echo "Current product categories:\n";
while ($row = mysqli_fetch_assoc($categoryResult)) {
    echo "- " . ($row['category'] ?? 'NULL') . ": " . $row['total'] . "\n";
}

$countQuery = "SELECT COUNT(*) AS total FROM products WHERE LOWER(TRIM(category)) NOT IN ($keepList)";
$countResult = mysqli_query($conn, $countQuery);
$deleteCount = (int) mysqli_fetch_assoc($countResult)['total'];
echo "Non-cake products to remove: {$deleteCount}\n";
echo "Kept categories: " . implode(', ', $keepCategories) . "\n";

$dependentTables = [
    'order_items' => 'product_id',
    'favorites' => 'product_id',
    'reviews' => 'product_id',
    'product_inventory_movements' => 'product_id',
    'production_transactions' => 'product_id',
    'waste_log' => 'product_id',
    'variance' => 'product_id',
    'product_recipes' => 'product_id',
    'product_sizes' => 'product_id',
];

foreach ($dependentTables as $table => $column) {
    $dependencyQuery = "SELECT COUNT(*) AS total FROM `{$table}` d INNER JOIN products p ON p.id = d.`{$column}` WHERE LOWER(TRIM(p.category)) NOT IN ($keepList)";
    $dependencyResult = mysqli_query($conn, $dependencyQuery);
    if ($dependencyResult) {
        $dependencyCount = (int) mysqli_fetch_assoc($dependencyResult)['total'];
        if ($dependencyCount > 0) {
            echo "Referenced by {$table}: {$dependencyCount}\n";
        }
    }
}

$blockingQuery = "SELECT p.id, p.name, p.category, COUNT(pt.id) AS production_records FROM products p INNER JOIN production_transactions pt ON pt.product_id = p.id WHERE LOWER(TRIM(p.category)) NOT IN ($keepList) GROUP BY p.id, p.name, p.category ORDER BY p.id";
$blockingResult = mysqli_query($conn, $blockingQuery);
if ($blockingResult && mysqli_num_rows($blockingResult) > 0) {
    echo "Products blocked by production history:\n";
    while ($row = mysqli_fetch_assoc($blockingResult)) {
        echo "- #{$row['id']} {$row['name']} ({$row['category']}): {$row['production_records']} record(s)\n";
    }
}

if (($argv[1] ?? '') !== '--execute') {
    echo "Dry run only. Re-run with --execute to delete these products.\n";
    exit(0);
}

mysqli_begin_transaction($conn);

$deleteQuery = "DELETE FROM products WHERE LOWER(TRIM(category)) NOT IN ($keepList)";
if (!mysqli_query($conn, "DELETE pt FROM production_transactions pt INNER JOIN products p ON p.id = pt.product_id WHERE LOWER(TRIM(p.category)) NOT IN ($keepList)")) {
    mysqli_rollback($conn);
    fwrite(STDERR, "Production history cleanup failed: " . mysqli_error($conn) . "\n");
    exit(1);
}

if (!mysqli_query($conn, $deleteQuery)) {
    mysqli_rollback($conn);
    fwrite(STDERR, "Product deletion failed: " . mysqli_error($conn) . "\n");
    exit(1);
}

$deletedProducts = mysqli_affected_rows($conn);
mysqli_commit($conn);
echo "Deleted {$deletedProducts} non-cake products.\n";
