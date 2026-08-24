<?php
require_once __DIR__ . '/../includes/db.php';
if (!$conn) {
    die(json_encode(["success" => false, "message" => "DB Connection failed"]));
}
// check if reply_to_id column exists
$result = $conn->query("SHOW COLUMNS FROM messages LIKE 'reply_to_id'");
if ($result->num_rows == 0) {
    // Add column
    if ($conn->query("ALTER TABLE messages ADD COLUMN reply_to_id INT NULL DEFAULT NULL AFTER is_read")) {
        echo "reply_to_id column added successfully.\n";
        // Add foreign key
        if ($conn->query("ALTER TABLE messages ADD CONSTRAINT fk_messages_reply_to FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL")) {
            echo "Foreign key constraint fk_messages_reply_to added successfully.\n";
        } else {
            echo "Error adding foreign key constraint: " . $conn->error . "\n";
        }
    } else {
        echo "Error adding column reply_to_id: " . $conn->error . "\n";
    }
} else {
    echo "reply_to_id column already exists.\n";
}
$conn->close();
?>
