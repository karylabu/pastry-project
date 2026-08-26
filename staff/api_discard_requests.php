<?php
require_once __DIR__ . '/../includes/api_auth.php';
require_once __DIR__ . '/../includes/inventory.php';
$user = requireInventoryRead();
$conn = @new mysqli('localhost', 'root', '', 'pastry_db');
if ($conn->connect_error) { http_response_code(500); echo json_encode(['success'=>false,'message'=>'Database connection failed']); exit; }
function discardJson(bool $ok, string $message = '', array $extra = [], int $status = 200): never { http_response_code($status); echo json_encode(array_merge(['success'=>$ok,'message'=>$message], $extra)); exit; }
function discardBody(): array { $data=json_decode(file_get_contents('php://input'), true); return is_array($data) ? $data : []; }

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $status=trim((string)($_GET['status'] ?? 'Pending'));
    if (!in_array($status,['Pending','Approved','Rejected'],true)) discardJson(false,'Invalid status',[],400);
    $stmt=$conn->prepare("SELECT d.*,i.name AS ingredient_name,i.unit,b.batch_number,b.expiry_date,b.quantity_remaining,ru.name AS requested_by_name,au.name AS approved_by_name,ju.name AS rejected_by_name FROM discard_requests d JOIN ingredients i ON i.id=d.ingredient_id JOIN ingredient_batches b ON b.id=d.ingredient_batch_id LEFT JOIN users ru ON ru.id=d.requested_by LEFT JOIN users au ON au.id=d.approved_by LEFT JOIN users ju ON ju.id=d.rejected_by WHERE d.status=? ORDER BY d.requested_at DESC");
    $stmt->bind_param('s',$status); $stmt->execute(); $rows=[]; $result=$stmt->get_result();
    while($row=$result->fetch_assoc()){ $row['id']=(int)$row['id']; $row['quantity']=(float)$row['quantity']; $row['quantity_remaining']=(float)$row['quantity_remaining']; $rows[]=$row; }
    $stmt->close(); $conn->close(); discardJson(true,'',['requests'=>$rows]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') discardJson(false,'Method not allowed',[],405);
$data=discardBody(); $action=(string)($data['action']??''); $userId=(int)$user['id'];

if ($action === 'request') {
    $batchId=max(0,(int)($data['ingredient_batch_id']??0)); $quantity=(float)($data['quantity']??0); $reason=trim((string)($data['reason']??'')); $notes=trim((string)($data['notes']??''));
    if(!$batchId||$quantity<=0||!in_array($reason,['Expired','Spoiled','Damaged','Contaminated','Overproduction','Other'],true)) discardJson(false,'Batch, positive quantity, and valid reason are required',[],400);
    $conn->begin_transaction(); $stmt=$conn->prepare('SELECT ingredient_id,quantity_remaining FROM ingredient_batches WHERE id=? FOR UPDATE'); $stmt->bind_param('i',$batchId); $stmt->execute(); $batch=$stmt->get_result()->fetch_assoc(); $stmt->close();
    if(!$batch){$conn->rollback();discardJson(false,'Batch not found',[],404);} if($quantity>(float)$batch['quantity_remaining']){$conn->rollback();discardJson(false,'Discard quantity cannot exceed available batch quantity',[],409);}
    $stmt=$conn->prepare("SELECT id FROM discard_requests WHERE ingredient_batch_id=? AND status='Pending' LIMIT 1"); $stmt->bind_param('i',$batchId); $stmt->execute(); $duplicate=$stmt->get_result()->num_rows>0; $stmt->close(); if($duplicate){$conn->rollback();discardJson(false,'A discard request is already pending for this batch',[],409);}
    $ingredientId=(int)$batch['ingredient_id']; $stmt=$conn->prepare('INSERT INTO discard_requests (ingredient_id,ingredient_batch_id,quantity,reason,notes,requested_by) VALUES (?,?,?,?,?,?)'); $stmt->bind_param('iidssi',$ingredientId,$batchId,$quantity,$reason,$notes,$userId); if(!$stmt->execute()){$stmt->close();$conn->rollback();discardJson(false,'Unable to create discard request. Please try again.',[],500);} $requestId=$stmt->insert_id; $stmt->close(); $conn->commit(); $conn->close(); discardJson(true,'Discard request submitted',['request_id'=>$requestId]);
}
if(!in_array($action,['approve','reject'],true)) discardJson(false,'Unsupported discard action',[],400);
requireInventoryManager(); $requestId=max(0,(int)($data['request_id']??0)); if(!$requestId) discardJson(false,'request_id is required',[],400);
$conn->begin_transaction(); $stmt=$conn->prepare('SELECT * FROM discard_requests WHERE id=? FOR UPDATE'); $stmt->bind_param('i',$requestId); $stmt->execute(); $request=$stmt->get_result()->fetch_assoc(); $stmt->close(); if(!$request){$conn->rollback();discardJson(false,'Discard request not found',[],404);} if($request['status']!=='Pending'){$conn->rollback();discardJson(false,'Discard request has already been processed',[],409);}
if($action==='reject'){ $note=trim((string)($data['rejection_note']??'')); $stmt=$conn->prepare("UPDATE discard_requests SET status='Rejected',rejected_by=?,rejected_at=NOW(),rejection_note=? WHERE id=? AND status='Pending'"); $stmt->bind_param('isi',$userId,$note,$requestId); $stmt->execute(); $stmt->close(); $conn->commit(); $conn->close(); discardJson(true,'Discard request rejected'); }

$stmt=$conn->prepare('SELECT b.*,i.name,i.unit,i.stock,i.unit_cost AS ingredient_unit_cost FROM ingredient_batches b JOIN ingredients i ON i.id=b.ingredient_id WHERE b.id=? FOR UPDATE'); $stmt->bind_param('i',$request['ingredient_batch_id']); $stmt->execute(); $batch=$stmt->get_result()->fetch_assoc(); $stmt->close(); $quantity=(float)$request['quantity'];
if(!$batch||$quantity>(float)$batch['quantity_remaining']||$quantity>(float)$batch['stock']){$conn->rollback();discardJson(false,'Insufficient available stock for this discard',[],409);}
$newBatchStock=(float)$batch['quantity_remaining']-$quantity; $newIngredientStock=(float)$batch['stock']-$quantity; $stmt=$conn->prepare('UPDATE ingredient_batches SET quantity_remaining=? WHERE id=?'); $stmt->bind_param('di',$newBatchStock,$request['ingredient_batch_id']); $stmt->execute(); $stmt->close(); $stmt=$conn->prepare('UPDATE ingredients SET stock=?,updated_at=NOW() WHERE id=?'); $stmt->bind_param('di',$newIngredientStock,$request['ingredient_id']); $stmt->execute(); $stmt->close();
$note="Waste / {$request['reason']} batch {$batch['batch_number']}"; if(!insertIngredientMovement($conn,(int)$request['ingredient_id'],'stock_out',$quantity,$note,$userId,'discard_request',$requestId)){$conn->rollback();discardJson(false,'Unable to record discard movement. Please try again.',[],500);}
$item=$batch['name']; $unitCost=(float)($batch['ingredient_unit_cost']??0); $referenceType='discard_request'; $referenceId=$requestId; $batchId=(int)$request['ingredient_batch_id']; $requestedBy=(int)$request['requested_by']; $unit=$batch['unit'];
$stmt=$conn->prepare("INSERT INTO waste_log (datetime,item,qty,unit_cost,item_type,reason,ingredient_id,user_id,reference_type,reference_id,ingredient_batch_id,requested_by,approved_by,approved_at,discarded_at,unit,discard_request_id) VALUES (NOW(),?,?,?,'Raw Material',?,?,?,?,?,?,?,?,NOW(),NOW(),?,?)");
$stmt->bind_param('sddsiisiiiisi',$item,$quantity,$unitCost,$request['reason'],$request['ingredient_id'],$userId,$referenceType,$referenceId,$batchId,$requestedBy,$userId,$unit,$requestId);
if(!$stmt->execute()){$stmt->close();$conn->rollback();discardJson(false,'Unable to record approved waste. Please try again.',[],500);} $stmt->close();
$stmt=$conn->prepare("UPDATE discard_requests SET status='Approved',approved_by=?,approved_at=NOW(),discarded_at=NOW() WHERE id=? AND status='Pending'"); $stmt->bind_param('ii',$userId,$requestId); $stmt->execute(); $stmt->close(); $conn->commit(); $conn->close(); discardJson(true,'Discard approved and recorded as waste');
