<?php
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryRead();

function getSessionUserId(): int {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
    return isset($_SESSION['user']['id']) ? intval($_SESSION['user']['id']) : 0;
}

function insertAuditLog(mysqli $conn, int $userId, string $context, string $action, string $entityType, int $entityId, string $note): bool {
    $stmt = $conn->prepare(
        "INSERT INTO audit_log (user_id, context, action, entity_type, entity_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    );
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('isssis', $userId, $context, $action, $entityType, $entityId, $note);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

// create DB connection early so POST handlers can use it
$conn = new mysqli("localhost", "root", "", "pastry_db");

if ($conn->connect_error) {
    echo json_encode(["success" => false, "message" => "Database connection failed"]);
    exit;
}

function createLowStockAlert(mysqli $conn, int $ingredientId, string $ingredientName, float $previousStock, float $newStock, float $threshold): void
{
    $shouldAlert = $previousStock >= $threshold && $newStock < $threshold;
    if (! $shouldAlert) {
        return;
    }

    $type = 'low_stock';
    $title = 'Low stock alert';
    $message = sprintf(
        'Ingredient "%s" is below threshold: %.3f / %.3f remaining.',
        $ingredientName,
        $newStock,
        $threshold
    );
    $dataJson = json_encode([
        'ingredient_id' => $ingredientId,
        'stock' => $newStock,
        'threshold' => $threshold,
    ], JSON_UNESCAPED_SLASHES);
    $actionUrl = "/admin/inventory/ingredients/{$ingredientId}";

    $userResult = $conn->query("SELECT id FROM users WHERE role IN ('admin', 'staff') ORDER BY id");
    if (!$userResult) {
        return;
    }

    while ($userRow = $userResult->fetch_assoc()) {
        $userId = (int) $userRow['id'];

        $adminAlertStmt = $conn->prepare(
            "INSERT INTO admin_alerts (user_id, type, title, message, data, action_url, is_read, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())"
        );
        if ($adminAlertStmt) {
            $adminAlertStmt->bind_param('isssss', $userId, $type, $title, $message, $dataJson, $actionUrl);
            $adminAlertStmt->execute();
            $adminAlertStmt->close();
        }

        $notificationStmt = $conn->prepare(
            "INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())"
        );
        if ($notificationStmt) {
            $notificationStmt->bind_param('issss', $userId, $title, $message, $type, $actionUrl);
            $notificationStmt->execute();
            $notificationStmt->close();
        }
    }

    $userResult->free();
}

/**
 * Validates an optional expiry date (YYYY-MM-DD).
 * Returns null when absent, the normalized date when valid, or false after
 * sending a 400 response when invalid.
 */
function validateExpiryOrNull($value, mysqli $conn) {
    if (empty($value)) {
        return null;
    }
    $trimmed = trim((string) $value);
    $date = DateTime::createFromFormat('Y-m-d', $trimmed);
    if (!$date || $date->format('Y-m-d') !== $trimmed) {
        echo json_encode(["success" => false, "message" => "Expiry must use YYYY-MM-DD format"]);
        $conn->close();
        return false;
    }
    return $trimmed;
}

// Support POST actions: stock_in, stock_out
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
        $conn->close();
        exit;
    }

    $action = $data['action'] ?? null;

    // CREATE new ingredient
    if ($action === 'create') {
        requireInventoryManager();
        $name = trim($data['name'] ?? '');
        $unit = trim($data['unit'] ?? '');
        $stock = isset($data['stock']) ? floatval($data['stock']) : 0;
        $threshold = isset($data['threshold']) ? intval($data['threshold']) : 0;
        $expiry = validateExpiryOrNull($data['expiry'] ?? null, $conn);
        if ($expiry === false) {
            exit;
        }

        if ($name === '') {
            echo json_encode(["success" => false, "message" => "Name is required"]);
            $conn->close();
            exit;
        }

        $ins = $conn->prepare("INSERT INTO ingredients (name, unit, stock, threshold, expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())");
        $ins->bind_param('ssdis', $name, $unit, $stock, $threshold, $expiry);
        $ok = $ins->execute();
        if ($ok) {
            $newId = $conn->insert_id;
            echo json_encode(["success" => true, "ingredient_id" => $newId]);
        } else {
            echo json_encode(["success" => false, "message" => "Failed to create ingredient"]);
        }
        $ins->close();
        $conn->close();
        exit;
    }

    // DELETE ingredient
    if ($action === 'delete') {
        requireInventoryManager();
        $ingredient_id = isset($data['ingredient_id']) ? (int)$data['ingredient_id'] : 0;
        if (!$ingredient_id) {
            echo json_encode(["success" => false, "message" => "Missing ingredient_id"]);
            $conn->close();
            exit;
        }
        // remove related movements (if any)
        $d1 = $conn->prepare("DELETE FROM ingredient_movements WHERE ingredient_id = ?");
        $d1->bind_param('i', $ingredient_id);
        $d1->execute();
        $d1->close();

        $d2 = $conn->prepare("DELETE FROM ingredients WHERE id = ? LIMIT 1");
        $d2->bind_param('i', $ingredient_id);
        $ok = $d2->execute();
        $d2->close();
        if ($ok) echo json_encode(["success" => true, "ingredient_id" => $ingredient_id]);
        else echo json_encode(["success" => false, "message" => "Failed to delete ingredient"]);
        $conn->close();
        exit;
    }

    // UPDATE ingredient details
    if ($action === 'update') {
        requireInventoryManager();
        $ingredient_id = isset($data['ingredient_id']) ? (int)$data['ingredient_id'] : 0;
        $name = trim($data['name'] ?? '');
        $unit = trim($data['unit'] ?? '');
        $stock = isset($data['stock']) ? floatval($data['stock']) : 0;
        $threshold = isset($data['threshold']) ? intval($data['threshold']) : 0;
        $expiry = validateExpiryOrNull($data['expiry'] ?? null, $conn);
        if ($expiry === false) {
            exit;
        }

        if (!$ingredient_id || $name === '') {
            echo json_encode(["success" => false, "message" => "Missing ingredient or name"]);
            $conn->close();
            exit;
        }

        $statusStmt = $conn->prepare("SELECT expiry, EXISTS (SELECT 1 FROM ingredient_batches b WHERE b.ingredient_id = ingredients.id AND b.quantity_remaining > 0 AND b.expiry_date < CURDATE()) AS expired_batch, EXISTS (SELECT 1 FROM ingredient_batches b WHERE b.ingredient_id = ingredients.id AND b.quantity_remaining <= 0) AS discarded_batch FROM ingredients WHERE id = ?");
        $statusStmt->bind_param('i', $ingredient_id);
        $statusStmt->execute();
        $statusRow = $statusStmt->get_result()->fetch_assoc();
        $statusStmt->close();
        $expired = $statusRow && !empty($statusRow['expiry']) && $statusRow['expiry'] !== '0000-00-00' && $statusRow['expiry'] < date('Y-m-d');
        if (!$statusRow || $expired || (int) $statusRow['expired_batch'] === 1 || (int) $statusRow['discarded_batch'] === 1) {
            http_response_code(409);
            echo json_encode(["success" => false, "message" => "Expired or discarded inventory cannot be edited. Use the discard workflow instead."]);
            $conn->close();
            exit;
        }

        $previousStockStmt = $conn->prepare("SELECT stock FROM ingredients WHERE id = ? LIMIT 1");
        $previousStockStmt->bind_param('i', $ingredient_id);
        $previousStockStmt->execute();
        $previousStockResult = $previousStockStmt->get_result();
        $previousStock = 0.0;
        if ($previousStockRow = $previousStockResult->fetch_assoc()) {
            $previousStock = (float) ($previousStockRow['stock'] ?? 0);
        }
        $previousStockStmt->close();

        // AUDIT TRAIL: direct stock edits are recorded as correction movements
        // inside a transaction so the history always matches reality.
        $conn->begin_transaction();

        $lockStmt = $conn->prepare("SELECT stock FROM ingredients WHERE id = ? LIMIT 1 FOR UPDATE");
        $lockStmt->bind_param('i', $ingredient_id);
        $lockStmt->execute();
        $lockedRow = $lockStmt->get_result()->fetch_assoc();
        $lockStmt->close();
        if (!$lockedRow) {
            $conn->rollback();
            echo json_encode(["success" => false, "message" => "Ingredient not found"]);
            $conn->close();
            exit;
        }
        $previousStock = (float) $lockedRow['stock'];

        $stmt = $conn->prepare("UPDATE ingredients SET name = ?, unit = ?, stock = ?, threshold = ?, expiry = ?, updated_at = NOW() WHERE id = ? LIMIT 1");
        $stmt->bind_param('ssdisi', $name, $unit, $stock, $threshold, $expiry, $ingredient_id);
        $ok = $stmt->execute();
        $stmt->close();

        if (!$ok) {
            $conn->rollback();
            echo json_encode(["success" => false, "message" => "Failed to update ingredient"]);
            $conn->close();
            exit;
        }

        if ((float) $stock !== $previousStock) {
            $correctionAction = (float) $stock > $previousStock ? 'stock_in' : 'stock_out';
            $correctionQty = abs((float) $stock - $previousStock);
            $movement = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, action, qty, note, user_id) VALUES (?, ?, ?, ?, ?)");
            $movementUserId = getSessionUserId();
            $movementNote = 'Inventory correction via ingredient update';
            $movement->bind_param('isdsi', $ingredient_id, $correctionAction, $correctionQty, $movementNote, $movementUserId);
            if (!$movement->execute()) {
                $movement->close();
                $conn->rollback();
                echo json_encode(["success" => false, "message" => "Failed to record stock correction"]);
                $conn->close();
                exit;
            }
            $movement->close();
        }

        $conn->commit();
        createLowStockAlert($conn, $ingredient_id, $name, $previousStock, (float) $stock, $threshold);
        echo json_encode(["success" => true, "ingredient_id" => $ingredient_id]);
        $conn->close();
        exit;
    }

    // SYNC ingredients from cake recipes
    if ($action === 'sync_from_cakes') {
        requireInventoryManager();
        // Get distinct ingredient strings from cake_ingredients
        $rows = $conn->query("SELECT DISTINCT ingredient FROM cake_ingredients");
        if (!$rows) {
            echo json_encode(["success" => false, "message" => "Failed to read cake_ingredients"]);
            $conn->close();
            exit;
        }
        $created = 0;
        while ($r = $rows->fetch_assoc()) {
            $rawIng = trim($r['ingredient']);
            if ($rawIng === '') continue;

            $unit = '';
            $name = $rawIng;

            // Extract the leading quantity/packaging portion if present.
            // - Allows an optional wrapping "(...)" around the quantity,
            //   e.g. "(113 g) unsalted butter, melted".
            // - Includes a bare "g" so plain gram amounts match too.
            if (preg_match('/^\s*\(?\s*([0-9]+(?:[\/\.][0-9]+)?\s*(?:cups?|cup|grams?|gram|g|kgs?|kg|milliliters?|ml|liters?|litres?|l|tablespoons?|tbsp|teaspoons?|tsp|pieces?|pcs|boxes?|box|cans?|can|packages?|package|packets?|packet|slices?|slice|large|medium|small|pinch|dash|cloves?|bunch|stick|sticks|oz|ounces?|fl\s*oz|pounds?|lbs?)(?:\s*\([^)]*\))?)\s*\)?\s+(.+)$/i', $rawIng, $match)) {
                $unit = trim($match[1]);
                $name = trim($match[2]);
            }

            // Normalize ingredient name for dedupe while preserving label quality.
            $name = preg_replace('/\s*,?\s*\(optional\)$/i', '', $name);
            $name = preg_replace('/\s*,?\s*optional$/i', '', $name);
            $name = preg_replace('/\s*,?\s*chopped$/i', '', $name);
            $name = preg_replace('/\s*,?\s*diced$/i', '', $name);
            $name = preg_replace('/\s*,?\s*finely chopped$/i', '', $name);
            $name = preg_replace('/\s*,?\s*for drizzling$/i', '', $name);
            $name = preg_replace('/\s*,?\s*for dusting$/i', '', $name);
            $name = preg_replace('/\s*,?\s*softened$/i', '', $name);
            $name = preg_replace('/\s*,?\s*melted$/i', '', $name);
            $name = preg_replace('/\s*,?\s*(?:or|and).*$/i', '', $name);
            $name = trim($name, "\"' \.,-:;");

            if ($name === '') {
                $name = $rawIng;
            }

            $normalizedName = trim(preg_replace('/\s+/', ' ', $name));
            $compareName = mb_strtolower($normalizedName);

            $chk = $conn->prepare("SELECT id, unit FROM ingredients WHERE LOWER(TRIM(name)) = ? LIMIT 1");
            $chk->bind_param('s', $compareName);
            $chk->execute();
            $res = $chk->get_result();
            $existing = $res ? $res->fetch_assoc() : null;
            $chk->close();

            if ($existing) {
                if ($unit !== '' && empty(trim($existing['unit']))) {
                    $upd = $conn->prepare("UPDATE ingredients SET unit = ?, updated_at = NOW() WHERE id = ? LIMIT 1");
                    $upd->bind_param('si', $unit, $existing['id']);
                    $upd->execute();
                    $upd->close();
                }
                continue;
            }

            $ins = $conn->prepare("INSERT INTO ingredients (name, unit, unit_cost, stock, threshold, expiry, created_at, updated_at) VALUES (?, ?, 0.00, 0.000, 1.000, NULL, NOW(), NOW())");
            $ins->bind_param('ss', $normalizedName, $unit);
            if ($ins->execute()) {
                $created++;
            }
            $ins->close();
        }

        echo json_encode(["success" => true, "created" => $created]);
        $conn->close();
        exit;
    }

    // stock adjustments (in/out)
    $ingredient_id = isset($data['ingredient_id']) ? (int)$data['ingredient_id'] : 0;
    $qty = isset($data['qty']) ? floatval($data['qty']) : 0;
    $note = $conn->real_escape_string($data['note'] ?? '');

    if (!$ingredient_id || $qty <= 0 || !in_array($action, ['stock_in','stock_out'])) {
        echo json_encode(["success" => false, "message" => "Missing or invalid parameters"]);
        $conn->close();
        exit;
    }

    $conn->begin_transaction();

    // Lock the row so concurrent adjustments cannot overwrite each other.
    $stmt = $conn->prepare("SELECT stock, name, threshold FROM ingredients WHERE id = ? LIMIT 1 FOR UPDATE");
    $stmt->bind_param('i', $ingredient_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        $current = floatval($row['stock']);
        $ingredientName = trim((string) ($row['name'] ?? 'Ingredient'));
        $threshold = (float) ($row['threshold'] ?? 0);
    } else {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Ingredient not found"]);
        $stmt->close();
        $conn->close();
        exit;
    }
    $stmt->close();

    if ($action === 'stock_in') {
        $newStock = $current + $qty;
    } else {
        if ($qty > $current) {
            $conn->rollback();
            echo json_encode(["success" => false, "message" => "Insufficient ingredient stock"]);
            $conn->close();
            exit;
        }
        $newStock = $current - $qty;
    }

    // Update stock
    $u = $conn->prepare("UPDATE ingredients SET stock = ?, updated_at = NOW() WHERE id = ? AND stock = ?");
    $u->bind_param('did', $newStock, $ingredient_id, $current);
    $ok = $u->execute();
    $u->close();

    if (!$ok || $conn->affected_rows !== 1) {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to update stock"]);
        $conn->close();
        exit;
    }

    $currentUserId = getSessionUserId();
    $ins = $conn->prepare("INSERT INTO ingredient_movements (ingredient_id, action, qty, note, user_id) VALUES (?, ?, ?, ?, ?)");
    $ins->bind_param('isdsi', $ingredient_id, $action, $qty, $note, $currentUserId);
    if (!$ins->execute()) {
        $ins->close();
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to record stock movement"]);
        $conn->close();
        exit;
    }
    $ins->close();

    createLowStockAlert($conn, $ingredient_id, $ingredientName, $current, $newStock, $threshold);
    $conn->commit();
    if ($currentUserId > 0) {
        insertAuditLog($conn, $currentUserId, 'ingredients', $action, 'ingredient', $ingredient_id, $note);
    }

    echo json_encode(["success" => true, "ingredient_id" => $ingredient_id, "new_stock" => $newStock]);
    $conn->close();
    exit;
}


