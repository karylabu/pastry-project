<?php

require_once __DIR__ . '/cors.php';

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed");
    }

    if (empty($_SESSION['user'])) {
        // Fallback for mobile apps that might not handle sessions automatically
        if (isset($_GET['user_id'])) {
            $user_id = (int)$_GET['user_id'];
        } else if (isset($_POST['user_id'])) {
            $user_id = (int)$_POST['user_id'];
        } else {
            echo json_encode([
                "status" => "error",
                "message" => "Not logged in"
            ]);
            exit;
        }
    } else {
        $user_id = (int)$_SESSION['user']['id'];
    }

    // Get user info
    $sql = "SELECT id, name, email, role, phone, address, city, postal_code, profile_image FROM users WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception("User not found");
    }

    $user = $result->fetch_assoc();

    echo json_encode([
        "status" => "success",
        "user" => $user
    ]);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}

?>
