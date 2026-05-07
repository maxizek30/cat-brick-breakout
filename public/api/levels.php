<?php
require __DIR__ . '/../../src/db.php';
header('Content-Type: application/json');

try {
    $db = getDb();
    $result = $db->query('SELECT id, name, layout, difficulty FROM levels ORDER BY difficulty ASC');

    $levels = [];
    while ($record = $result->fetchArray(SQLITE3_ASSOC)) {
        $record['layout'] = json_decode($record['layout']);
        $levels[] = $record;
    }

    echo json_encode($levels);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}