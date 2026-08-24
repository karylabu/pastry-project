<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

/* ================= DATABASE CONNECTION ================= */

$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

/* ================= GET USERS ================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $sql = "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC";
    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode([
            "status" => "error",
            "message" => $conn->error
        ]);
        exit;
    }

    $users = [];

    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    echo json_encode($users);
    exit;
}

/* ================= DELETE USER ================= */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $data = json_decode(file_get_contents("php://input"), true);

    $action = $data['action'] ?? '';
    $user_id = intval($data['user_id'] ?? 0);

    if ($action === 'delete' && $user_id) {
        $sql = "DELETE FROM users WHERE id=$user_id";

        if ($conn->query($sql)) {
            echo json_encode([
                "status" => "success",
                "message" => "User deleted"
            ]);
        } else {
            echo json_encode([
                "status" => "error",
                "message" => $conn->error
            ]);
        }
        exit;
    }

    echo json_encode([
        "status" => "error",
        "message" => "Invalid action"
    ]);
    exit;
}

?>
