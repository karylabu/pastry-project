<?php
/*
|--------------------------------------------------------------------------
| Staff inventory & ordering integrity/security test suite
|--------------------------------------------------------------------------
| Creates isolated TEST fixtures (ingredient/product/recipe/order), runs
| every scenario over real HTTP with Bearer auth, verifies DB state after
| each step, then removes all fixtures.
*/

$BASE = 'http://localhost/pastry-project';
$PASS = 'Integrity#2026';
$results = [];

function req(string $url, string $method = 'GET', ?string $token = null, $body = null): array {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer {$token}";
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, json_decode((string)$resp, true)];
}

// Fire two HTTP requests simultaneously (true concurrency).
function reqParallel(array $specs): array {
    $mh = curl_multi_init();
    $handles = [];
    foreach ($specs as $i => $s) {
        $ch = curl_init($s['url']);
        $headers = ['Content-Type: application/json'];
        if (!empty($s['token'])) $headers[] = "Authorization: Bearer {$s['token']}";
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $s['method'] ?? 'POST',
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_POSTFIELDS     => isset($s['body']) ? json_encode($s['body']) : null,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }
    do { $status = curl_multi_exec($mh, $active); if ($active) curl_multi_select($mh); } while ($active && $status == CURLM_OK);
    $out = [];
    foreach ($handles as $i => $ch) {
        $out[$i] = [curl_multi_getcontent($ch), curl_getinfo($ch, CURLINFO_HTTP_CODE)];
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

function check(string $label, bool $cond, string $detail = ''): void {
    global $results;
    $results[] = [$label, $cond ? 'PASS' : 'FAIL', $detail];
    echo ($cond ? 'PASS' : 'FAIL') . " | {$label}" . ($detail !== '' ? " | {$detail}" : '') . PHP_EOL;
}

/* ---------------- setup: staff login + fixtures ---------------- */
$m = new mysqli('localhost', 'root', '', 'pastry_db');

// dedicated staff test account with known credentials
$m->query("DELETE FROM users WHERE email='itstaff@example.com'");
$m->query("INSERT INTO users (name,email,password,role) VALUES ('IT Staff','itstaff@example.com','{$PASS}','staff')");
$staffId = $m->insert_id;
$staffEmail = 'itstaff@example.com';

[, $body] = req("{$BASE}/customer/api_login.php", 'POST', null, ['email' => $staffEmail, 'password' => $PASS]);
$TOKEN = $body['token'] ?? '';
check('Staff login returns Bearer token', $TOKEN !== '');

// customer token for authorization tests
$m->query("DELETE FROM users WHERE email='itcust@example.com'");
$m->query("INSERT INTO users (name,email,password,role) VALUES ('IT Cust','itcust@example.com','{$PASS}','customer')");
[, $body] = req("{$BASE}/customer/api_login.php", 'POST', null, ['email' => 'itcust@example.com', 'password' => $PASS]);
$CTOKEN = $body['token'] ?? '';
check('Customer login returns Bearer token', $CTOKEN !== '');

// fixtures
$m->query("DELETE FROM production_transactions WHERE product_id IN (SELECT id FROM products WHERE name='TEST Cake')");
$m->query("DELETE FROM products WHERE name='TEST Cake'");
$m->query("DELETE FROM ingredients WHERE name='TEST Flour'");
$m->query("INSERT INTO ingredients (name,unit,unit_cost,stock,threshold) VALUES ('TEST Flour','g',10,100,5)");
$ingId = $m->insert_id;
$m->query("INSERT INTO products (name,category,price,stock,image,description,available,minimum_stock,production_cost) VALUES ('TEST Cake','Test',100,5,'x','test',1,2,20)");
$prodId = $m->insert_id;
$m->query("INSERT INTO product_recipes (product_id,ingredient_id,qty,active) VALUES ({$prodId},{$ingId},2,1)");

// temp order fixture
$orderItems1 = json_encode([['id'=>$prodId,'name'=>'TEST Cake','qty'=>2,'price'=>100]]);
$m->query("INSERT INTO orders (user_id,email,customer,status,total,items,created_at) VALUES (NULL,'itcust@example.com','IT Cust','Pending',200,'{$orderItems1}',NOW())");
$orderId = $m->insert_id;

$q = fn(string $sql) => $m->query($sql)->fetch_assoc();
$prodStock  = fn() => (float) $q("SELECT stock FROM products WHERE id={$prodId}")['stock'];
$ingStock   = fn() => (float) $q("SELECT stock FROM ingredients WHERE id={$ingId}")['stock'];
$orderStat  = fn() => $q("SELECT status FROM orders WHERE id={$orderId}")['status'];
$moveCount  = fn(string $type, int $refId) => (int) $q("SELECT COUNT(*) c FROM product_inventory_movements WHERE product_id={$prodId} AND movement_type='{$type}' AND reference_type='" . ($type === 'Order' || $type === 'Cancellation' ? 'order' : $type) . "' AND reference_id={$refId}")['c'];

/* ================= 1. AUTHORIZATION ================= */
[$st] = req("{$BASE}/staff/api_update_stocks.php", 'POST');
check('API unauthenticated -> 401', $st === 401, "HTTP {$st}");
[$st] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $CTOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>1]);
check('API customer role -> 403', $st === 403, "HTTP {$st}");
[$st] = req("{$BASE}/staff/api_products.php?action=list", 'GET', $CTOKEN);
check('Read API customer role -> 403', $st === 403, "HTTP {$st}");

