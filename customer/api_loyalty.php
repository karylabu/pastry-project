<?php
require_once __DIR__ . '/cors.php';

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @mysqli_connect('localhost', 'root', '', 'pastry_db');

if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

$conn->query("CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT NULL,
    type ENUM('earn', 'redeem') NOT NULL,
    points INT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100,
    reward_code VARCHAR(32) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_loyalty_order (order_id),
    INDEX idx_loyalty_user (user_id, created_at)
) ENGINE=InnoDB");
$conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0");
$conn->query("ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS max_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 100");

$userId = intval($_GET['user_id'] ?? $_POST['user_id'] ?? 0);
$action = $_GET['action'] ?? $_POST['action'] ?? 'summary';

if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'User is required']);
    exit;
}

if ($action === 'redeem' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $points = intval($_POST['points'] ?? 0);
    if ($points !== 1000) {
        echo json_encode(['success' => false, 'message' => 'You need exactly 1,000 points to redeem a 5% discount.']);
        exit;
    }

    $balanceResult = $conn->query("SELECT COALESCE(SUM(points), 0) AS balance FROM loyalty_transactions WHERE user_id = {$userId}");
    $balanceRow = $balanceResult ? $balanceResult->fetch_assoc() : [];
    $balance = intval($balanceRow['balance'] ?? 0);
    if ($points > $balance) {
        echo json_encode(['success' => false, 'message' => 'Not enough points.']);
        exit;
    }

    $discountPercent = 5;
    $maxDiscountAmount = 100;
    $code = 'PPR-' . strtoupper(bin2hex(random_bytes(4)));
    $stmt = $conn->prepare("INSERT INTO loyalty_transactions (user_id, type, points, discount_percent, max_discount_amount, reward_code) VALUES (?, 'redeem', ?, ?, ?, ?)");
    $stmt->bind_param('iidds', $userId, $pointsToDeduct, $discountPercent, $maxDiscountAmount, $code);
    $pointsToDeduct = -$points;
    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode($ok
        ? ['success' => true, 'message' => 'Reward created', 'reward_code' => $code, 'points' => $points, 'discount_percent' => $discountPercent]
        : ['success' => false, 'message' => 'Could not redeem points']);
    exit;
}

$summary = $conn->query("SELECT COALESCE(SUM(points), 0) AS balance, COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS earned FROM loyalty_transactions WHERE user_id = {$userId}")->fetch_assoc();
$historyStmt = $conn->query("SELECT id, user_id, order_id, type, points, reward_code, created_at FROM loyalty_transactions WHERE user_id = {$userId} ORDER BY id DESC LIMIT 20");
$history = [];
while ($entry = $historyStmt ? $historyStmt->fetch_assoc() : null) {
    $label = 'Reward';
    if ($entry['type'] === 'earn') {
        $label = $entry['order_id'] ? "Order #{$entry['order_id']}" : 'Order bonus';
    } elseif ($entry['type'] === 'redeem') {
        $label = 'Free Delivery';
    }

    $history[] = [
        'type' => $entry['type'],
        'points' => intval($entry['points'] ?? 0),
        'order_id' => intval($entry['order_id'] ?? 0),
        'reward_code' => $entry['reward_code'] ?? '',
        'label' => $label,
        'created_at' => $entry['created_at'] ?? null,
    ];
}

$rewards = $conn->query("SELECT reward_code, points, discount_amount, discount_percent, max_discount_amount, created_at FROM loyalty_transactions WHERE user_id = {$userId} AND type = 'redeem' ORDER BY id DESC LIMIT 10");
$recentRewards = [];
while ($reward = $rewards->fetch_assoc()) {
    $recentRewards[] = $reward;
}

$conn->close();
echo json_encode([
    'success' => true,
    'balance' => max(0, intval($summary['balance'] ?? 0)),
    'earned' => intval($summary['earned'] ?? 0),
    'points_per_hundred' => 10,
    'discount_percent' => 5,
    'max_discount_amount' => 100,
    'minimum_redeem_points' => 1000,
    'rewards' => $recentRewards,
    'history' => $history,
]);
