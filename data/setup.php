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


function buildPyramid($height, $width) {
    $layout = [];
    for ($r = 0; $r < $height; $r++) {
        $row = array_fill(0, $width, 0);
        $halfWidth = $r + 1;
        $start = (int)(($width - (2 * $halfWidth - 1)) / 2);
        for ($c = $start; $c < $start + (2 * $halfWidth - 1); $c++) {
            $row[$c] = 1;
        }
        $layout[] = $row;
    }
    return $layout;
}
function buildBunker() {
    $layout = [];
    for ($r = 0; $r < 6; $r++) {
        $layout[] = array_fill(0, 40, 1);
    }
    for ($r = 0; $r < 2; $r++) {
        $row = array_fill(0, 40, 2);
        $row[8] = 0;
        $row[19] = 0;
        $row[30] = 0;
        $layout[] = $row;
    }
    for ($r = 0; $r < 4; $r++) {
        $layout[] = array_fill(0, 40, 1);
    }
    return $layout;
}

$levels = [
    [
        'name' => 'Warmup',
        'difficulty' => 1,
        'layout' => array_fill(0, 8, array_fill(0, 30, 1)),
    ],
    [
        'name' => 'Standard',
        'difficulty' => 2,
        'layout' => array_fill(0, 20, array_fill(0, 40, 1)),
    ],
    [
        'name' => 'Pyramid',
        'difficulty' => 3,
        'layout' => buildPyramid(20, 40),
    ],
       [
        'name' => 'The Wall',
        'difficulty' => 4,
        'layout' => array_fill(0, 40, array_fill(0, 44, 1)),
    ],
    [
    'name' => 'Bunker',
    'difficulty' => 5,
    'layout' => buildBunker(),
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