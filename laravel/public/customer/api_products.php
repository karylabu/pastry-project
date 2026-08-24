<?php
require_once __DIR__ . '/cors.php';

/* ================= OPTIONS ================= */

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

/* ================= DATABASE ================= */

$host = 'localhost';
$db   = 'pastry_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {

    $pdo = new PDO($dsn, $user, $pass, $options);

} catch (\PDOException $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

    exit;
}

/* ================= ACTION ================= */

$action = $_GET['action'] ?? 'list';

/* =========================================================
   1. GET PRODUCTS
========================================================= */

if ($action === 'list') {

    $stmt = $pdo->query("
        SELECT *
        FROM products
        WHERE available = 1
    ");

    echo json_encode($stmt->fetchAll());

    exit;
}

/* =========================================================
   2. CUSTOM CAKE ORDER
========================================================= */

if ($action === 'customize' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    try {

        $pdo->beginTransaction();

        /* ================= FORM DATA ================= */

        $flavor     = $_POST['flavor'] ?? '';
        $tiers      = $_POST['tiers'] ?? '';
        $dedication = $_POST['dedication'] ?? '';
        $method     = $_POST['method'] ?? '';
        $date       = $_POST['date'] ?? '';
        $time       = $_POST['time'] ?? '';
        $notes      = $_POST['notes'] ?? '';

        /* ================= IMAGE UPLOAD ================= */

        $uploaded_images = [];

        if (!empty($_FILES['inspo_images'])) {

            $target_dir = "../uploads/inspo/";

            if (!is_dir($target_dir)) {
                mkdir($target_dir, 0777, true);
            }

            foreach ($_FILES['inspo_images']['tmp_name'] as $key => $tmp_name) {

                if ($_FILES['inspo_images']['error'][$key] === 0) {

                    $original_name = $_FILES['inspo_images']['name'][$key];

                    $file_ext = pathinfo($original_name, PATHINFO_EXTENSION);

                    $new_file_name =
                        "inspo_" .
                        time() .
                        "_" .
                        $key .
                        "." .
                        $file_ext;

                    if (
                        move_uploaded_file(
                            $tmp_name,
                            $target_dir . $new_file_name
                        )
                    ) {

                        $uploaded_images[] = $new_file_name;
                    }
                }
            }
        }

        $images_json = json_encode($uploaded_images);

        /* ================= INSERT ORDER ================= */

        $sql1 = "
            INSERT INTO orders
            (
                customer,
                email,
                type,
                status,
                total,
                payment,
                address,
                notes,
                order_date,
                is_customized
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
        ";

        $stmt1 = $pdo->prepare($sql1);

        $stmt1->execute([
            'Guest Customer',
            'guest@email.com',
            'Custom',
            'Pending',
            0,
            'COD',
            '',
            $notes,
            1
        ]);

        $order_id = $pdo->lastInsertId();

        /* ================= INSERT CUSTOM DETAILS ================= */

        $sql2 = "
            INSERT INTO custom_cake_orders
            (
                order_id,
                flavor,
                tiers,
                dedication,
                delivery_method,
                delivery_date,
                delivery_time,
                notes,
                inspo_images
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";

        $stmt2 = $pdo->prepare($sql2);

        $stmt2->execute([
            $order_id,
            $flavor,
            $tiers,
            $dedication,
            $method,
            $date,
            $time,
            $notes,
            $images_json
        ]);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Custom cake request submitted successfully!",
            "order_id" => $order_id
        ]);

    } catch (Exception $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "error" => $e->getMessage()
        ]);
    }

    exit;
}

/* =========================================================
   3. REGULAR ORDER
========================================================= */

if ($action === 'add' && $_SERVER['REQUEST_METHOD'] === 'POST') {

    try {

        $pdo->beginTransaction();

        $input = json_decode(file_get_contents("php://input"), true);

        $items   = $input['items'] ?? [];
        $total   = $input['total'] ?? 0;
        $address = $input['address'] ?? '';

        /* ================= INSERT ORDER ================= */

        $sql = "
            INSERT INTO orders
            (
                customer,
                email,
                type,
                status,
                total,
                payment,
                address,
                notes,
                order_date,
                is_customized
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'Guest Customer',
            'guest@email.com',
            'Standard',
            'Pending',
            $total,
            'COD',
            $address,
            '',
            0
        ]);

        $order_id = $pdo->lastInsertId();

        /* ================= INSERT ORDER ITEMS ================= */

        foreach ($items as $item) {

            $name     = $item['name'] ?? '';
            $variant  = $item['variant'] ?? '';
            $qty      = $item['qty'] ?? 1;
            $price    = $item['price'] ?? 0;

            $details = isset($item['selectionDetails'])
                ? json_encode($item['selectionDetails'])
                : '';

            $item_sql = "
                INSERT INTO order_items
                (
                    order_id,
                    product,
                    variant,
                    qty,
                    price,
                    details
                )
                VALUES
                (?, ?, ?, ?, ?, ?)
            ";

            $item_stmt = $pdo->prepare($item_sql);

            $item_stmt->execute([
                $order_id,
                $name,
                $variant,
                $qty,
                $price,
                $details
            ]);
        }

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "Order placed successfully!",
            "order_id" => $order_id
        ]);

    } catch (Exception $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo json_encode([
            "success" => false,
            "error" => $e->getMessage()
        ]);
    }

    exit;
}

/* =========================================================
   INVALID ACTION
========================================================= */

echo json_encode([
    "success" => false,
    "error" => "Invalid action requested"
]);

?>
