<?php
function getDb() {
    $dbPath = getenv('DB_PATH') ?: __DIR__ . '/../data/leaderboard.db';
    $db = new SQLite3($dbPath);
    if (!$db) {
        die("Database connection failed");
    }
    $db->enableExceptions(true);
    return $db;
}