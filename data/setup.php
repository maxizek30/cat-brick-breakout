<?php
$dbPath = getenv('DB_PATH') ?: __DIR__ . '/leaderboard.db';

// Ensure the directory exists and is writable
$dbDir = dirname($dbPath);
if (!is_dir($dbDir) && !mkdir($dbDir, 0755, true)) {
    die("ERROR: Could not create directory $dbDir\n");
}
if (!is_writable($dbDir)) {
    die("ERROR: Directory $dbDir is not writable\n");
}

$db = new SQLite3($dbPath);
if (!$db) die("ERROR: Could not open database at $dbPath\n");
$db->enableExceptions(true);

// Drop existing tables so re-running setup gives a clean slate
$db->exec('DROP TABLE IF EXISTS scores');
$db->exec('DROP TABLE IF EXISTS levels');

// Create the levels table
$db->exec('
    CREATE TABLE levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        difficulty INTEGER DEFAULT 1
    )
');

// Create the scores table
$db->exec('
    CREATE TABLE scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_name TEXT NOT NULL,
        level_id INTEGER NOT NULL,
        time_ms INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (level_id) REFERENCES levels(id)
    )
');

// Define the seed data
$levels = [
    [
        'name' => 'Warmup',
        'difficulty' => 1,
        'layout' => [
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
        ],
    ],
    [
        'name' => 'Standard',
        'difficulty' => 2,
        'layout' => [
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1,1],
        ],
    ],
    [
        'name' => 'Pyramid',
        'difficulty' => 3,
        'layout' => [
            [0,0,0,0,1,0,0,0,0],
            [0,0,0,1,1,1,0,0,0],
            [0,0,1,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,1,0],
            [1,1,1,1,1,1,1,1,1],
        ],
    ],
];

// Insert each level using a prepared statement
$stmt = $db->prepare('INSERT INTO levels (name, layout, difficulty) VALUES (:name, :layout, :difficulty)');

foreach ($levels as $level) {
    $stmt->bindValue(':name',       $level['name'],                SQLITE3_TEXT);
    $stmt->bindValue(':layout',     json_encode($level['layout']), SQLITE3_TEXT);
    $stmt->bindValue(':difficulty', $level['difficulty'],          SQLITE3_INTEGER);
    $stmt->execute();
    $stmt->reset();  
}

echo "Database initialized at $dbPath with " . count($levels) . " levels.\n";