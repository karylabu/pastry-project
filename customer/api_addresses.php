<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/db.php';

error_reporting(0);
ini_set('display_errors', 0);

try {
    if (!$conn) {
        throw new Exception('Database Connection Failed: ' . mysqli_connect_error());
    }

    /*
    | SCHEMA NOTE: The addresses table is maintained exclusively through
    | versioned migrations in database/migrations/. This API must never run
    | CREATE TABLE / ALTER TABLE statements at request time.
    */

    // Identify customer_id from request
    $user_id = 0;
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $user_id = intval($_GET['user_id'] ?? 0);
    } else {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $user_id = intval($body['user_id'] ?? $_GET['user_id'] ?? 0);
    }

    if ($user_id <= 0) {
        throw new Exception('User ID is required');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $sql = "SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, updated_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $addresses = [];
        while ($row = $result->fetch_assoc()) {
            $row['is_default'] = (bool)$row['is_default'];
            $addresses[] = $row;
        }

        echo json_encode(['status' => 'success', 'addresses' => $addresses]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $address_id = intval($body['address_id'] ?? 0);
        $label = trim($body['address_label'] ?? '');
        $recipient = trim($body['recipient_name'] ?? '');
        $contact = trim($body['contact_number'] ?? '');
        $houseNo = trim($body['house_no'] ?? '');
        $street = trim($body['street'] ?? '');
        $barangay = trim($body['barangay'] ?? '');
        $city = trim($body['city'] ?? '');
        $province = trim($body['province'] ?? '');
        $zip = trim($body['zip_code'] ?? '');
        $landmark = trim($body['landmark'] ?? '');
        $instructions = trim($body['delivery_instructions'] ?? '');
        $isDefault = !empty($body['is_default']) ? 1 : 0;

        if (!$label || !$recipient || !$contact || !$street || !$barangay || !$city || !$province) {
            throw new Exception('Please fill all required address fields.');
        }

        // Normalize default address: only one default per user
        if ($isDefault) {
            $clearSql = "UPDATE addresses SET is_default = 0 WHERE customer_id = ?";
            $clearStmt = $conn->prepare($clearSql);
            $clearStmt->bind_param('i', $user_id);
            $clearStmt->execute();
        }

        if ($address_id > 0) {
            $sql = "UPDATE addresses SET address_label = ?, recipient_name = ?, contact_number = ?, house_no = ?, street = ?, barangay = ?, city = ?, province = ?, zip_code = ?, landmark = ?, delivery_instructions = ?, is_default = ? WHERE address_id = ? AND customer_id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('ssssssssssiii', $label, $recipient, $contact, $houseNo, $street, $barangay, $city, $province, $zip, $landmark, $instructions, $isDefault, $address_id, $user_id);
            if (!$stmt->execute()) {
                throw new Exception('Unable to update address.');
            }
        } else {
            $sql = "INSERT INTO addresses (customer_id, address_label, recipient_name, contact_number, house_no, street, barangay, city, province, zip_code, landmark, delivery_instructions, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('issssssssssis', $user_id, $label, $recipient, $contact, $houseNo, $street, $barangay, $city, $province, $zip, $landmark, $instructions, $isDefault);
            if (!$stmt->execute()) {
                throw new Exception('Unable to save address.');
            }
            $address_id = $stmt->insert_id;
        }

        // Return the current address list after save
        $sql = "SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, updated_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $addresses = [];
        while ($row = $result->fetch_assoc()) {
            $row['is_default'] = (bool)$row['is_default'];
            $addresses[] = $row;
        }

        echo json_encode(['status' => 'success', 'addresses' => $addresses, 'address_id' => $address_id]);
        exit;
    }

    throw new Exception('Unsupported request method.');
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
