const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let balls = [];

function makeBall(x, y, dx, dy) {
  return { x, y, radius: 6, dx, dy };
}

const paddle = {
  x: 315,
  y: 510,
  width: 70,
  height: 10,
  speed: 4,
};
const BRICK = {
  size: 12,
  padding: 2,
  offsetTop: 50,
  offsetLeft: 40,
};
let bricks = [];
let liveBrickCount = 0;

const POWERUP = {
  size: 14,
  fallSpeed: 2,
  spawnChance: 0.15,
};

const POWERUP_TYPES = ["multiply", "add_three"];

let powerups = [];

function makePowerup(x, y, type) {
  return { x, y, type, alive: true };
}

const HAPPY_DURATION_MS = 700;
let lastBrickHitAt = -Infinity;

const happyVideo = document.getElementById("cat-happy");
const sadVideo = document.getElementById("cat-sad");
let currentMood = null;

function updateMood() {
  const elapsed = performance.now() - lastBrickHitAt;
  const desiredMood = elapsed < HAPPY_DURATION_MS ? "happy" : "sad";
  if (desiredMood === currentMood) return;

  if (desiredMood === "happy") {
    sadVideo.style.display = "none";
    sadVideo.pause();
    happyVideo.style.display = "block";
    happyVideo.currentTime = 0;
    happyVideo.play().catch(() => {});
  } else {
    happyVideo.style.display = "none";
    happyVideo.pause();
    sadVideo.style.display = "block";
    sadVideo.currentTime = 0;
    sadVideo.play().catch(() => {});
  }

  currentMood = desiredMood;
}

let gameState = "ready"; // "ready" | "playing" | "gameover" | "won"
let lives = 3;

let levelStartTime = null;

function buildBricksFromLayout(layout) {
  bricks = [];
  liveBrickCount = 0;
  powerups = [];
  for (let r = 0; r < layout.length; r++) {
    bricks[r] = [];
    for (let c = 0; c < layout[r].length; c++) {
      const x = c * (BRICK.size + BRICK.padding) + BRICK.offsetLeft;
      const y = r * (BRICK.size + BRICK.padding) + BRICK.offsetTop;
      const type = layout[r][c];
      const hasPowerup = type === 1 && Math.random() < POWERUP.spawnChance;
      bricks[r][c] = {
        x,
        y,
        type,
        alive: type !== 0,
        hasPowerup,
      };
      if (type === 1) liveBrickCount++;
    }
  }
}

let currentLevelId = 7;

async function loadLevel(levelId) {
  const response = await fetch("/api/levels.php");
  if (!response.ok) {
    throw new Error(`Failed to load levels: HTTP ${response.status}`);
  }
  const levels = await response.json();
  const level = levels.find((l) => l.id === levelId) || levels[0];
  if (!level) {
    throw new Error("No levels found in database");
  }
  return level;
}