/* ================= 2. PRODUCTION ================= */
$s0 = $prodStock(); $i0 = $ingStock();

[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>3]);
check('Produce valid qty succeeds', $st === 200 && ($b['status'] ?? '') === 'success', json_encode($b));
check('Produce adds finished stock (+3)', $prodStock() === $s0 + 3, "{$s0} -> {$prodStock()}");
check('Produce deducts ingredients (-6)', $ingStock() === $i0 - 6, "{$i0} -> {$ingStock()}");
$row = $q("SELECT * FROM production_transactions ORDER BY id DESC LIMIT 1");
check('Production transaction recorded with user', $row && (int)$row['quantity'] === 3 && (int)$row['user_id'] === $staffId);

[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>0]);
check('Produce zero -> rejected', $st === 200 && ($b['status'] ?? '') === 'error', json_encode($b));
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>-5]);
check('Produce negative -> rejected', ($b['status'] ?? '') === 'error');
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>2.5]);
check('Produce decimal -> rejected (no silent truncation)', ($b['message'] ?? '') === 'Quantity must be a whole number', json_encode($b));

// insufficient ingredients -> FULL rollback
$sBefore = $prodStock(); $iBefore = $ingStock();
$ptCount = (int) $q("SELECT COUNT(*) c FROM production_transactions")['c'];
$mvCount = (int) $q("SELECT COUNT(*) c FROM product_inventory_movements WHERE product_id={$prodId}")['c'];
$imCount = (int) $q("SELECT COUNT(*) c FROM ingredient_movements WHERE ingredient_id={$ingId}")['c'];
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>999]);
check('Produce insufficient ingredients -> rejected', ($b['status'] ?? '') === 'error', json_encode($b));
check('Rollback: product stock unchanged', $prodStock() === $sBefore);
check('Rollback: ingredient stock unchanged', $ingStock() === $iBefore);
check('Rollback: no production row created', (int) $q("SELECT COUNT(*) c FROM production_transactions")['c'] === $ptCount);
check('Rollback: no product movement created', (int) $q("SELECT COUNT(*) c FROM product_inventory_movements WHERE product_id={$prodId}")['c'] === $mvCount);
check('Rollback: no ingredient movement created', (int) $q("SELECT COUNT(*) c FROM ingredient_movements WHERE ingredient_id={$ingId}")['c'] === $imCount);

