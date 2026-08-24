<?php
/**
 * api_get_custom_cakes.php
 * 
 * Fetch all customized cake orders for a user with their account details.
 * Accepts user_id, user_email, or customer name as query parameters.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

error_reporting(0);
ini_set('display_errors', 0);

try {
    $conn = mysqli_connect("localhost", "root", "", "pastry_db");
    if (!$conn) {
        throw new Exception("Database Connection Failed: " . mysqli_connect_error());
    }

    $user_id = 0;
    $user_email = '';
    $customer_name = '';

    // Get identity from GET
    if (isset($_GET['user_id'])) $user_id = intval($_GET['user_id']);
    if (isset($_GET['user_email'])) $user_email = trim($_GET['user_email']);
    if (isset($_GET['email'])) $user_email = trim($_GET['email']);
    if (isset($_GET['customer'])) $customer_name = trim($_GET['customer']);

    // Get identity from POST
    $rawPost = file_get_contents("php://input");
    if (!empty($rawPost)) {
        $data = json_decode($rawPost, true);
        if ($data) {
            if (isset($data['user_id'])) $user_id = intval($data['user_id']);
            if (isset($data['email'])) $user_email = trim($data['email']);
            if (isset($data['user_email'])) $user_email = trim($data['user_email']);
            if (isset($data['customer'])) $customer_name = trim($data['customer']);
        }
    }

    $orders = [];

    if ($user_id > 0) {
        // Fetch by user_id - Join with users table to get account details
        $query = "
            SELECT 
                o.id,
                o.customer,
                o.email,
                o.type,
                o.status,
                o.total,
                o.payment,
                o.address,
                o.phone,
                o.created_at,
                o.items,
                u.name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                u.role,
                u.profile_image,
                cco.id as custom_cake_id,
                cco.cake_size,
                cco.quantity,
                cco.flavor,
                cco.filling,
                cco.frosting,
                cco.occasion,
                cco.theme_design,
                cco.preferred_colors,
                cco.tiers,
                cco.dedication,
                cco.notes,
                cco.estimated_price,
                cco.inspo_images
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN custom_cake_orders cco ON o.id = cco.order_id
            WHERE o.user_id = $user_id
            AND (o.type = 'Custom' OR cco.id IS NOT NULL)
            ORDER BY o.created_at DESC
        ";
    } elseif ($user_email !== '') {
        // Fetch by email
        $escapedEmail = mysqli_real_escape_string($conn, $user_email);
        $query = "
            SELECT 
                o.id,
                o.customer,
                o.email,
                o.type,
                o.status,
                o.total,
                o.payment,
                o.address,
                o.phone,
                o.created_at,
                o.items,
                u.name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                u.role,
                u.profile_image,
                cco.id as custom_cake_id,
                cco.cake_size,
                cco.quantity,
                cco.flavor,
                cco.filling,
                cco.frosting,
                cco.occasion,
                cco.theme_design,
                cco.preferred_colors,
                cco.tiers,
                cco.dedication,
                cco.notes,
                cco.estimated_price,
                cco.inspo_images
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id OR o.email = u.email
            LEFT JOIN custom_cake_orders cco ON o.id = cco.order_id
            WHERE (o.email = '$escapedEmail' OR o.user_id IN (SELECT id FROM users WHERE email = '$escapedEmail'))
            AND (o.type = 'Custom' OR cco.id IS NOT NULL)
            ORDER BY o.created_at DESC
        ";
    } elseif ($customer_name !== '') {
        // Fetch by customer name
        $escapedName = mysqli_real_escape_string($conn, $customer_name);
        $query = "
            SELECT 
                o.id,
                o.customer,
                o.email,
                o.type,
                o.status,
                o.total,
                o.payment,
                o.address,
                o.phone,
                o.created_at,
                o.items,
                u.name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                u.role,
                u.profile_image,
                cco.id as custom_cake_id,
                cco.cake_size,
                cco.quantity,
                cco.flavor,
                cco.filling,
                cco.frosting,
                cco.occasion,
                cco.theme_design,
                cco.preferred_colors,
                cco.tiers,
                cco.dedication,
                cco.notes,
                cco.estimated_price,
                cco.inspo_images
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN custom_cake_orders cco ON o.id = cco.order_id
            WHERE (o.customer LIKE '%$escapedName%' OR u.name LIKE '%$escapedName%')
            AND (o.type = 'Custom' OR cco.id IS NOT NULL)
            ORDER BY o.created_at DESC
        ";
    } else {
        // Return empty array if no filter provided
        echo json_encode([]);
        exit;
    }

    $result = mysqli_query($conn, $query);

    if (!$result) {
        throw new Exception("Query failed: " . mysqli_error($conn));
    }

    while ($row = mysqli_fetch_assoc($result)) {
        // Parse JSON fields
        if (is_string($row['items'])) {
            $row['items'] = json_decode($row['items'], true) ?: [];
        } else {
            $row['items'] = [];
        }

        if (is_string($row['inspo_images'])) {
            $row['inspo_images'] = json_decode($row['inspo_images'], true) ?: [];
        } else {
            $row['inspo_images'] = [];
        }

        // Extract user info
        $row['user_account'] = [
            'name' => $row['user_name'] ?? $row['customer'],
            'email' => $row['user_email'] ?? $row['email'],
            'phone' => $row['user_phone'] ?? $row['phone'],
            'role' => $row['role'] ?? 'customer',
            'profile_image' => $row['profile_image'] ?? null,
        ];

        // Extract custom cake details
        $row['custom_cake_details'] = [
            'id' => $row['custom_cake_id'],
            'cake_size' => $row['cake_size'],
            'quantity' => $row['quantity'],
            'flavor' => $row['flavor'],
            'filling' => $row['filling'],
            'frosting' => $row['frosting'],
            'occasion' => $row['occasion'],
            'theme_design' => $row['theme_design'],
            'preferred_colors' => $row['preferred_colors'],
            'tiers' => $row['tiers'],
            'dedication' => $row['dedication'],
            'notes' => $row['notes'],
            'estimated_price' => $row['estimated_price'],
            'inspo_images' => $row['inspo_images'],
        ];

        // Remove duplicate fields
        unset($row['user_name'], $row['user_email'], $row['user_phone'], $row['role'], $row['profile_image']);
        unset($row['custom_cake_id'], $row['cake_size'], $row['quantity'], $row['flavor'], $row['filling']);
        unset($row['frosting'], $row['occasion'], $row['theme_design'], $row['preferred_colors']);
        unset($row['tiers'], $row['dedication'], $row['notes'], $row['estimated_price'], $row['inspo_images']);

        $orders[] = $row;
    }

    mysqli_close($conn);
    echo json_encode($orders);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
