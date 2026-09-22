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
  levelSelect: document.getElementById("screen-level-select"),
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
// Salto tipo Geometry Dash: impulso FIJO (no varía si mantienes presionado
// más o menos tiempo). Mantener presionado hace "bunny-hop": vuelve a saltar
// automáticamente cada vez que Byte toca el piso, igual que en el juego original.
const GRAVITY = 0.55;
const JUMP_VELOCITY = -11.5;
const ROTATION_SPEED = 0.14; // velocidad de giro del cubo mientras está en el aire
const PLAYER_SIZE = 30;
const PLAYER_SCREEN_X = 130; // posición fija del jugador en pantalla
const READY_DELAY_MS = 1500; // pausa de "prepárate" antes de que arranque el nivel

// ---------- Estado del juego ----------
let STATE = "START"; // START | COUNTDOWN | PLAYING | FAIL | LEVEL_COMPLETE | VICTORY
let currentLevelIndex = 0;
let attemptsPerLevel = new Array(LEVELS.length).fill(0); // se re-crea también en btn-start
let playerName = "Anónimo";
let jumpHeld = false; // true mientras el jugador mantiene presionado saltar
let countdownEndsAt = 0;

let player, cameraX, levelStartTime, elapsed, deathLabel;

function resetLevel() {
  player = {
    worldX: 0,
    y: LEVELS[currentLevelIndex].groundY - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    rotation: 0,
    gravityDir: 1
  };
  cameraX = 0;
  elapsed = 0;
  deathLabel = null;
  levelStartTime = null; // se fija al primer frame de PLAYING (después de la cuenta regresiva)
  hudLevel.textContent = LEVELS[currentLevelIndex].name;
  hudAttempts.textContent = `Intentos: ${attemptsPerLevel[currentLevelIndex]}`;
  progressBar.style.width = "0%";
  hudTimer.textContent = "0.0s";
}

/**
 * Prepara el nivel y da un margen de "prepárate" antes de activar los
 * controles y el scroll. Evita que, en niveles rápidos (nivel 3), el
 * jugador reciba un obstáculo encima apenas le da "Reintentar".
 */
function startCountdown() {
  resetLevel();
  STATE = "COUNTDOWN";
  countdownEndsAt = performance.now() + READY_DELAY_MS;
  showScreen(null);
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
// INPUT — un solo botón: saltar (estilo Geometry Dash: "bunny-hop")
// ------------------------------------------------------------
// No hay salto "variable" por duración. Mientras jumpHeld sea true,
// updatePhysics() vuelve a saltar automáticamente cada vez que Byte
// toca el piso — igual que mantener presionado en Geometry Dash.
// ============================================================
function setJumpHeld(value) {
  ensureAudio();
  jumpHeld = value;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); setJumpHeld(true); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") setJumpHeld(false);
});
canvas.addEventListener("mousedown", () => setJumpHeld(true));
canvas.addEventListener("mouseup", () => setJumpHeld(false));
canvas.addEventListener("mouseleave", () => setJumpHeld(false));
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); setJumpHeld(true); }, { passive: false });
canvas.addEventListener("touchend", (e) => { e.preventDefault(); setJumpHeld(false); }, { passive: false });

// ============================================================
// FÍSICA + COLISIONES
// ============================================================
function getGapAt(worldX) {
  return LEVELS[currentLevelIndex].obstacles.find(
    (o) => o.type === "gap" && worldX >= o.x && worldX <= o.x + o.w
  );
}

function getPlatformAt(worldX) {
  return LEVELS[currentLevelIndex].obstacles.find(
    (o) => o.type === "platform" && worldX >= o.x && worldX <= o.x + o.w
  );
}

/**
 * Un "gravityPortal" es un disparador de una sola posición: al cruzarlo,
 * la gravedad se invierte (o vuelve a la normalidad) hasta el siguiente.
 * Como worldX solo avanza, basta con encontrar el último portal ya cruzado.
 */
