// ============================================================
// SoftwareDash — Motor del juego
// ------------------------------------------------------------
// Arquitectura general (para el README / explicación técnica):
//
//  1. Estado global (state machine): START, PLAYING, FAIL,
//     LEVEL_COMPLETE, VICTORY, LEADERBOARD.
//  2. El jugador ("Byte") solo tiene UNA acción: saltar. El avance
//     horizontal es automático (scroll), igual que Geometry Dash.
//  3. Cada frame: física (gravedad + salto) -> colisiones contra
//     el arreglo de obstáculos del nivel actual (levels.js) ->
//     dibujo en <canvas>.
//  4. Al terminar un nivel o morir, se actualiza el HUD y se
//     guarda el resultado en Supabase (o localStorage si no está
//     configurado) mediante supabase-config.js.
// ============================================================

// ---------- Referencias al DOM ----------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

const screens = {
  start: document.getElementById("screen-start"),
  levelComplete: document.getElementById("screen-level-complete"),
  victory: document.getElementById("screen-victory"),
  fail: document.getElementById("screen-fail"),
  leaderboard: document.getElementById("screen-leaderboard")
};

const hudLevel = document.getElementById("hud-level");
const hudAttempts = document.getElementById("hud-attempts");
const hudTimer = document.getElementById("hud-timer");
const progressBar = document.getElementById("progress-bar");

// ---------- Constantes de física ----------
const GRAVITY = 0.55;
const JUMP_VELOCITY = -11.5;
const JUMP_CUT_MULTIPLIER = 0.45; // salto corto si sueltas el botón pronto
const PLAYER_SIZE = 30;
const PLAYER_SCREEN_X = 130; // posición fija del jugador en pantalla

// ---------- Estado del juego ----------
let STATE = "START";
let currentLevelIndex = 0;
let attemptsPerLevel = [0, 0, 0];
let playerName = "Anónimo";

let player, cameraX, levelStartTime, elapsed, deathLabel;

function resetLevel() {
  player = {
    worldX: 0,
    y: LEVELS[currentLevelIndex].groundY - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    holdingJump: false
  };
  cameraX = 0;
  levelStartTime = performance.now();
  elapsed = 0;
  deathLabel = null;
  hudLevel.textContent = LEVELS[currentLevelIndex].name;
  hudAttempts.textContent = `Intentos: ${attemptsPerLevel[currentLevelIndex]}`;
  progressBar.style.width = "0%";
}

// ============================================================
// SONIDO — Web Audio API (sin archivos externos)
// ============================================================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function beep(freq, duration, type = "square", volume = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}
const sfx = {
  jump: () => beep(520, 0.12, "square"),
  crash: () => { beep(120, 0.35, "sawtooth", 0.12); },
  levelComplete: () => {
    beep(660, 0.12); setTimeout(() => beep(880, 0.16), 110);
  },
  victory: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 120));
  }
};

// ============================================================
// INPUT — un solo botón: saltar
// ============================================================
function tryJump() {
  ensureAudio();
  if (STATE !== "PLAYING") return;
  if (player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.holdingJump = true;
    sfx.jump();
  }
}
function releaseJump() {
  if (player && player.holdingJump && player.vy < JUMP_VELOCITY * JUMP_CUT_MULTIPLIER) {
    player.vy = JUMP_VELOCITY * JUMP_CUT_MULTIPLIER;
  }
  if (player) player.holdingJump = false;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); tryJump(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") releaseJump();
});
canvas.addEventListener("mousedown", tryJump);
canvas.addEventListener("mouseup", releaseJump);
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); tryJump(); }, { passive: false });
canvas.addEventListener("touchend", (e) => { e.preventDefault(); releaseJump(); }, { passive: false });