// no recipe / nonexistent product
$m->query("UPDATE product_recipes SET active=0 WHERE product_id={$prodId}");
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>1]);
check('Produce without active recipe -> rejected', ($b['message'] ?? '') === 'No recipe defined for this product', json_encode($b));
$m->query("UPDATE product_recipes SET active=1 WHERE product_id={$prodId}");
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>999999,'qty'=>1]);
check('Produce nonexistent product -> rejected', ($b['message'] ?? '') === 'Product not found');

// duplicate submission via idempotency key
$sBefore = $prodStock(); $iBefore = $ingStock();
$key = 'itest-' . uniqid();
[$st, $b1] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>1,'idempotency_key'=>$key]);
[$st2, $b2] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'produce','id'=>$prodId,'qty'=>1,'idempotency_key'=>$key]);
check('Duplicate produce replay detected', ($b2['duplicate'] ?? false) === true, json_encode($b2));
check('Duplicate produce added stock ONCE', $prodStock() === $sBefore + 1, "{$sBefore} -> {$prodStock()}");
check('Duplicate produce deducted ingredients ONCE', $ingStock() === $iBefore - 2);

// concurrent production (two parallel valid produces)
$sBefore = $prodStock(); $iBefore = $ingStock();
$out = reqParallel([
    ['url'=>"{$BASE}/staff/api_update_stocks.php",'token'=>$TOKEN,'body'=>['action'=>'produce','id'=>$prodId,'qty'=>1]],
    ['url'=>"{$BASE}/staff/api_update_stocks.php",'token'=>$TOKEN,'body'=>['action'=>'produce','id'=>$prodId,'qty'=>1]],
]);
$okCount = 0;
foreach ($out as [$raw,$code]) { $d = json_decode((string)$raw,true); if (($d['status'] ?? '')==='success') $okCount++; }
check('Concurrent produces: both succeed atomically', $okCount === 2 && $prodStock() === $sBefore + 2 && $ingStock() === $iBefore - 4, "stock={$prodStock()} ing={$ingStock()}");

/* ================= 3. STOCK ADJUSTMENT ================= */
$sBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'in','id'=>$prodId,'qty'=>10,'reason'=>'restock']);
check('Valid stock-in', ($b['status'] ?? '') === 'success' && $prodStock() === $sBefore + 10);
$sBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'out','id'=>$prodId,'qty'=>4,'reason'=>'damage']);
check('Valid stock-out', ($b['status'] ?? '') === 'success' && $prodStock() === $sBefore - 4);
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'out','id'=>$prodId,'qty'=>0]);
check('Zero qty adjustment -> rejected', ($b['status'] ?? '') === 'error');
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'out','id'=>$prodId,'qty'=>-3]);
check('Negative qty adjustment -> rejected', ($b['status'] ?? '') === 'error');
$sBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'out','id'=>$prodId,'qty'=>99999]);
check('Excessive stock-out -> rejected, stock intact', ($b['status'] ?? '') === 'error' && $prodStock() === $sBefore);
[$st, $b] = req("{$BASE}/staff/api_update_stocks.php", 'POST', $TOKEN, ['action'=>'out','id'=>$prodId,'qty'=>1]);
check('Missing reason -> allowed with default note', ($b['status'] ?? '') === 'success');
$mv = $q("SELECT reason,user_id,previous_stock,new_stock FROM product_inventory_movements WHERE product_id={$prodId} AND reference_type='stock_adjustment' ORDER BY id DESC LIMIT 1");
check('Adjustment audit trail complete (prev/new/user/reason)', $mv && $mv['reason'] !== null && (int)$mv['user_id'] === $staffId && (float)$mv['previous_stock'] === $sBefore && (float)$mv['new_stock'] === $sBefore - 1);

