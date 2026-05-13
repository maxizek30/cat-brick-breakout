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

$db->exec('
    CREATE TABLE levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        difficulty INTEGER DEFAULT 1
    )
');

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

// ─── Level builders ───────────────────────────────────────────────────

// One breakable brick in the middle of a 44-wide canvas. For showcasing.
function buildShowcase() {
    $width = 44;
    $emptyRowsAbove = 25;  // push the brick down
    $layout = [];

    // Empty space above
    for ($r = 0; $r < $emptyRowsAbove; $r++) {
        $layout[] = array_fill(0, $width, 0);
    }

    // The single brick row, centered
    $row = array_fill(0, $width, 0);
    $row[(int)($width / 2)] = 1;
    $layout[] = $row;

    return $layout;
}

// Centered pyramid filling the full canvas width.
function buildPyramid($height, $width) {
    $layout = [];
    for ($r = 0; $r < $height; $r++) {
        $row = array_fill(0, $width, 0);
        $halfWidth = $r + 1;
        $start = (int)(($width - (2 * $halfWidth - 1)) / 2);
        $end = $start + (2 * $halfWidth - 1);
        for ($c = $start; $c < $end; $c++) {
            $row[$c] = 1;
        }
        $layout[] = $row;
    }
    return $layout;
}

// Solid wall of breakables filling the canvas.
function buildWall($height, $width) {
    return array_fill(0, $height, array_fill(0, $width, 1));
}

// Vertical pillars of breakables separated by unbreakable gutters.
// 4 columns of breakables, channels of unbreakables between them.
function buildPillars() {
    $width = 44;
    $height = 22;
    $pillarCount = 4;
    $pillarWidth = 8;
    $gapWidth = (int)(($width - $pillarCount * $pillarWidth) / ($pillarCount + 1));

    $layout = [];
    for ($r = 0; $r < $height; $r++) {
        $row = array_fill(0, $width, 0);
        for ($p = 0; $p < $pillarCount; $p++) {
            $start = $gapWidth + $p * ($pillarWidth + $gapWidth);
            for ($c = 0; $c < $pillarWidth; $c++) {
                $row[$start + $c] = 1;
            }
        }
        $layout[] = $row;
    }
    return $layout;
}

// Three horizontal bands of breakables, flanked by unbreakable side walls
// that funnel the ball back into play.
function buildBands() {
    $width = 44;
    $bands = 3;
    $bandHeight = 5;
    $gap = 2;

    $layout = [];
    for ($b = 0; $b < $bands; $b++) {
        for ($r = 0; $r < $bandHeight; $r++) {
            $layout[] = array_fill(0, $width, 1);
        }
        if ($b < $bands - 1) {
            for ($g = 0; $g < $gap; $g++) {
                $layout[] = array_fill(0, $width, 0);
            }
        }
    }

    // Empty row of breathing space, then a single unbreakable floor
    $layout[] = array_fill(0, $width, 0);
    $layout[] = array_fill(0, $width, 2);
    return $layout;
}

// 2 × 3 grid of rectangular brick blocks separated by gutters.
function buildGrid() {
    $width = 44;
    $cols = 2;
    $rows = 3;
    $blockWidth = 20;
    $blockHeight = 6;
    $gapH = (int)(($width - $cols * $blockWidth) / ($cols + 1));
    $gapV = 2;

    $layout = [];
    for ($r = 0; $r < $rows; $r++) {
        for ($br = 0; $br < $blockHeight; $br++) {
            $row = array_fill(0, $width, 0);
            for ($c = 0; $c < $cols; $c++) {
                $start = $gapH + $c * ($blockWidth + $gapH);
                for ($bc = 0; $bc < $blockWidth; $bc++) {
                    $row[$start + $bc] = 1;
                }
            }
            $layout[] = $row;
        }
        if ($r < $rows - 1) {
            for ($g = 0; $g < $gapV; $g++) {
                $layout[] = array_fill(0, $width, 0);
            }
        }
    }

    // Empty row of breathing space, then a single unbreakable floor
    $layout[] = array_fill(0, $width, 0);
    $layout[] = array_fill(0, $width, 2);
    return $layout;
}

function buildMaze() {
    $width = 44;
    $height = 22;
    // Start with everything breakable
    $layout = [];
    for ($r = 0; $r < $height; $r++) {
        $layout[] = array_fill(0, $width, 1);
    }

    // Carve obstacle 1: upper-middle rectangle of unbreakables
    $r1Start = 4; $r1End = 9;
    $c1Start = 12; $c1End = 26;
    for ($r = $r1Start; $r <= $r1End; $r++) {
        for ($c = $c1Start; $c <= $c1End; $c++) {
            $layout[$r][$c] = 2;
        }
    }

    // Carve obstacle 2: lower-right rectangle of unbreakables
    $r2Start = 14; $r2End = 19;
    $c2Start = 26; $c2End = 40;
    for ($r = $r2Start; $r <= $r2End; $r++) {
        for ($c = $c2Start; $c <= $c2End; $c++) {
            $layout[$r][$c] = 2;
        }
    }

    return $layout;
}

// ─── Level definitions ────────────────────────────────────────────────

$levels = [
    [
        'name' => 'Showcase',
        'difficulty' => 0,
        'layout' => buildShowcase(),
    ],
    [
        'name' => 'Pyramid',
        'difficulty' => 1,
        'layout' => buildPyramid(20, 44),
    ],
    [
        'name' => 'The Wall',
        'difficulty' => 2,
        'layout' => buildWall(24, 44),
    ],
    [
        'name' => 'Pillars',
        'difficulty' => 3,
        'layout' => buildPillars(),
    ],
    [
        'name' => 'Bands',
        'difficulty' => 4,
        'layout' => buildBands(),
    ],
    [
        'name' => 'Grid',
        'difficulty' => 5,
        'layout' => buildGrid(),
    ],
];

$stmt = $db->prepare('INSERT INTO levels (name, layout, difficulty) VALUES (:name, :layout, :difficulty)');

foreach ($levels as $level) {
    $stmt->bindValue(':name',       $level['name'],                SQLITE3_TEXT);
    $stmt->bindValue(':layout',     json_encode($level['layout']), SQLITE3_TEXT);
    $stmt->bindValue(':difficulty', $level['difficulty'],          SQLITE3_INTEGER);
    $stmt->execute();
    $stmt->reset();
}

echo "Database initialized at $dbPath with " . count($levels) . " levels.\n";