// ============================================================
// FÍSICA + COLISIONES
// ============================================================
function getGapAt(worldX) {
  return LEVELS[currentLevelIndex].obstacles.find(
    (o) => o.type === "gap" && worldX >= o.x && worldX <= o.x + o.w
  );
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function updatePhysics(dt) {
  const level = LEVELS[currentLevelIndex];

  // Avance horizontal automático (como en Geometry Dash)
  player.worldX += level.speed;
  cameraX = player.worldX - PLAYER_SCREEN_X;

  // Gravedad
  player.vy += GRAVITY;
  player.y += player.vy;

  // ¿Hay piso debajo del jugador o es un hueco?
  const gap = getGapAt(player.worldX + PLAYER_SIZE / 2);
  const groundY = level.groundY;

  if (!gap) {
    if (player.y + PLAYER_SIZE >= groundY) {
      player.y = groundY - PLAYER_SIZE;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
  } else {
    player.onGround = false;
    if (player.y + PLAYER_SIZE >= CANVAS_H) {
      return die(gap.label || "Vacío en el código");
    }
  }

  // Colisión contra picos y bloques
  for (const obs of level.obstacles) {
    if (obs.type === "gap") continue;
    const obsScreenTop = groundY - obs.h;
    const hit = rectsOverlap(
      player.worldX, player.y, PLAYER_SIZE, PLAYER_SIZE,
      obs.x, obsScreenTop, obs.w, obs.h
    );
    if (hit) return die(obs.label || obs.type);
  }

  // ¿Terminó el nivel?
  if (player.worldX >= level.length) {
    return completeLevel();
  }

  // HUD
  elapsed = performance.now() - levelStartTime;
  hudTimer.textContent = (elapsed / 1000).toFixed(1) + "s";
  progressBar.style.width = Math.min(100, (player.worldX / level.length) * 100) + "%";
}

// ============================================================
// DIBUJO
// ============================================================
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const level = LEVELS[currentLevelIndex];

  // Fondo: líneas de "código" en paralaje
  ctx.strokeStyle = "rgba(88,166,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const lx = (i * 140 - (cameraX * 0.3) % 140);
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, CANVAS_H);
    ctx.stroke();
  }

  // Piso (con huecos)
  ctx.fillStyle = "#21262d";
  const step = 4;
  ctx.beginPath();
  for (let sx = 0; sx <= CANVAS_W; sx += step) {
    const worldX = sx + cameraX;
    const gap = getGapAt(worldX);
    if (!gap) {
      ctx.fillRect(sx, level.groundY, step + 1, CANVAS_H - level.groundY);
    }
  }

  // Obstáculos visibles
  for (const obs of level.obstacles) {
    const sx = obs.x - cameraX;
    if (sx < -80 || sx > CANVAS_W + 80) continue;

    if (obs.type === "spike") {
      const top = level.groundY - obs.h;
      ctx.fillStyle = "#f85149";
      ctx.beginPath();
      ctx.moveTo(sx, level.groundY);
      ctx.lineTo(sx + obs.w / 2, top);
      ctx.lineTo(sx + obs.w, level.groundY);
      ctx.closePath();
      ctx.fill();
      drawLabel(obs.label, sx + obs.w / 2, top - 6);
    } else if (obs.type === "block") {
      const top = level.groundY - obs.h;
      ctx.fillStyle = "#d29922";
      ctx.fillRect(sx, top, obs.w, obs.h);
      drawLabel(obs.label, sx + obs.w / 2, top - 6);
    } else if (obs.type === "gap") {
      // ya se ve como ausencia de piso; opcionalmente marcar el borde
      ctx.fillStyle = "rgba(248,81,73,0.15)";
      ctx.fillRect(sx, level.groundY, obs.w, CANVAS_H - level.groundY);
    }
  }

  // Jugador ("Byte")
  const px = PLAYER_SCREEN_X;
  const py = player.y;
  ctx.save();
  ctx.translate(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2);
  const tilt = Math.max(-0.4, Math.min(0.4, player.vy / 25));
  ctx.rotate(tilt);
  ctx.fillStyle = "#58a6ff";
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(-PLAYER_SIZE / 2 + 6, -PLAYER_SIZE / 2 + 6, 6, 6); // "ojo"
  ctx.fillStyle = "#3fb950";
  ctx.fillRect(-PLAYER_SIZE / 2 + 2, PLAYER_SIZE / 2 - 6, PLAYER_SIZE - 4, 3); // "luz" de estado
  ctx.restore();
}

