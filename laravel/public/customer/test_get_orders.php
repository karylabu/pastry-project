<?php
require_once __DIR__ . '/cors.php';

error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: application/json');

try {
    // Connect to database
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    // Get filter parameters
    $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
    $user_email = trim($_GET['user_email'] ?? '');
    $customer_name = trim($_GET['customer'] ?? '');

    $filters = [];

    if ($user_id > 0) {
        $filters[] = "user_id = " . intval($user_id);
    }
    if ($user_email !== '') {
        $escapedEmail = mysqli_real_escape_string($conn, $user_email);
        $filters[] = "(email = '$escapedEmail' OR customer = '$escapedEmail')";
    }
    if ($customer_name !== '') {
        $escapedCustomer = mysqli_real_escape_string($conn, $customer_name);
        $filters[] = "customer = '$escapedCustomer'";
    }

    if (count($filters) > 0) {
        $sql = "SELECT * FROM orders WHERE " . implode(' OR ', $filters) . " ORDER BY created_at DESC";
    } else {
        $sql = "SELECT * FROM orders ORDER BY created_at DESC";
    }
    
    $res = mysqli_query($conn, $sql);

    if (!$res) {
        throw new Exception("SQL Error: " . mysqli_error($conn));
    }

    $orders = [];
    while ($row = mysqli_fetch_assoc($res)) {
        // Simplify for debugging
        $orders[] = [
            'id' => $row['id'],
            'user_id' => $row['user_id'],
            'customer' => $row['customer'],
            'email' => $row['email'],
            'total' => $row['total'],
            'status' => $row['status'] ?? 'Pending',
            'created_at' => $row['created_at'],
            'items' => isset($row['items']) ? (is_array(json_decode($row['items'], true)) ? json_decode($row['items'], true) : []) : []
        ];
    }

    echo json_encode([
        'status' => 'success',
        'orders' => $orders,
        'count' => count($orders),
        'debug' => [
            'user_id' => $user_id,
            'email' => $user_email,
            'customer' => $customer_name,
            'filters_applied' => $filters,
            'sql' => $sql
        ]
    ], JSON_PRETTY_PRINT);

    $conn->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
