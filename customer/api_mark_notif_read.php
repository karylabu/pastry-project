<?php
require_once __DIR__ . '/cors.php';

error_reporting(0);
ini_set('display_errors', 0);

session_start();

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    if (empty($_POST['notification_id'])) {
        throw new Exception("Notification ID is required");
    }

    $notification_id = intval($_POST['notification_id']);
    
    // Mark notification as read in notifications table
    $sql = "UPDATE notifications SET is_read = 1 WHERE id = ?";
    $stmt = mysqli_prepare($conn, $sql);
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . mysqli_error($conn));
    }
    
    mysqli_stmt_bind_param($stmt, "i", $notification_id);
    
    if (!mysqli_stmt_execute($stmt)) {
        throw new Exception("Failed to update notification: " . mysqli_stmt_error($stmt));
    }

    echo json_encode([
        "status" => "success",
        "message" => "Notification marked as read"
    ]);

    mysqli_stmt_close($stmt);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}

mysqli_close($conn);
?>