function drawLabel(text, x, y) {
  if (!text) return;
  ctx.font = "11px monospace";
  ctx.fillStyle = "#e6edf3";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
let lastTime = 0;
function loop(t) {
  const dt = t - lastTime;
  lastTime = t;
  if (STATE === "PLAYING") {
    updatePhysics(dt);
    draw();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// TRANSICIONES DE ESTADO
// ============================================================
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  if (name) screens[name].classList.remove("hidden");
}

function die(label) {
  STATE = "FAIL";
  sfx.crash();
  attemptsPerLevel[currentLevelIndex]++;
  document.getElementById("fail-detail").textContent =
    `Te detuvo: "${label}" — intento #${attemptsPerLevel[currentLevelIndex]} en este nivel.`;
  showScreen("fail");
}

async function completeLevel() {
  STATE = "LEVEL_COMPLETE";
  sfx.levelComplete();
  const timeMs = performance.now() - levelStartTime;

  await saveScore({
    playerName,
    level: currentLevelIndex,
    timeMs,
    attempts: attemptsPerLevel[currentLevelIndex]
  });

  if (currentLevelIndex === LEVELS.length - 1) {
    document.getElementById("victory-stats").textContent =
      `Tiempo total del último nivel: ${(timeMs / 1000).toFixed(1)}s · Intentos en este nivel: ${attemptsPerLevel[currentLevelIndex]}`;
    sfx.victory();
    showScreen("victory");
    STATE = "VICTORY";
  } else {
    document.getElementById("level-complete-stats").textContent =
      `Tiempo: ${(timeMs / 1000).toFixed(1)}s · Intentos en este nivel: ${attemptsPerLevel[currentLevelIndex]}`;
    showScreen("levelComplete");
  }
}

// ============================================================
// UI — botones
// ============================================================
document.getElementById("btn-start").addEventListener("click", () => {
  ensureAudio();
  const nameInput = document.getElementById("player-name").value.trim();
  playerName = nameInput || "Anónimo";
  currentLevelIndex = 0;
  attemptsPerLevel = [0, 0, 0];
  resetLevel();
  STATE = "PLAYING";
  showScreen(null);
});

document.getElementById("btn-retry").addEventListener("click", () => {
  resetLevel();
  STATE = "PLAYING";
  showScreen(null);
});

document.getElementById("btn-menu").addEventListener("click", () => {
  STATE = "START";
  showScreen("start");
});

document.getElementById("btn-next-level").addEventListener("click", () => {
  currentLevelIndex++;
  resetLevel();
  STATE = "PLAYING";
  showScreen(null);
});

document.getElementById("btn-retry-level").addEventListener("click", () => {
  resetLevel();
  STATE = "PLAYING";
  showScreen(null);
});

document.getElementById("btn-restart-game").addEventListener("click", () => {
  currentLevelIndex = 0;
  attemptsPerLevel = [0, 0, 0];
  resetLevel();
  STATE = "PLAYING";
  showScreen(null);
});

// ---------- Ranking ----------
async function renderLeaderboard(levelIdx) {
  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "<li>Cargando…</li>";
  const scores = await getTopScores(levelIdx);
  if (!scores || scores.length === 0) {
    list.innerHTML = "<li>Todavía no hay resultados para este nivel.</li>";
    return;
  }
  list.innerHTML = "";
  scores.forEach((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>#${i + 1} ${s.player_name}</span><span>${(s.time_ms / 1000).toFixed(1)}s</span>`;
    list.appendChild(li);
  });
}

document.querySelectorAll(".lb-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderLeaderboard(Number(btn.dataset.level));
  });
});

function openLeaderboard() {
  showScreen("leaderboard");
  document.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
  document.querySelector('.lb-tab[data-level="0"]').classList.add("active");
  renderLeaderboard(0);
}

document.getElementById("btn-leaderboard").addEventListener("click", openLeaderboard);
document.getElementById("btn-view-ranking-final").addEventListener("click", openLeaderboard);
document.getElementById("btn-close-leaderboard").addEventListener("click", () => {
  showScreen(STATE === "VICTORY" ? "victory" : "start");
});