function getGravityDirAt(worldX) {
  const level = LEVELS[currentLevelIndex];
  let dir = 1;
  for (const obs of level.obstacles) {
    if (obs.type === "gravityPortal" && obs.x <= worldX) dir = obs.dir;
  }
  return dir;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function updatePhysics(dt) {
  const level = LEVELS[currentLevelIndex];

  // Avance horizontal automático (como en Geometry Dash)
  player.worldX += level.speed;
  cameraX = player.worldX - PLAYER_SCREEN_X;

  // Gravedad (invertida si venimos de un portal de gravedad con dir: -1)
  const gravityDir = getGravityDirAt(player.worldX);
  player.gravityDir = gravityDir; // usado por draw() para pintar a Byte distinto
  player.vy += GRAVITY * gravityDir;
  player.y += player.vy;

  // Rotación del cubo mientras está en el aire (estética Geometry Dash).
  // Gira al revés cuando la gravedad está invertida.
  if (!player.onGround) {
    player.rotation += ROTATION_SPEED * gravityDir;
  }

  const groundY = level.groundY;
  const centerX = player.worldX + PLAYER_SIZE / 2;
  // Los huecos y las plataformas solo existen en gravedad normal en este
  // juego (mantiene las secciones invertidas simples y jugables).
  const gap = gravityDir === 1 ? getGapAt(centerX) : null;
  const platform = gravityDir === 1 ? getPlatformAt(centerX) : null;

  let restY = null; // si el jugador debe quedar apoyado en algo este frame

  if (gravityDir === 1) {
    if (platform) {
      const platformTopY = groundY - platform.floatHeight - platform.thickness;
      const prevBottom = player.y + PLAYER_SIZE - player.vy;
      if (player.vy >= 0 && prevBottom <= platformTopY + 1) {
        // Cayó desde arriba: aterriza sobre la plataforma.
        restY = platformTopY - PLAYER_SIZE;
      } else if (player.y + PLAYER_SIZE > platformTopY && player.y < platformTopY + platform.thickness) {
        // La golpeó de lado o por abajo (saltó demasiado alto).
        return die(platform.label || "plataforma");
      }
    }
    if (restY === null && !gap && player.y + PLAYER_SIZE >= groundY) {
      restY = groundY - PLAYER_SIZE;
    }
  } else {
    // Gravedad invertida: el techo (y = 0) es la superficie de apoyo.
    if (player.y <= 0) restY = 0;
  }

  if (restY !== null) {
    player.y = restY;
    player.vy = 0;
    player.onGround = true;
    // Al aterrizar, el cubo "encaja" en el ángulo recto más cercano.
    player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
    // Bunny-hop: si el jugador mantiene presionado, vuelve a saltar de inmediato.
    if (jumpHeld) {
      player.vy = JUMP_VELOCITY * gravityDir;
      player.onGround = false;
      sfx.jump();
    }
  } else {
    player.onGround = false;
    if (gravityDir === 1 && gap && player.y + PLAYER_SIZE >= CANVAS_H) {
      return die(gap.label || "Vacío en el código");
    }
  }

  // Colisión contra picos, bloques y bugs de código (no contra
  // plataformas ni portales, que ya se resolvieron arriba).
  for (const obs of level.obstacles) {
    if (obs.type === "gap" || obs.type === "platform" || obs.type === "gravityPortal") continue;
    const anchorTop = obs.anchor === "ceiling" ? 0 : groundY - obs.h;
    const hit = rectsOverlap(
      player.worldX, player.y, PLAYER_SIZE, PLAYER_SIZE,
      obs.x, anchorTop, obs.w, obs.h
    );
    if (hit) return die(obs.label || obs.code || obs.type);
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
    if (sx < -140 || sx > CANVAS_W + 140) continue;
    const fromCeiling = obs.anchor === "ceiling";

    if (obs.type === "spike") {
      const base = fromCeiling ? 0 : level.groundY;
      const tip = fromCeiling ? obs.h : level.groundY - obs.h;
      ctx.fillStyle = "#f85149";
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.lineTo(sx + obs.w / 2, tip);
      ctx.lineTo(sx + obs.w, base);
      ctx.closePath();
      ctx.fill();
      drawLabel(obs.label, sx + obs.w / 2, fromCeiling ? tip + 16 : tip - 6);
    } else if (obs.type === "block") {
      const top = fromCeiling ? 0 : level.groundY - obs.h;
      ctx.fillStyle = "#d29922";
      ctx.fillRect(sx, top, obs.w, obs.h);
      drawLabel(obs.label, sx + obs.w / 2, fromCeiling ? top + obs.h + 14 : top - 6);
    } else if (obs.type === "codeBug") {
      const top = fromCeiling ? 0 : level.groundY - obs.h;
      // Tarjeta de "error" con una línea de código real adentro.
      ctx.fillStyle = "#2d1214";
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 2;
      ctx.fillRect(sx, top, obs.w, obs.h);
      ctx.strokeRect(sx, top, obs.w, obs.h);
      ctx.font = "10px monospace";
      ctx.fillStyle = "#ff8a85";
      ctx.textAlign = "center";
      ctx.fillText(obs.code || "// bug", sx + obs.w / 2, top + obs.h / 2 + 3);
      // subrayado "ondulado" de error, estilo IDE
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const underlineY = top + obs.h / 2 + 8;
      for (let wx = sx + 6; wx < sx + obs.w - 6; wx += 5) {
        ctx.lineTo(wx, underlineY + (Math.floor(wx / 5) % 2 === 0 ? 0 : 2));
      }
      ctx.stroke();
    } else if (obs.type === "platform") {
      const top = level.groundY - obs.floatHeight - obs.thickness;
      ctx.fillStyle = "#2ea043";
      ctx.fillRect(sx, top, obs.w, obs.thickness);
      ctx.fillStyle = "rgba(46,160,67,0.15)";
      ctx.fillRect(sx, top + obs.thickness, obs.w, obs.floatHeight); // "sombra" hasta el piso
      drawLabel(obs.label, sx + obs.w / 2, top - 6);
    } else if (obs.type === "gravityPortal") {
      const grad = ctx.createLinearGradient(sx, 0, sx, CANVAS_H);
      const color = obs.dir === -1 ? "168,85,247" : "88,166,255";
      grad.addColorStop(0, `rgba(${color},0.05)`);
      grad.addColorStop(0.5, `rgba(${color},0.35)`);
      grad.addColorStop(1, `rgba(${color},0.05)`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 6, 0, 12, CANVAS_H);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = `rgb(${color})`;
      ctx.textAlign = "center";
      ctx.fillText(obs.dir === -1 ? "⇅" : "⇅", sx, CANVAS_H / 2);
    } else if (obs.type === "gap") {
      // ya se ve como ausencia de piso; opcionalmente marcar el borde
      ctx.fillStyle = "rgba(248,81,73,0.15)";
      ctx.fillRect(sx, level.groundY, obs.w, CANVAS_H - level.groundY);
    }
  }

  // Jugador ("Byte") — cambia de color cuando la gravedad está invertida
  const px = PLAYER_SCREEN_X;
  const py = player.y;
  const inverted = player.gravityDir === -1;
  ctx.save();
  ctx.translate(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = inverted ? "#a855f7" : "#58a6ff";
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
    if (levelStartTime === null) levelStartTime = t; // arranca el cronómetro justo al salir de la cuenta regresiva
    updatePhysics(dt);
    draw();
  } else if (STATE === "COUNTDOWN") {
    draw(); // escena estática (nivel en su posición inicial) mientras se cuenta
    drawCountdown();
    if (performance.now() >= countdownEndsAt) {
      levelStartTime = null; // se fija en el primer frame de PLAYING
      STATE = "PLAYING";
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function drawCountdown() {
  const msLeft = Math.max(0, countdownEndsAt - performance.now());
  const secsLeft = Math.ceil(msLeft / 1000);
  ctx.save();
  ctx.fillStyle = "rgba(13,17,23,0.45)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#e6edf3";
  ctx.textAlign = "center";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText(secsLeft > 0 ? String(secsLeft) : "¡YA!", CANVAS_W / 2, CANVAS_H / 2 + 20);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#8b949e";
  ctx.fillText("Prepárate…", CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.restore();
}

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
  attemptsPerLevel = new Array(LEVELS.length).fill(0);
  openLevelSelect();
});

document.getElementById("btn-retry").addEventListener("click", () => {
  startCountdown();
});

document.getElementById("btn-menu").addEventListener("click", () => {
  STATE = "START";
  showScreen("start");
});

document.getElementById("btn-next-level").addEventListener("click", () => {
  currentLevelIndex++;
  startCountdown();
});

document.getElementById("btn-retry-level").addEventListener("click", () => {
  startCountdown();
});

document.getElementById("btn-restart-game").addEventListener("click", () => {
  openLevelSelect();
});

document.getElementById("btn-level-select-back").addEventListener("click", () => {
  STATE = "START";
  showScreen("start");
});

// ---------- Selección de nivel (catálogo, estilo Geometry Dash) ----------
// Se genera a partir del arreglo LEVELS, así que si se agregan más niveles
// en levels.js, aparecen aquí automáticamente sin tocar este archivo.
function openLevelSelect() {
  STATE = "START"; // el catálogo no es parte de la máquina de estados del juego en sí
  renderLevelSelect();
  showScreen("levelSelect");
}

function renderLevelSelect() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";

  LEVELS.forEach((level, i) => {
    const card = document.createElement("button");
    card.className = "level-card";
    card.innerHTML = `
      <span class="level-num">NIVEL ${i + 1}</span>
      <div class="level-name">${level.name.replace(/^Nivel \d+:\s*/, "")}</div>
      <div class="level-best" data-best-for="${i}">Cargando mejor tiempo…</div>
    `;
    card.addEventListener("click", () => {
      ensureAudio();
      currentLevelIndex = i;
      startCountdown();
    });
    grid.appendChild(card);

    // Mejor tiempo registrado (Supabase o localStorage) — no bloquea el render de la tarjeta.
    getTopScores(i).then((scores) => {
      const el = grid.querySelector(`[data-best-for="${i}"]`);
      if (!el) return;
      el.textContent = scores && scores.length > 0
        ? `Mejor tiempo: ${(scores[0].time_ms / 1000).toFixed(1)}s (${scores[0].player_name})`
        : "Sin jugar todavía";
    });
  });
}

// ---------- Ranking ----------
function renderLeaderboardTabs() {
  const wrap = document.getElementById("leaderboard-tabs");
  wrap.innerHTML = "";
  LEVELS.forEach((level, i) => {
    const btn = document.createElement("button");
    btn.className = "lb-tab" + (i === 0 ? " active" : "");
    btn.dataset.level = String(i);
    btn.textContent = `Nivel ${i + 1}`;
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderLeaderboard(i);
    });
    wrap.appendChild(btn);
  });
}
renderLeaderboardTabs();

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

function openLeaderboard() {
  showScreen("leaderboard");
  document.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
  const firstTab = document.querySelector('.lb-tab[data-level="0"]');
  if (firstTab) firstTab.classList.add("active");
  renderLeaderboard(0);
}

document.getElementById("btn-leaderboard").addEventListener("click", openLeaderboard);
document.getElementById("btn-view-ranking-final").addEventListener("click", openLeaderboard);
document.getElementById("btn-close-leaderboard").addEventListener("click", () => {
  showScreen(STATE === "VICTORY" ? "victory" : "start");
});
