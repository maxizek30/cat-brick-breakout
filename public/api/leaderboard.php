<?php
require __DIR__ . '/../../src/db.php';
header('Content-Type: application/json');

$levelId = isset($_GET['level_id']) ? (int)$_GET['level_id'] : 0;

if ($levelId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'level_id query parameter required']);
    exit;
}

try {
    $db = getDb();
    $stmt = $db->prepare('
        SELECT player_name, time_ms, created_at
        FROM scores
        WHERE level_id = :level_id
        ORDER BY time_ms ASC
        LIMIT 10
    ');
    $stmt->bindValue(':level_id', $levelId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $scores = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $scores[] = $row;
    }

    echo json_encode($scores);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}