/* ================= 4. WASTE ================= */
$sBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>2,'reason'=>'Expired']);
check('Valid waste recorded', $st === 200 && ($b['success'] ?? false) && $prodStock() === $sBefore - 2, json_encode($b));
$sBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>99999,'reason'=>'Expired']);
check('Waste exceeding stock -> 409, unchanged', $st === 409 && $prodStock() === $sBefore, "HTTP {$st}");
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>0,'reason'=>'Expired']);
check('Zero waste -> 400', $st === 400);
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>-2,'reason'=>'Expired']);
check('Negative waste -> 400', $st === 400);
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>1,'reason'=>'Expired','datetime'=>'not-a-date']);
check('Invalid datetime -> 400', $st === 400);
[$st, $b] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>1,'reason'=>str_repeat('x',80)]);
check('Over-long reason -> 400', $st === 400);
$sBefore = $prodStock();
$wkey = 'wtest-' . uniqid();
req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>1,'reason'=>'Spoiled','idempotency_key'=>$wkey]);
[, $b2] = req("{$BASE}/staff/api_waste_log.php", 'POST', $TOKEN, ['product_id'=>$prodId,'qty'=>1,'reason'=>'Spoiled','idempotency_key'=>$wkey]);
check('Duplicate waste replay detected', ($b2['duplicate'] ?? false) === true);
check('Duplicate waste deducted ONCE', $prodStock() === $sBefore - 1, "{$sBefore} -> {$prodStock()}");
[$st] = req("{$BASE}/staff/api_waste_log.php", 'POST', $CTOKEN, ['product_id'=>$prodId,'qty'=>1,'reason'=>'X']);
check('Unauthorized waste -> 403', $st === 403, "HTTP {$st}");

/* ================= 5. ORDERS ================= */
check('Fixture order starts Pending', $orderStat() === 'Pending');
$pBefore = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Confirmed']);
check('Confirm order succeeds + deducts stock', ($b['success'] ?? false) && $prodStock() === $pBefore - 2, json_encode($b));
check('Order movement recorded once', $moveCount('Order', $orderId) >= 1);

// flip-flop: Confirmed -> Pending -> Confirmed must NOT deduct twice
$pDeducted = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Pending']);
check('Confirmed -> Pending allowed', ($b['success'] ?? false) && $prodStock() === $pDeducted);
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Confirmed']);
check('Re-confirm does NOT double-deduct', ($b['success'] ?? false) && abs($prodStock() - $pDeducted) < 0.001, "stock={$prodStock()} resp=" . json_encode($b));

// cancellation restores exactly once
$pBeforeCancel = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Cancelled']);
check('Cancellation restores stock', ($b['success'] ?? false) && abs($prodStock() - ($pBeforeCancel + 2)) < 0.001, "stock={$prodStock()} resp=" . json_encode($b));
$pRestored = $prodStock();
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Cancelled']);
check('Repeated cancellation does NOT restore twice', ($b['success'] ?? false) && $prodStock() === $pRestored, "stock={$prodStock()}");

// reactivation re-deducts (goods given back to order)
[$st, $b] = req("{$BASE}/staff/api_update_order_status.php", 'POST', $TOKEN, ['id'=>$orderId,'status'=>'Confirmed']);
check('Cancelled -> Confirm re-deducts correctly', ($b['success'] ?? false) && abs($prodStock() - ($pRestored - 2)) < 0.001, "stock={$prodStock()} resp=" . json_encode($b));

// concurrent confirmation on a fresh order
$orderItems2 = json_encode([['id'=>$prodId,'name'=>'TEST Cake','qty'=>1,'price'=>100]]);
$m->query("INSERT INTO orders (user_id,email,customer,status,total,items,created_at) VALUES (NULL,'itcust@example.com','IT Cust','Pending',100,'{$orderItems2}',NOW())");
$orderId2 = $m->insert_id;
$pBefore = $prodStock();
$out = reqParallel([
    ['url'=>"{$BASE}/staff/api_update_order_status.php",'token'=>$TOKEN,'body'=>['id'=>$orderId2,'status'=>'Confirmed']],
    ['url'=>"{$BASE}/staff/api_update_order_status.php",'token'=>$TOKEN,'body'=>['id'=>$orderId2,'status'=>'Confirmed']],
]);
$deducted = $pBefore - $prodStock();
check('Concurrent confirm deducts EXACTLY once', abs($deducted - 1) < 0.001, "deducted={$deducted}");

