<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/api_auth.php';

requireInventoryWrite();

$conn = new mysqli('localhost', 'root', '', 'pastry_db');
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}
$conn->set_charset('utf8mb4');

function salesJson(bool $success, array $payload = [], int $status = 200): void
{
    http_response_code($status);
    echo json_encode(array_merge(['success' => $success], $payload));
    exit;
}

function salesDate(string $value): ?string
{
    $value = trim($value);
    if ($value === '') return null;
    if (is_numeric($value) && (float) $value > 1 && (float) $value < 100000) {
        $excelDate = (new DateTimeImmutable('1899-12-30'))->modify('+' . (int) $value . ' days');
        return $excelDate->format('Y-m-d');
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if ($date && $date->format('Y-m-d') === $value) return $value;
    $timestamp = strtotime($value);
    return $timestamp === false ? null : date('Y-m-d', $timestamp);
}

function salesNumber(mixed $value): ?float
{
    if ($value === null || trim((string) $value) === '') return null;
    $clean = str_replace([',', '₱', '$', 'PHP', 'php', '%', ' '], '', (string) $value);
    return is_numeric($clean) ? (float) $clean : null;
}

function rowValue(array $row, array $keys): mixed
{
    foreach ($keys as $key) {
        foreach ($row as $header => $value) {
                $normalized = strtolower(preg_replace('/[^a-z0-9]+/', '', (string) $header));
                $normalizedKey = strtolower(preg_replace('/[^a-z0-9]+/', '', $key));
                if ($normalized === $normalizedKey) return $value;
        }
    }
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $start = salesDate((string) ($_GET['start_date'] ?? ''));
    $end = salesDate((string) ($_GET['end_date'] ?? ''));
    $where = ['1 = 1'];
    $types = '';
    $values = [];
    if ($start) { $where[] = 'sale_date >= ?'; $types .= 's'; $values[] = $start; }
    if ($end) { $where[] = 'sale_date <= ?'; $types .= 's'; $values[] = $end; }
    $whereSql = implode(' AND ', $where);

    $summaryStmt = $conn->prepare("SELECT COUNT(*) AS records, COALESCE(SUM(price), 0) AS total_sales, COALESCE(SUM(down_payment), 0) AS total_down_payments, COALESCE(SUM(remaining_balance), 0) AS total_remaining_balance FROM sales WHERE {$whereSql}");
    if ($types) $summaryStmt->bind_param($types, ...$values);
    $summaryStmt->execute();
    $summary = $summaryStmt->get_result()->fetch_assoc() ?: [];
    $summaryStmt->close();

    $rowsStmt = $conn->prepare("SELECT id, cake_name, price, down_payment, remaining_balance, sale_date, source, created_at FROM sales WHERE {$whereSql} ORDER BY sale_date DESC, id DESC");
    if ($types) $rowsStmt->bind_param($types, ...$values);
    $rowsStmt->execute();
    $result = $rowsStmt->get_result();
    $rows = [];
    while ($row = $result->fetch_assoc()) $rows[] = $row;
    $rowsStmt->close();
    salesJson(true, ['sales' => $rows, 'summary' => [
        'records' => (int) ($summary['records'] ?? 0),
        'total_sales' => (float) ($summary['total_sales'] ?? 0),
        'total_down_payments' => (float) ($summary['total_down_payments'] ?? 0),
        'total_remaining_balance' => (float) ($summary['total_remaining_balance'] ?? 0),
    ]]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') salesJson(false, ['message' => 'Method not allowed.'], 405);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) salesJson(false, ['message' => 'Invalid import payload.'], 400);
$rows = $body['rows'] ?? [];
$importDate = salesDate((string) ($body['import_date'] ?? ''));
$batchHash = strtolower(trim((string) ($body['file_hash'] ?? '')));
if (!is_array($rows) || count($rows) > 5000) salesJson(false, ['message' => 'The import must contain between 1 and 5,000 rows.'], 400);
if (!$importDate) salesJson(false, ['message' => 'A valid Import Date is required.'], 400);
if (!preg_match('/^[a-f0-9]{64}$/', $batchHash)) salesJson(false, ['message' => 'Invalid file hash.'], 400);

$normalizedRows = [];
$errors = 0;
$skipped = max(0, (int) ($body['skipped_rows'] ?? 0));
$errorDetails = [];
foreach ($rows as $index => $row) {
    $csvRow = is_array($row) ? (int) ($row['__csv_row'] ?? ($index + 1)) : ($index + 1);
    $dataRow = is_array($row) ? array_diff_key($row, ['__csv_row' => true]) : [];
    if (!is_array($row) || count(array_filter($dataRow, static fn($value) => trim((string) $value) !== '')) === 0) {
        $skipped++;
        continue;
    }
    $name = trim((string) rowValue($row, ['cake_name', 'customized_cake_name', 'cake_customized_cake_name', 'design', 'item_name', 'product_name', 'product', 'item', 'name', 'cake']));
    $price = salesNumber(rowValue($row, ['price', 'total', 'total_amount', 'amount']));
    $down = salesNumber(rowValue($row, ['down_payment', 'downpayment', 'forty_percent', '40_percent', '40_down_payment', '40_', '40']));
    $balance = salesNumber(rowValue($row, ['remaining_balance', 'sixty_percent_remaining_balance', '60_remaining_balance', 'balance', 'sixty_percent', '60_percent', '60_balance', '60_', '60']));
    $date = salesDate((string) rowValue($row, ['sale_date', 'sales_date', 'date', 'order_date'])) ?: $importDate;

    $rowErrors = [];
    if ($name === '') $rowErrors[] = 'missing DESIGN';
    if (mb_strlen($name) > 255) $rowErrors[] = 'DESIGN is too long';
    if ($price === null || $price <= 0) $rowErrors[] = 'invalid PRICE';
    if ($down !== null && $down < 0) $rowErrors[] = 'invalid 40% value';
    if ($balance !== null && $balance < 0) $rowErrors[] = 'invalid 60% value';
    if (!$date) $rowErrors[] = 'invalid DATE';
    if ($rowErrors) {
        $errors++;
        $errorDetails[] = ['row' => $csvRow, 'errors' => $rowErrors];
        continue;
    }
    $expectedDown = round($price * 0.40, 2);
    $expectedBalance = round($price * 0.60, 2);
    $normalizedRows[] = [
        'csv_row' => $csvRow,
        'cake_name' => $name,
        'price' => round($price, 2),
        'down_payment' => $expectedDown,
        'remaining_balance' => $expectedBalance,
        'sale_date' => $date,
    ];
}
if (!$normalizedRows) salesJson(false, ['message' => 'No valid sales rows were found. Check that the CSV has DATE, DESIGN, and numeric PRICE columns.', 'received' => count($rows), 'imported' => 0, 'skipped' => $skipped, 'errors' => $errors, 'error_details' => $errorDetails], 422);

$fingerprintRows = array_map(static fn($row) => implode('|', $row), $normalizedRows);
sort($fingerprintRows);
$duplicateStmt = $conn->prepare('SELECT COUNT(*) FROM sales WHERE import_batch_hash = ?');
$duplicateStmt->bind_param('s', $batchHash);
$duplicateStmt->execute();
$duplicateBatchCount = (int) $duplicateStmt->get_result()->fetch_row()[0];
$duplicateStmt->close();

$uniqueRows = [];
foreach ($normalizedRows as $row) {
    $rowKey = strtolower($row['cake_name']) . '|' . $row['price'] . '|' . $row['sale_date'];
    if (isset($uniqueRows[$rowKey])) {
        $skipped++;
        continue;
    }
    $uniqueRows[$rowKey] = $row;
}
$normalizedRows = array_values($uniqueRows);

$conn->begin_transaction();
$importedCount = 0;
try {
    $stmt = $conn->prepare('INSERT INTO sales (cake_name, price, down_payment, remaining_balance, sale_date, source, import_batch_hash, data_fingerprint) VALUES (?, ?, ?, ?, ?, \'excel_import\', ?, ?)');
    $existingStmt = $conn->prepare('SELECT id FROM sales WHERE data_fingerprint = ? LIMIT 1');
    foreach ($normalizedRows as $row) {
        $dataFingerprint = hash('sha256', implode('|', [$row['cake_name'], $row['price'], $row['down_payment'], $row['remaining_balance'], $row['sale_date']]));
        $existingStmt->bind_param('s', $dataFingerprint);
        $existingStmt->execute();
        if ($existingStmt->get_result()->num_rows > 0) {
            $skipped++;
            continue;
        }
        $stmt->bind_param('sdddsss', $row['cake_name'], $row['price'], $row['down_payment'], $row['remaining_balance'], $row['sale_date'], $batchHash, $dataFingerprint);
        if (!$stmt->execute()) {
            $dbError = $stmt->error ?: $conn->error;
            throw new RuntimeException("CSV row {$row['csv_row']} ({$row['cake_name']}): {$dbError}");
        }
        $importedCount++;
    }
    $existingStmt->close();
    $stmt->close();
    $conn->commit();
} catch (Throwable $error) {
    $conn->rollback();
    salesJson(false, [
        'message' => 'Import failed while saving sales records.',
        'imported' => 0,
        'skipped' => $skipped,
        'errors' => 1,
        'error_details' => [['row' => $row['csv_row'] ?? null, 'design' => $row['cake_name'] ?? null, 'errors' => [$error->getMessage()]]],
    ], 500);
}
if ($importedCount === 0 && $duplicateBatchCount > 0 && $errors === 0) {
    salesJson(false, ['message' => 'This CSV file has already been imported.', 'imported' => 0, 'skipped' => count($rows), 'errors' => 0, 'duplicate' => true], 409);
}
salesJson(true, ['message' => 'Sales imported successfully.', 'imported' => $importedCount, 'skipped' => $skipped, 'errors' => $errors, 'error_details' => $errorDetails, 'summary' => ['total_sales' => array_sum(array_column($normalizedRows, 'price')), 'total_down_payments' => array_sum(array_column($normalizedRows, 'down_payment')), 'total_remaining_balance' => array_sum(array_column($normalizedRows, 'remaining_balance'))]]);
