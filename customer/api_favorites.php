<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/db.php';

error_reporting(0);
ini_set('display_errors', 0);

try {
    if (!$conn) {
        throw new Exception('Database Connection Failed: ' . mysqli_connect_error());
    }

    mysqli_query($conn, "CREATE TABLE IF NOT EXISTS favorites (
        favorite_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_favorite (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $method = $_SERVER['REQUEST_METHOD'];
    $user_id = 0;

    if ($method === 'GET') {
        $user_id = intval($_GET['user_id'] ?? 0);
    } else {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $user_id = intval($body['user_id'] ?? $_GET['user_id'] ?? 0);
    }

    if ($user_id <= 0) {
        throw new Exception('User ID is required');
    }

    if ($method === 'GET') {
        $sql = "SELECT product_id FROM favorites WHERE customer_id = ? ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $productIds = [];
        while ($row = $result->fetch_assoc()) {
            $productIds[] = intval($row['product_id']);
        }

        echo json_encode(['status' => 'success', 'favorites' => $productIds]);
        exit;
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $product_id = intval($body['product_id'] ?? 0);
        $favorite = isset($body['favorite']) ? boolval($body['favorite']) : null;

        if ($product_id <= 0 || $favorite === null) {
            throw new Exception('product_id and favorite are required');
        }

        if ($favorite) {
            $sql = "INSERT IGNORE INTO favorites (customer_id, product_id) VALUES (?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('ii', $user_id, $product_id);
            if (!$stmt->execute()) {
                throw new Exception('Unable to save favorite.');
            }
        } else {
            $sql = "DELETE FROM favorites WHERE customer_id = ? AND product_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('ii', $user_id, $product_id);
            if (!$stmt->execute()) {
                throw new Exception('Unable to remove favorite.');
            }
        }

        $sql = "SELECT product_id FROM favorites WHERE customer_id = ? ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $productIds = [];
        while ($row = $result->fetch_assoc()) {
            $productIds[] = intval($row['product_id']);
        }

        echo json_encode(['status' => 'success', 'favorites' => $productIds]);
        exit;
    }

    throw new Exception('Unsupported request method.');
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
