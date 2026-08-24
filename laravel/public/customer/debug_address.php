<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

$debug = [];

// Test database connection
$debug['connection'] = $conn ? 'Connected' : 'Failed: ' . mysqli_connect_error();

// Try to create table
if ($conn) {
    $debug['db_selected'] = true;
    
    // Create table if not exists
    $result = mysqli_query($conn, "CREATE TABLE IF NOT EXISTS addresses (
        address_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        address_label VARCHAR(50) NOT NULL,
        recipient_name VARCHAR(100) NOT NULL,
        contact_number VARCHAR(20) NOT NULL,
        house_no VARCHAR(50),
        street VARCHAR(100) NOT NULL,
        barangay VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        province VARCHAR(100) NOT NULL,
        zip_code VARCHAR(20),
        landmark VARCHAR(255),
        delivery_instructions TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        latitude DECIMAL(10, 7) NULL,
        longitude DECIMAL(10, 7) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    $debug['table_created'] = $result ? 'Success' : 'Error: ' . mysqli_error($conn);
    
    // Check if table exists
    $check = mysqli_query($conn, "SHOW TABLES LIKE 'addresses'");
    $debug['table_exists'] = $check && mysqli_num_rows($check) > 0 ? 'Yes' : 'No';
    
    // Get table structure
    $struct = mysqli_query($conn, "DESCRIBE addresses");
    if ($struct) {
        $debug['table_structure'] = [];
        while ($row = mysqli_fetch_assoc($struct)) {
            $debug['table_structure'][] = $row['Field'] . ' (' . $row['Type'] . ')';
        }
    }
    
    // Test insert
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $test_data = json_decode(file_get_contents('php://input'), true);
        $debug['received_data'] = $test_data;
        
        try {
            $user_id = intval($test_data['user_id'] ?? 1);
            $label = trim($test_data['address_label'] ?? 'Home');
            $recipient = trim($test_data['recipient_name'] ?? 'Test');
            $contact = trim($test_data['contact_number'] ?? '09123456789');
            $street = trim($test_data['street'] ?? 'Main St');
            $barangay = trim($test_data['barangay'] ?? 'Poblacion');
            $city = trim($test_data['city'] ?? 'Tanauan');
            $province = trim($test_data['province'] ?? 'Batangas');
            $house_no = trim($test_data['house_no'] ?? '');
            $zip = trim($test_data['zip_code'] ?? '');
            $landmark = trim($test_data['landmark'] ?? '');
            $instructions = trim($test_data['delivery_instructions'] ?? '');
            $is_default = $test_data['is_default'] ? 1 : 0;
            
            $debug['parsed_data'] = [
                'user_id' => $user_id,
                'label' => $label,
                'recipient' => $recipient,
                'contact' => $contact,
                'city' => $city,
                'province' => $province
            ];
            
            // Try insert
            $sql = "INSERT INTO addresses (customer_id, address_label, recipient_name, contact_number, house_no, street, barangay, city, province, zip_code, landmark, delivery_instructions, is_default) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                $debug['prepare_error'] = $conn->error;
            } else {
                $stmt->bind_param('isssssssssssi', $user_id, $label, $recipient, $contact, $house_no, $street, $barangay, $city, $province, $zip, $landmark, $instructions, $is_default);
                
                if ($stmt->execute()) {
                    $debug['insert_success'] = true;
                    $debug['inserted_id'] = $stmt->insert_id;
                } else {
                    $debug['insert_error'] = $stmt->error;
                }
                $stmt->close();
            }
        } catch (Exception $e) {
            $debug['exception'] = $e->getMessage();
        }
    }
} else {
    $debug['error'] = 'No database connection';
}

echo json_encode($debug, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
