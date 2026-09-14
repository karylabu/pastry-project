<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

/* ================= DATABASE CONNECTION ================= */
/*
| SCHEMA NOTE: The orders table schema is maintained exclusively through
| versioned migrations in database/migrations/. This API must never run
| ALTER TABLE / CREATE TABLE statements at request time.
*/

$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed"
    ]);
    exit;
}

/* ================= GET ORDERS ================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $customOnly = isset($_GET['custom']) && (strval($_GET['custom']) === '1' || strtolower(strval($_GET['custom'])) === 'true');
    $hasCustomizedRecipeOrders = $conn->query("SHOW TABLES LIKE 'customized_cake_orders'")->num_rows > 0;
    $sql = $customOnly
        ? "SELECT o.*, c.cake_size AS custom_cake_size, c.quantity AS custom_quantity,
                  c.flavor AS custom_flavor, c.filling AS custom_filling,
                  c.frosting AS custom_frosting, c.occasion AS custom_occasion,
                  c.theme_design AS custom_theme_design, c.preferred_colors AS custom_preferred_colors,
                  c.tiers AS custom_tiers, c.dedication AS custom_dedication,
                  c.notes AS custom_notes, c.estimated_price AS custom_estimated_price,
                  c.inspo_images AS custom_inspo_images,
                  " . ($hasCustomizedRecipeOrders ? "cc.id AS customized_cake_order_id, cc.cake_type AS customized_cake_type, cc.status AS customized_cake_status, cc.notes AS customized_cake_notes" : "NULL AS customized_cake_order_id, NULL AS customized_cake_type, NULL AS customized_cake_status, NULL AS customized_cake_notes") . "
           FROM orders o
           LEFT JOIN custom_cake_orders c ON c.order_id = o.id
           " . ($hasCustomizedRecipeOrders ? "LEFT JOIN customized_cake_orders cc ON cc.order_id = o.id" : "") . "
           WHERE (c.order_id IS NOT NULL " . ($hasCustomizedRecipeOrders ? "OR cc.order_id IS NOT NULL" : "") . ")
             AND NOT (LOWER(o.payment) = 'gcash' AND LOWER(COALESCE(o.payment_status, 'pending')) <> 'paid')
           ORDER BY o.id DESC"
                : "SELECT o.* FROM orders o
                         WHERE NOT EXISTS (SELECT 1 FROM custom_cake_orders c WHERE c.order_id = o.id)" . ($hasCustomizedRecipeOrders ? " AND NOT EXISTS (SELECT 1 FROM customized_cake_orders cc WHERE cc.order_id = o.id)" : "") . "
                         AND NOT (LOWER(o.payment) = 'gcash' AND LOWER(COALESCE(o.payment_status, 'pending')) <> 'paid')
                     ORDER BY o.id DESC";

    $result = $conn->query($sql);

    if (!$result) {
        echo json_encode([
            "status" => "error",
            "message" => "Failed to load orders"
        ]);
        exit;
    }

    $ordersById = [];
    $rawItemsByOrderId = [];

    while ($row = $result->fetch_assoc()) {
        $rawItemsByOrderId[(int) $row['id']] = json_decode($row['items'] ?? '[]', true) ?: [];
        $row['items'] = [];

        if ($customOnly) {
            $customDetails = json_decode($row['custom_notes'] ?? '', true);
            if (!is_array($customDetails)) {
                $customDetails = [];
            }

            $customDetails += [
                'cake_size' => $row['custom_cake_size'] ?? '',
                'quantity' => $row['custom_quantity'] ?? '',
                'cake_flavor' => $row['custom_flavor'] ?? '',
                'filling_flavor' => $row['custom_filling'] ?? '',
                'frosting_type' => $row['custom_frosting'] ?? '',
                'occasion' => $row['custom_occasion'] ?? '',
                'theme' => $row['custom_theme_design'] ?? '',
                'cake_color' => $row['custom_preferred_colors'] ?? '',
                'tiers' => $row['custom_tiers'] ?? '',
                'custom_message' => $row['custom_dedication'] ?? '',
                'estimated_price' => $row['custom_estimated_price'] ?? '',
                'cake_type' => $row['customized_cake_type'] ?? '',
                'recipe_order_id' => $row['customized_cake_order_id'] ?? '',
                'recipe_status' => $row['customized_cake_status'] ?? '',
            ];

            $row['custom_details'] = $customDetails;
            $row['custom_inspo_images'] = json_decode($row['custom_inspo_images'] ?? '', true) ?: [];
            unset(
                $row['custom_cake_size'], $row['custom_quantity'], $row['custom_flavor'],
                $row['custom_filling'], $row['custom_frosting'], $row['custom_occasion'],
                $row['custom_theme_design'], $row['custom_preferred_colors'], $row['custom_tiers'],
                $row['custom_dedication'], $row['custom_notes'], $row['custom_estimated_price']
            );
        }

        $ordersById[(int) $row['id']] = $row;
    }

    if (!empty($ordersById)) {
        $ids = array_keys($ordersById);
        $idList = implode(',', array_map('intval', $ids));
        $itemsSql = "SELECT oi.order_id, oi.product, oi.qty, oi.price, p.category
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id IN ($idList)";
        $itemsResult = $conn->query($itemsSql);

        if ($itemsResult) {
            while ($itemRow = $itemsResult->fetch_assoc()) {
                $orderId = (int) ($itemRow['order_id'] ?? 0);
                if (!isset($ordersById[$orderId])) {
                    continue;
                }

                $ordersById[$orderId]['items'][] = [
                    'name' => $itemRow['product'] ?? 'Item',
                    'qty' => (int) ($itemRow['qty'] ?? 1),
                    'price' => (float) ($itemRow['price'] ?? 0),
                    'category' => $itemRow['category'] ?? '',
                ];
            }
        }

        foreach ($ordersById as $orderId => &$order) {
            if (!empty($order['items']) || empty($rawItemsByOrderId[$orderId])) {
                continue;
            }

            $order['items'] = array_map(static function ($item) {
                return [
                    'name' => $item['name'] ?? $item['product'] ?? 'Item',
                    'qty' => (int) ($item['qty'] ?? $item['quantity'] ?? 1),
                    'price' => (float) ($item['price'] ?? 0),
                    'category' => $item['category'] ?? '',
                ];
            }, $rawItemsByOrderId[$orderId]);
        }
        unset($order);
    }

    $orders = array_values($ordersById);
    usort($orders, function ($a, $b) {
        return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
    });

    echo json_encode($orders);
    exit;
}

/* ================= UPDATE TOTAL ================= */
/*
| SECURITY: This endpoint previously interpolated client-supplied values
| directly into SQL (injection risk) and allowed arbitrary status writes
| that BYPASSED inventory deduction/cancellation logic. Status changes must
| go through api_update_order_status.php, which handles stock atomically.
| Only a numeric order-total correction is permitted here, via prepared
| statements.
*/

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $authenticatedUser = apiUser();
    if (!$authenticatedUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required.']);
        exit;
    }

    if (strtolower(trim((string) ($authenticatedUser['role'] ?? ''))) !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You are not authorized for this action.']);
        exit;
    }

    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        $data = $_POST;
    }

    // Status changes are NOT allowed here — they would bypass stock logic.
    if (!empty($data['status'])) {
        http_response_code(400);
        echo json_encode([
            "status" => "error",
            "message" => "Status changes must use api_update_order_status.php"
        ]);
        exit;
    }

    $id = intval($data['id'] ?? 0);
    $hasTotal = array_key_exists('total', $data) && is_numeric($data['total']);
    $total = $hasTotal ? floatval($data['total']) : null;
    $hasDownpayment = array_key_exists('downpayment_percent', $data) && is_numeric($data['downpayment_percent']);
    $downpaymentPercent = $hasDownpayment ? floatval($data['downpayment_percent']) : null;
    $downpaymentAmount = array_key_exists('downpayment_amount', $data) && is_numeric($data['downpayment_amount'])
        ? floatval($data['downpayment_amount'])
        : null;

    if (!$id || !$hasTotal || $total < 0 || ($hasDownpayment && ($downpaymentPercent < 0 || $downpaymentPercent > 100))) {
        echo json_encode([
            "status" => "error",
            "message" => "Missing or invalid data"
        ]);
        exit;
    }

    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $total, $id);
    if ($stmt->execute()) {
        echo json_encode([
            "status" => "success"
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Update failed"
        ]);
    }
    $stmt->close();

    if ($hasDownpayment) {
        $detailsStmt = $conn->prepare("SELECT notes FROM custom_cake_orders WHERE order_id = ? LIMIT 1");
        if ($detailsStmt) {
            $detailsStmt->bind_param('i', $id);
            $detailsStmt->execute();
            $detailsRow = $detailsStmt->get_result()->fetch_assoc();
            $detailsStmt->close();

            $details = json_decode($detailsRow['notes'] ?? '', true);
            if (!is_array($details)) {
                $details = [];
            }
            $details['quoted_total'] = $total;
            $details['downpayment_percent'] = $downpaymentPercent;
            $details['downpayment_amount'] = $downpaymentAmount ?? round($total * ($downpaymentPercent / 100), 2);
            $updatedNotes = json_encode($details);

            $notesStmt = $conn->prepare("UPDATE custom_cake_orders SET notes = ? WHERE order_id = ?");
            if ($notesStmt) {
                $notesStmt->bind_param('si', $updatedNotes, $id);
                $notesStmt->execute();
                $notesStmt->close();
            }
        }
    }

    exit;
}

?>