async function fetchLeaderboard(levelId) {
  try {
    const response = await fetch(`/api/leaderboard.php?level_id=${levelId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    return [];
  }
}

let currentLeaderboard = [];

const keys = { left: false, right: false };

document.addEventListener("keydown", (e) => {
  if (happyVideo.muted) {
    happyVideo.muted = false;
    sadVideo.muted = false;
  }
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " && gameState === "ready") {
    for (const b of balls) {
      b.dx = 0;
      b.dy = -3;
    }
    if (levelStartTime === null) {
      levelStartTime = performance.now();
    }
    gameState = "playing";
  }
  if (
    (e.key === "r" || e.key === "R") &&
    (gameState === "gameover" || gameState === "won")
  ) {
    restart();
  }
});
async function restart() {
  try {
    const level = await loadLevel(currentLevelId);
    buildBricksFromLayout(level.layout);
    lives = 3;
    levelStartTime = null;
    currentLeaderboard = [];
    resetBalls();
    gameState = "ready";
  } catch (err) {
    console.error("Failed to restart:", err);
  }
}
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

function resetBalls() {
  balls = [makeBall(paddle.x + paddle.width / 2, paddle.y - 7, 0, 0)];
}
function spawnPowerup(x, y) {
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push(makePowerup(x - POWERUP.size / 2, y - POWERUP.size / 2, type));
}

function applyMultiply() {
  const clones = balls.map((b) => {
    const speed = Math.hypot(b.dx, b.dy);
    const angle = Math.atan2(b.dy, b.dx) + (Math.random() - 0.5) * 0.4;
    return makeBall(b.x, b.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
  });
  balls.push(...clones);
}

function applyAddThree() {
  const cx = paddle.x + paddle.width / 2;
  const cy = paddle.y - 10;
  const speed = 5;
  for (let i = 0; i < 3; i++) {
    // Spread three balls across a 60° fan above the paddle
    const angle = -Math.PI / 2 + ((i - 1) * Math.PI) / 6;
    balls.push(
      makeBall(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed),
    );
  }
}

function applyPowerup(type) {
  if (type === "multiply") applyMultiply();
  else if (type === "add_three") applyAddThree();
}

async function submitScore(levelId, timeMs) {
  const playerName = prompt(
    `You won in ${(timeMs / 1000).toFixed(2)}s! Enter your name (1-20 chars):`,
    "Player",
  );
  if (!playerName || playerName.trim() === "") return;

  try {
    const response = await fetch("/api/submit_score.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_name: playerName.trim().slice(0, 20),
        level_id: levelId,
        time_ms: timeMs,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Score submission failed:", data.error);
      return;
    }
    console.log("Score submitted, id:", data.id);
  } catch (err) {
    console.error("Network error submitting score:", err);
  }
}

function update() {
  if (gameState === "gameover" || gameState === "won") return;
  updateMood();

  if (keys.left) paddle.x -= paddle.speed;
  if (keys.right) paddle.x += paddle.speed;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));

  if (gameState === "ready") {
    for (const b of balls) {
      b.x = paddle.x + paddle.width / 2;
    }
    return; // no physics until launched
  }

  for (const b of balls) {
    b.x += b.dx;
    b.y += b.dy;

    // walls
    if (b.x - b.radius < 0 || b.x + b.radius > canvas.width) {
      b.dx = -b.dx;
    }
    if (b.y - b.radius < 0) {
      b.dy = -b.dy;
    }

    // paddle
    if (
      b.x + b.radius > paddle.x &&
      b.x - b.radius < paddle.x + paddle.width &&
      b.y + b.radius > paddle.y &&
      b.y - b.radius < paddle.y + paddle.height &&
      b.dy > 0
    ) {
      const hitPos = (b.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      const maxAngle = Math.PI / 3;
      const angle = hitPos * maxAngle;
      const speed = Math.hypot(b.dx, b.dy);
      b.dx = speed * Math.sin(angle);
      b.dy = -speed * Math.cos(angle);
    }

    // bricks
    let collided = false;

    for (let r = 0; r < bricks.length && !collided; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        const brick = bricks[r][c];
        if (!brick.alive) continue;

        if (
          b.x + b.radius > brick.x &&
          b.x - b.radius < brick.x + BRICK.size &&
          b.y + b.radius > brick.y &&
          b.y - b.radius < brick.y + BRICK.size
        ) {
          const brickCenterX = brick.x + BRICK.size / 2;
          const brickCenterY = brick.y + BRICK.size / 2;
          const dx = b.x - brickCenterX;
          const dy = b.y - brickCenterY;
          const overlapX = BRICK.size / 2 + b.radius - Math.abs(dx);
          const overlapY = BRICK.size / 2 + b.radius - Math.abs(dy);

          if (overlapX < overlapY) {
            b.dx = -b.dx;
          } else {
            b.dy = -b.dy;
          }

          if (brick.type === 1) {
            brick.alive = false;
            liveBrickCount--;
            lastBrickHitAt = performance.now();
            if (brick.hasPowerup) {
              spawnPowerup(brick.x + BRICK.size / 2, brick.y + BRICK.size / 2);
            }
          }
          collided = true;
          break;
        }
      }
    }
  }
  // Remove balls that fell below the paddle
  balls = balls.filter((b) => b.y - b.radius <= canvas.height);

  // Update powerups: fall and check for paddle catch
  for (const p of powerups) {
    p.y += POWERUP.fallSpeed;

    // Check paddle catch (AABB overlap)
    if (
      p.x + POWERUP.size > paddle.x &&
      p.x < paddle.x + paddle.width &&
      p.y + POWERUP.size > paddle.y &&
      p.y < paddle.y + paddle.height
    ) {
      p.alive = false;
      applyPowerup(p.type);
    }
  }

  // Remove caught or off screen powerups
  powerups = powerups.filter((p) => p.alive && p.y < canvas.height);

  // If all balls are gone, lose a life
  if (balls.length === 0) {
    lives -= 1;
    if (lives <= 0) {
      gameState = "gameover";
    } else {
      resetBalls();
      gameState = "ready";
    }
  }

  // Win check
  if (liveBrickCount === 0 && gameState !== "won") {
    gameState = "won";
    const elapsed = Math.round(performance.now() - levelStartTime);
    submitScore(currentLevelId, elapsed).then(() => {
      fetchLeaderboard(currentLevelId).then((scores) => {
        currentLeaderboard = scores;
      });
    });
  }
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // bricks
  ctx.fillStyle = "#ff2e63";
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;
      if (b.type === 2) {
        ctx.fillStyle = "#666";
      } else {
        ctx.fillStyle = "#ff2e63";
      }
      ctx.fillRect(b.x, b.y, BRICK.size, BRICK.size);
    }
  }

  // paddle
  ctx.fillStyle = "#08d9d6";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

  for (const p of powerups) {
    if (!p.alive) continue;
    ctx.fillStyle = p.type === "multiply" ? "#ffd166" : "#06d6a0";
    ctx.fillRect(p.x, p.y, POWERUP.size, POWERUP.size);
    ctx.fillStyle = "#000";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = p.type === "multiply" ? "×" : "+3";
    ctx.fillText(label, p.x + POWERUP.size / 2, p.y + POWERUP.size / 2 + 1);
  }

  // balls
  ctx.fillStyle = "#eaeaea";
  for (const b of balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  ctx.fillStyle = "#eaeaea";
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Lives: ${lives}`, 10, 24);

  // state overlays
  ctx.textAlign = "center";
  if (gameState === "ready") {
    ctx.font = "20px monospace";
    ctx.fillText("Press SPACE to launch", canvas.width / 2, canvas.height / 2);
  } else if (gameState === "gameover") {
    ctx.font = "32px monospace";
    ctx.fillStyle = "#ff2e63";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px monospace";
    ctx.fillStyle = "#eaeaea";
    ctx.fillText(
      "Press R to restart",
      canvas.width / 2,
      canvas.height / 2 + 30,
    );
  } else if (gameState === "won") {
    ctx.font = "32px monospace";
    ctx.fillStyle = "#08d9d6";
    ctx.fillText("YOU WIN!", canvas.width / 2, 100);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#eaeaea";
    ctx.fillText("Press R to play again", canvas.width / 2, 130);

    // Leaderboard
    ctx.font = "16px monospace";
    ctx.fillStyle = "#08d9d6";
    ctx.fillText("Top 10 Fastest Clears", canvas.width / 2, 180);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#eaeaea";
    if (currentLeaderboard.length === 0) {
      ctx.fillText("Loading...", canvas.width / 2, 210);
    } else {
      currentLeaderboard.forEach((entry, i) => {
        const rank = `${i + 1}.`.padEnd(4);
        const name = entry.player_name.padEnd(20);
        const time = `${(entry.time_ms / 1000).toFixed(2)}s`;
        const line = `${rank}${name}${time}`;
        ctx.fillText(line, canvas.width / 2, 210 + i * 20);
      });
    }
  }
}
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
async function startGame() {
  try {
    const level = await loadLevel(currentLevelId);
    buildBricksFromLayout(level.layout);
    resetBalls();
    levelStartTime = null;
    gameState = "ready";
    loop();
  } catch (err) {
    console.error("Failed to start game:", err);
    ctx.fillStyle = "#ff2e63";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Failed to load level. Is the server running?",
      canvas.width / 2,
      canvas.height / 2,
    );
  }
}

startGame();
