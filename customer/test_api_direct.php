<?php
// Test the save address API directly
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/cors.php';

// Simulate a POST request with test data
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['CONTENT_TYPE'] = 'application/json';
$_SERVER['HTTP_ORIGIN'] = 'http://localhost';

$testData = [
    'user_id' => 1,
    'address_id' => 0,
    'address_label' => 'Home',
    'recipient_name' => 'Test User',
    'contact_number' => '09123456789',
    'house_no' => '123',
    'street' => 'Main Street',
    'barangay' => 'Poblacion',
    'city' => 'Tanauan',
    'province' => 'Batangas',
    'zip_code' => '4213',
    'is_default' => true
];

// Manually handle the request
header('Content-Type: application/json; charset=utf-8');

try {
    if (!$conn) {
        throw new Exception('Database Connection Failed: ' . mysqli_connect_error());
    }

    echo "✓ Database connected\n";

    // Create addresses table if not exists
    mysqli_report(MYSQLI_REPORT_OFF);
    $createTableSQL = "CREATE TABLE IF NOT EXISTS addresses (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (mysqli_query($conn, $createTableSQL)) {
        echo "✓ Addresses table ready\n";
    } else {
        echo "! Table creation issue (may already exist): " . mysqli_error($conn) . "\n";
    }

    // Test the insert
    echo "\nTesting address save with data:\n";
    echo json_encode($testData, JSON_PRETTY_PRINT) . "\n\n";

    $user_id = $testData['user_id'];
    $label = $testData['address_label'];
    $recipient = $testData['recipient_name'];
    $contact = $testData['contact_number'];
    $houseNo = $testData['house_no'];
    $street = $testData['street'];
    $barangay = $testData['barangay'];
    $city = $testData['city'];
    $province = $testData['province'];
    $zip = $testData['zip_code'];
    $landmark = '';
    $instructions = '';
    $isDefault = $testData['is_default'] ? 1 : 0;
    $latitude = null;
    $longitude = null;

    // Validate
    if (!$label || !$recipient || !$contact || !$street || !$barangay || !$city || !$province) {
        throw new Exception('Missing required fields');
    }

    if (stripos($city, 'tanauan') === false) {
        throw new Exception('Pastry Project only delivers to Tanauan City.');
    }

    if (stripos($province, 'batangas') === false) {
        throw new Exception('Pastry Project only delivers within Batangas province.');
    }

    echo "✓ Validation passed\n";

    // Insert
    $sql = "INSERT INTO addresses (customer_id, address_label, recipient_name, contact_number, house_no, street, barangay, city, province, zip_code, landmark, delivery_instructions, is_default, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Prepare failed: ' . $conn->error);
    }

    $stmt->bind_param('issssssssssisdd', $user_id, $label, $recipient, $contact, $houseNo, $street, $barangay, $city, $province, $zip, $landmark, $instructions, $isDefault, $latitude, $longitude);
    
    if (!$stmt->execute()) {
        throw new Exception('Execute failed: ' . $stmt->error);
    }

    $address_id = $stmt->insert_id;
    echo "✓ Address saved successfully with ID: " . $address_id . "\n";

    // Fetch back the saved address
    $sql = "SELECT * FROM addresses WHERE address_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $address_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $savedAddress = $result->fetch_assoc();

    echo "\n✓ Saved Address Data:\n";
    echo json_encode($savedAddress, JSON_PRETTY_PRINT) . "\n";

    echo "\n✅ SUCCESS! Address saved and retrieved from database.\n";

} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
}
?>
