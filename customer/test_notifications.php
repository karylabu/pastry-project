<?php
// Test endpoint to verify notification API is working

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;

// Log the request
error_log("Test notification API - user_id: " . ($user_id ? $user_id : 'NULL'));

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id parameter is required']);
    exit;
}

try {
    // Connect to database
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . mysqli_connect_error()]);
        exit;
    }

    // Check if notifications table exists
    $checkTable = mysqli_query($conn, "SHOW TABLES LIKE 'notifications'");
    if (!$checkTable || mysqli_num_rows($checkTable) === 0) {
        http_response_code(500);
        echo json_encode(['error' => 'notifications table does not exist']);
        mysqli_close($conn);
        exit;
    }

    // Query notifications
    $sql = "SELECT id, user_id, title, message, type, is_read, action_url, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50";
    $stmt = mysqli_prepare($conn, $sql);
    
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'Prepare failed: ' . mysqli_error($conn)]);
        mysqli_close($conn);
        exit;
    }

    mysqli_stmt_bind_param($stmt, "i", $user_id);
    
    if (!mysqli_stmt_execute($stmt)) {
        http_response_code(500);
        echo json_encode(['error' => 'Execute failed: ' . mysqli_stmt_error($stmt)]);
        mysqli_close($conn);
        exit;
    }

    $result = mysqli_stmt_get_result($stmt);
    $notifications = [];

    while ($row = mysqli_fetch_assoc($result)) {
        $notifications[] = [
            'id' => intval($row['id']),
            'user_id' => intval($row['user_id']),
            'title' => $row['title'],
            'message' => $row['message'],
            'type' => $row['type'],
            'read' => $row['is_read'] == 1,
            'action_url' => $row['action_url'],
            'created_at' => $row['created_at']
        ];
    }

    mysqli_stmt_close($stmt);
    mysqli_close($conn);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'count' => count($notifications),
        'data' => $notifications
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Exception: ' . $e->getMessage()]);
}
?>