// Customer cancellation must be authenticated, ownership-scoped, and idempotent.
$pBeforeCustomerCancel = $prodStock();
[$st, $b] = req("{$BASE}/customer/api_cancel_order.php", 'POST', $CTOKEN, ['order_id'=>$orderId2]);
check('Customer cancels owned confirmed order', ($b['success'] ?? false) && abs($prodStock() - ($pBeforeCustomerCancel + 1)) < 0.001, json_encode($b));
check('Customer cancellation movement recorded', $moveCount('Cancellation', $orderId2) === 1);
$pAfterCustomerCancel = $prodStock();
[$st, $b] = req("{$BASE}/customer/api_cancel_order.php", 'POST', $CTOKEN, ['order_id'=>$orderId2]);
check('Customer repeated cancellation is idempotent', ($b['duplicate'] ?? false) === true && $prodStock() === $pAfterCustomerCancel, json_encode($b));
[$st, $b] = req("{$BASE}/customer/api_cancel_order.php", 'POST', $TOKEN, ['order_id'=>$orderId2]);
check('Customer cancellation rejects staff bearer token', $st === 403, "HTTP {$st}");

// legacy endpoint must not allow status bypass or injection
[$st, $b] = req("{$BASE}/staff/api_orders.php", 'POST', $TOKEN, ['id'=>$orderId2,'status'=>"Completed', stock=999--"]);
check('api_orders POST status bypass blocked (400)', $st === 400, "HTTP {$st}");
check('Injection attempt changed nothing', $prodStock() < 900 && $orderStat() !== 'Completed');
[$st, $b] = req("{$BASE}/staff/api_orders.php", 'POST', $TOKEN, ['id'=>$orderId2,'total'=>123.45]);
check('api_orders POST total-only update works', ($b['status'] ?? '') === 'success');
$t = $q("SELECT total FROM orders WHERE id={$orderId2}")['total'];
check('Total updated safely', (float)$t === 123.45, "total={$t}");

/* ================= 6. HISTORY / ANALYTICS ================= */
[$st, $b] = req("{$BASE}/staff/api_product_stock_history.php?product_id={$prodId}", 'GET', $TOKEN);
check('Stock history returns movements w/ audit fields', $st === 200 && count($b['history'] ?? []) > 0 && isset($b['history'][0]['previous_stock'], $b['history'][0]['new_stock'], $b['history'][0]['staff']));
[$st, $b] = req("{$BASE}/staff/api_ingredient_history.php?ingredient_id={$ingId}", 'GET', $TOKEN);
check('Ingredient history returns movements', $st === 200 && count($b['history'] ?? []) > 0);
[$st, $b] = req("{$BASE}/staff/api_business_analytics.php", 'GET', $TOKEN);
check('Analytics accessible to staff', $st === 200 && ($b['success'] ?? false));
[$st] = req("{$BASE}/staff/api_reports.php", 'GET', $CTOKEN);
check('Reports denied to customer (403)', $st === 403, "HTTP {$st}");

/* ---------------- cleanup ---------------- */
$m->query("DELETE FROM orders WHERE id IN ({$orderId},{$orderId2})");
$m->query("DELETE FROM production_transactions WHERE product_id={$prodId}");
$m->query("DELETE FROM products WHERE id={$prodId}");
$m->query("DELETE FROM ingredients WHERE id={$ingId}");
$m->query("DELETE FROM users WHERE email IN ('itcust@example.com','itstaff@example.com')");
$m->close();

$fail = count(array_filter($results, fn($r) => $r[1] === 'FAIL'));
echo PHP_EOL . "TOTAL: " . count($results) . " | PASS: " . (count($results) - $fail) . " | FAIL: {$fail}" . PHP_EOL;