$sql = "SELECT id, name, unit, stock, threshold, expiry, created_at, updated_at,
           (SELECT COUNT(*) FROM ingredient_batches b WHERE b.ingredient_id = ingredients.id) AS batch_count,
           (SELECT COUNT(*) FROM ingredient_batches b WHERE b.ingredient_id = ingredients.id AND b.quantity_remaining > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date < CURDATE()) AS expired_batch_count,
           (SELECT COUNT(*) FROM discard_requests d WHERE d.ingredient_id = ingredients.id AND d.status = 'Pending') AS pending_discard_count
               ,(SELECT COUNT(*) FROM ingredient_batches b WHERE b.ingredient_id = ingredients.id AND b.quantity_remaining <= 0) AS discarded_batch_count
    FROM ingredients ORDER BY name ASC";
$result = $conn->query($sql);

$ingredients = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $ingredients[] = [
            "id" => (int) $row["id"],
            "name" => $row["name"],
            "unit" => $row["unit"],
            "stock" => (int) ($row["stock"] ?? 0),
            "threshold" => (int) ($row["threshold"] ?? 0),
            "expiry" => $row["expiry"],
            "created_at" => $row["created_at"],
            "updated_at" => $row["updated_at"],
            "batch_count" => (int) ($row["batch_count"] ?? 0),
            "expired_batch_count" => (int) ($row["expired_batch_count"] ?? 0),
            "pending_discard_count" => (int) ($row["pending_discard_count"] ?? 0),
            "discarded_batch_count" => (int) ($row["discarded_batch_count"] ?? 0),
        ];
    }
}

echo json_encode(["success" => true, "ingredients" => $ingredients]);
$conn->close();