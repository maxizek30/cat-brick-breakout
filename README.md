# Cat Brick Breakout

A Breakout-style game with reactive multimedia and persistent leaderboards.
Built for CS 367.

## Requirements

- PHP 8.0+ with the `sqlite3` extension
- A modern browser

## Run locally

```bash
php data/setup.php
php -S localhost:8000 -t public/
```

Open <http://localhost:8000> to play.

## Controls

- **← →** move paddle
- **SPACE** launch ball
- **R** restart level

## Reset the database

Re-run `php data/setup.php` to drop all tables and reseed the levels.
