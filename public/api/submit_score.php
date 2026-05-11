<?php
require __DIR__ . '/../../src/db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$playerName = isset($body['player_name']) ? trim($body['player_name']) : '';
$levelId    = isset($body['level_id'])    ? (int)$body['level_id']     : 0;
$timeMs     = isset($body['time_ms'])     ? (int)$body['time_ms']      : 0;

if ($playerName === '' || strlen($playerName) > 20) {
    http_response_code(400);
    echo json_encode(['error' => 'player_name must be 1-20 characters']);
    exit;
}
if ($levelId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'level_id must be a positive integer']);
    exit;
}
if ($timeMs <= 0 || $timeMs > 3600000) {
    http_response_code(400);
    echo json_encode(['error' => 'time_ms must be between 1 and 3600000']);
    exit;
}

try {
    $db = getDb();

    // Verify the level exists before referencing it
    $check = $db->prepare('SELECT id FROM levels WHERE id = :id');
    $check->bindValue(':id', $levelId, SQLITE3_INTEGER);
    $checkResult = $check->execute();
    if (!$checkResult->fetchArray(SQLITE3_ASSOC)) {
        http_response_code(400);
        echo json_encode(['error' => 'level_id does not exist']);
        exit;
    }

    $stmt = $db->prepare('
        INSERT INTO scores (player_name, level_id, time_ms)
        VALUES (:name, :level_id, :time_ms)
    ');
    $stmt->bindValue(':name',     $playerName, SQLITE3_TEXT);
    $stmt->bindValue(':level_id', $levelId,    SQLITE3_INTEGER);
    $stmt->bindValue(':time_ms',  $timeMs,     SQLITE3_INTEGER);
    $stmt->execute();

    echo json_encode([
        'success' => true,
        'id' => $db->lastInsertRowID(),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}