const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ball = {
  x: 350,
  y: 400,
  radius: 6,
  dx: 4,
  dy: 4,
};
const paddle = {
  x: 315,
  y: 660,
  width: 70,
  height: 10,
  speed: 6,
};
const BRICK = {
  size: 12,
  padding: 2,
  offsetTop: 50,
  offsetLeft: 40,
};
let bricks = [];
let liveBrickCount = 0;

let gameState = "ready"; // "ready" | "playing" | "gameover" | "won"
let lives = 3;

function buildBricksFromLayout(layout) {
  bricks = [];
  liveBrickCount = 0;
  for (let r = 0; r < layout.length; r++) {
    bricks[r] = [];
    for (let c = 0; c < layout[r].length; c++) {
      const x = c * (BRICK.size + BRICK.padding) + BRICK.offsetLeft;
      const y = r * (BRICK.size + BRICK.padding) + BRICK.offsetTop;
      const type = layout[r][c];
      bricks[r][c] = {
        x,
        y,
        type,
        alive: type !== 0,
      };
      if (type === 1) liveBrickCount++;
    }
  }
}

let currentLevelId = 5;

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

const keys = { left: false, right: false };

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " && gameState === "ready") {
    ball.dx = 4;
    ball.dy = -4;
    gameState = "playing";
  }
  if (
    (e.key === "r" || e.key === "R") &&
    (gameState === "gameover" || gameState === "won")
  ) {
    // restart
    lives = 3;
    restart();
    resetBall();
    gameState = "ready";
  }
});
async function restart() {
  try {
    const level = await loadLevel(currentLevelId);
    buildBricksFromLayout(level.layout);
    lives = 3;
    resetBall();
    gameState = "ready";
  } catch (err) {
    console.error("Failed to restart:", err);
  }
}
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

function resetBall() {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 1;
  ball.dx = 0;
  ball.dy = 0;
}

function update() {
  if (gameState === "gameover" || gameState === "won") return;

  if (keys.left) paddle.x -= paddle.speed;
  if (keys.right) paddle.x += paddle.speed;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));

  if (gameState === "ready") {
    ball.x = paddle.x + paddle.width / 2;
    return; // no physics until launched
  }

  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
    ball.dx = -ball.dx;
  }
  if (ball.y - ball.radius < 0) {
    ball.dy = -ball.dy;
  }
  if (ball.y - ball.radius > canvas.height) {
    lives -= 1;
    if (lives <= 0) {
      gameState = "gameover";
    } else {
      resetBall();
      gameState = "ready";
    }
  }

  if (
    ball.x + ball.radius > paddle.x &&
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.y + ball.radius > paddle.y &&
    ball.y - ball.radius < paddle.y + paddle.height &&
    ball.dy > 0
  ) {
    const hitPos =
      (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    // hitPos is now -1 (far left) to +1 (far right), 0 = center

    const maxAngle = Math.PI / 3; // 60 degrees from straight up
    const angle = hitPos * maxAngle;

    const speed = Math.hypot(ball.dx, ball.dy);
    ball.dx = speed * Math.sin(angle);
    ball.dy = -speed * Math.cos(angle);
  }
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;

      if (
        ball.x + ball.radius > b.x &&
        ball.x - ball.radius < b.x + BRICK.size &&
        ball.y + ball.radius > b.y &&
        ball.y - ball.radius < b.y + BRICK.size
      ) {
        // Find the brick's center
        const brickCenterX = b.x + BRICK.size / 2;
        const brickCenterY = b.y + BRICK.size / 2;

        // Distance from ball center to brick center
        const dx = ball.x - brickCenterX;
        const dy = ball.y - brickCenterY;

        // Overlap on each axis
        const overlapX = BRICK.size / 2 + ball.radius - Math.abs(dx);
        const overlapY = BRICK.size / 2 + ball.radius - Math.abs(dy);

        // The smaller overlap is the axis we just crossed → reflect on that one
        if (overlapX < overlapY) {
          ball.dx = -ball.dx;
        } else {
          ball.dy = -ball.dy;
        }

        if (b.type === 1) {
          b.alive = false;
          liveBrickCount--;
        }
        break;
      }
    }
  }
  if (liveBrickCount === 0) {
    gameState = "won";
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

  // ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#eaeaea";
  ctx.fill();

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
    ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px monospace";
    ctx.fillStyle = "#eaeaea";
    ctx.fillText(
      "Press R to play again",
      canvas.width / 2,
      canvas.height / 2 + 30,
    );
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
    resetBall();
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
