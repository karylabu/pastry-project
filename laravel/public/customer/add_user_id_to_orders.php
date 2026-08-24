<?php
/**
 * Migration: Add user_id foreign key to orders table
 * Run once to add the user_id column and establish relationship with users table
 */

$conn = mysqli_connect("localhost", "root", "", "pastry_db");
if (!$conn) {
    die("Database connection failed: " . mysqli_connect_error());
}

try {
    // Check if user_id column already exists
    $result = mysqli_query($conn, "SHOW COLUMNS FROM orders LIKE 'user_id'");
    if (mysqli_num_rows($result) > 0) {
        echo "Column 'user_id' already exists. No changes needed.\n";
        exit;
    }

    // Add user_id column after email
    $sql = "ALTER TABLE orders ADD COLUMN user_id INT DEFAULT NULL AFTER email";
    if (mysqli_query($conn, $sql)) {
        echo "✓ Added user_id column to orders table\n";
    } else {
        throw new Exception("Failed to add user_id column: " . mysqli_error($conn));
    }

    // Add foreign key constraint
    $fkSql = "ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL";
    if (mysqli_query($conn, $fkSql)) {
        echo "✓ Added foreign key constraint (user_id -> users.id)\n";
    } else {
        // Constraint might already exist, that's okay
        echo "! Foreign key constraint may already exist or couldn't be added: " . mysqli_error($conn) . "\n";
    }

    // Add index for faster queries
    $indexSql = "ALTER TABLE orders ADD INDEX idx_user_id (user_id)";
    if (mysqli_query($conn, $indexSql)) {
        echo "✓ Added index on user_id for performance\n";
    } else {
        echo "! Index already exists or couldn't be added\n";
    }

    echo "\n✓ Migration completed successfully!\n";

} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
} finally {
    mysqli_close($conn);
}
?>
