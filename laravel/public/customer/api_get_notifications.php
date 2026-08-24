<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

require_once __DIR__ . '/cors.php';

error_reporting(0);
ini_set('display_errors', 0);

// Get user_id from query string
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;

if (!$user_id) {
  error_log("api_get_notifications.php: No user_id provided");
  echo json_encode([]);
  exit;
}

try {
  // Connect to database
  $conn = mysqli_connect("localhost", "root", "", "pastry_db");
  if (!$conn) {
    error_log("api_get_notifications.php: Database Connection Failed: " . mysqli_connect_error());
    throw new Exception("Database Connection Failed: " . mysqli_connect_error());
  }

  // Check if notifications table exists
  $checkTable = mysqli_query($conn, "SHOW TABLES LIKE 'notifications'");
  if (!$checkTable || mysqli_num_rows($checkTable) === 0) {
    error_log("api_get_notifications.php: notifications table does not exist");
    echo json_encode([]);
    mysqli_close($conn);
    exit;
  }

  $sql = "
    SELECT id, user_id, title, message, type, is_read, action_url, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  ";
  
  $stmt = mysqli_prepare($conn, $sql);
  if (!$stmt) {
    error_log("api_get_notifications.php: Prepare failed: " . mysqli_error($conn));
    throw new Exception("Prepare failed: " . mysqli_error($conn));
  }
  
  mysqli_stmt_bind_param($stmt, "i", $user_id);
  
  if (!mysqli_stmt_execute($stmt)) {
    error_log("api_get_notifications.php: Execute failed: " . mysqli_stmt_error($stmt));
    throw new Exception("Execute failed: " . mysqli_stmt_error($stmt));
  }
  
  $result = mysqli_stmt_get_result($stmt);
  $notifications = [];
  
  while ($row = mysqli_fetch_assoc($result)) {
    $notifications[] = [
      'id' => $row['id'],
      'user_id' => $row['user_id'],
      'title' => $row['title'],
      'message' => $row['message'],
      'type' => $row['type'],
      'read' => $row['is_read'] == 1,
      'action_url' => $row['action_url'],
      'created_at' => $row['created_at']
    ];
  }
  
  error_log("api_get_notifications.php: Found " . count($notifications) . " notifications for user_id " . $user_id);
  
  mysqli_stmt_close($stmt);
  echo json_encode($notifications);
  
} catch (Exception $e) {
  error_log("api_get_notifications.php: Exception - " . $e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}

mysqli_close($conn);
?>

