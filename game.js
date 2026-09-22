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
// Tamaño LÓGICO del mundo visible. El canvas se escala con CSS para ser
// responsive, y su resolución interna se multiplica por devicePixelRatio para
// que se vea nítido en celulares y pantallas retina.
const CANVAS_W = 900;
const CANVAS_H = 360;
function setupHiDPI() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupHiDPI();
window.addEventListener("resize", setupHiDPI);

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

// Paso fijo de simulación: la física SIEMPRE avanza a 60 pasos por segundo,
// sin importar los FPS del dispositivo (30 Hz en modo ahorro de batería,
// 120/144 Hz en monitores gamer, caídas de rendimiento…). Así la velocidad
// del nivel y el arco de salto de 41 pasos son idénticos en cualquier equipo.
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5; // si el equipo se traba, no intenta "ponerse al día" sin límite

// ---------- Estado del juego ----------
let STATE = "START"; // START | COUNTDOWN | PLAYING | FAIL | LEVEL_COMPLETE | VICTORY
let currentLevelIndex = 0;
let attemptsPerLevel = new Array(LEVELS.length).fill(0); // se re-crea también en btn-start
let playerName = "Anónimo";
let jumpHeld = false; // true mientras el jugador mantiene presionado saltar
let countdownEndsAt = 0;

let player, cameraX, levelStartTime, elapsed, deathLabel;
let simSteps = 0;     // pasos de física simulados en el intento actual (cronómetro justo)
let accumulator = 0;  // tiempo real pendiente de simular

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
  simSteps = 0;
  accumulator = 0;
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
// En celular se puede tocar CUALQUIER parte de la pantalla para saltar (no solo
// el canvas), así en vertical no tienes que atinarle a una franja delgada.
function isPlayingTouch(e) {
  return (STATE === "PLAYING" || STATE === "COUNTDOWN") && !e.target.closest("button, input, a, .screen");
}
window.addEventListener("touchstart", (e) => {
  if (!isPlayingTouch(e)) return;
  e.preventDefault();
  setJumpHeld(true);
}, { passive: false });
window.addEventListener("touchend", (e) => {
  if (isPlayingTouch(e)) e.preventDefault();
  setJumpHeld(false); // siempre suelta, aunque hayas muerto a medio toque
}, { passive: false });
window.addEventListener("touchcancel", () => setJumpHeld(false));

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

function updatePhysics() {
  const level = LEVELS[currentLevelIndex];
  simSteps++;

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
  // Tiempo del intento = pasos simulados (no reloj real): si el juego se traba
  // o pierdes el foco de la pestaña, no te penaliza en el ranking.
  elapsed = simSteps * STEP_MS;
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
  ctx.fillRect(0, level.groundY, CANVAS_W, CANVAS_H - level.groundY);
  for (const obs of level.obstacles) {
    if (obs.type !== "gap") continue;
    const sx = obs.x - cameraX;
    if (sx + obs.w < 0 || sx > CANVAS_W) continue;
    ctx.clearRect(sx, level.groundY, obs.w, CANVAS_H - level.groundY);
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
      // En grupos de picos pegados solo uno dibuja la etiqueta (noLabel en los demás).
      if (!obs.noLabel) drawLabel(obs.label, sx + obs.w / 2, fromCeiling ? tip + 16 : tip - 6);
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
  // dt acotado: si la pestaña estuvo oculta, no simula segundos de golpe.
  const dt = Math.min(t - lastTime, STEP_MS * MAX_STEPS_PER_FRAME);
  lastTime = t;

  if (STATE === "PLAYING") {
    if (levelStartTime === null) levelStartTime = t; // arranca el cronómetro justo al salir de la cuenta regresiva
    accumulator += dt;
    while (accumulator >= STEP_MS && STATE === "PLAYING") {
      updatePhysics();
      accumulator -= STEP_MS;
    }
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
  const level = LEVELS[currentLevelIndex];
  logDeath({
    level: currentLevelIndex,
    obstacle: label,
    progress: (player.worldX / level.length) * 100
  }); // sin await: no retrasa la pantalla de derrota
  document.getElementById("fail-detail").textContent =
    `Te detuvo: "${label}" — intento #${attemptsPerLevel[currentLevelIndex]} en este nivel.`;
  showScreen("fail");
}

async function completeLevel() {
  STATE = "LEVEL_COMPLETE";
  sfx.levelComplete();
  const timeMs = simSteps * STEP_MS;
  const attempts = attemptsPerLevel[currentLevelIndex];
  const statsText = `Tiempo: ${(timeMs / 1000).toFixed(1)}s · Choques antes de pasarlo: ${attempts}`;

  const saved = await saveScore({
    playerName,
    level: currentLevelIndex,
    timeMs,
    attempts
  });
  attemptsPerLevel[currentLevelIndex] = 0; // cada resultado guarda los choques de ESA corrida
  refreshAccountProgress();

  const guestNote = !saved && supabaseReady ? " · (Invitado: no se guardó en el ranking)" : "";

  if (currentLevelIndex === LEVELS.length - 1) {
    document.getElementById("victory-stats").textContent = statsText + guestNote;
    sfx.victory();
    showScreen("victory");
    STATE = "VICTORY";
    runDeploySequence();
  } else {
    document.getElementById("level-complete-stats").textContent = statsText + guestNote;
    showScreen("levelComplete");
  }
}

// ============================================================
// DEPLOY FINAL — al pasar el último nivel, se "despliega" DevBoard
// (dashboard.html) con las estadísticas del jugador.
// ============================================================
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** La animación de deploy sigue solo mientras la pantalla de victoria esté a la vista. */
function deployActive() {
  return STATE === "VICTORY" && !screens.victory.classList.contains("hidden");
}

async function runDeploySequence() {
  const log = document.getElementById("deploy-log");
  const btnOpen = document.getElementById("btn-open-devboard");
  const btnCreate = document.getElementById("btn-create-account");
  btnOpen.classList.add("hidden");
  btnCreate.classList.add("hidden");
  log.textContent = "";
  const print = async (line, wait = 380) => {
    if (!deployActive()) return; // el jugador ya salió de la pantalla
    log.textContent += line + "\n";
    await sleep(wait);
  };

  await print("$ git push origin main");
  await print("→ Ejecutando pipeline de CI/CD…");

  if (!currentUser) {
    await print("✗ Deploy rechazado: se requiere una cuenta para desplegar a producción.", 0);
    btnCreate.classList.toggle("hidden", !supabaseReady);
    return;
  }

  const completed = await getCompletedLevels();
  for (let i = 0; i < LEVELS.length; i++) {
    const ok = completed.has(i);
    await print(`  ${ok ? "✓" : "✗"} Etapa ${i + 1}: ${LEVELS[i].name.replace(/^Nivel \d+:\s*/, "")}`, 220);
  }

  const missing = LEVELS.map((_, i) => i).filter((i) => !completed.has(i));
  if (missing.length > 0) {
    await print(`✗ Build incompleto: te falta completar ${missing.map((i) => "Nivel " + (i + 1)).join(", ")}.`, 0);
    return;
  }

  await print("✓ Build exitoso — desplegando DevBoard a producción…", 600);
  btnOpen.classList.remove("hidden");
  for (let s = 3; s > 0; s--) {
    if (!deployActive()) return;
    await print(`  Abriendo en ${s}…`, 1000);
  }
  if (deployActive()) goToDevBoard(true);
}

function goToDevBoard(justDeployed = false) {
  window.location.href = "dashboard.html" + (justDeployed ? "?deploy=1" : "");
}

// ============================================================
// UI — botones
// ============================================================
function startGame() {
  ensureAudio();
  playerName = currentUser ? displayNameOf(currentUser) : "Invitado";
  attemptsPerLevel = new Array(LEVELS.length).fill(0);
  openLevelSelect();
}
document.getElementById("btn-start").addEventListener("click", startGame);
document.getElementById("btn-start-offline").addEventListener("click", startGame);
document.getElementById("btn-guest").addEventListener("click", startGame);
document.getElementById("btn-open-devboard").addEventListener("click", () => goToDevBoard(true));
document.getElementById("btn-devboard").addEventListener("click", () => goToDevBoard(false));
document.getElementById("btn-create-account").addEventListener("click", () => {
  STATE = "START";
  setAuthMode("register");
  showScreen("start");
});

document.getElementById("btn-retry").addEventListener("click", () => {
  startCountdown();
});

document.getElementById("btn-menu").addEventListener("click", () => {
  STATE = "START";
  refreshAccountProgress();
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

async function renderLevelSelect() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";
  // Mejores tiempos personales (solo con sesión) para marcar niveles completados.
  const myBest = {};
  (await getMyScores()).forEach((s) => {
    if (myBest[s.level] === undefined || s.time_ms < myBest[s.level]) myBest[s.level] = s.time_ms;
  });

  LEVELS.forEach((level, i) => {
    const card = document.createElement("button");
    const done = myBest[i] !== undefined;
    card.className = "level-card" + (done ? " done" : "");
    card.innerHTML = `
      <span class="level-num">NIVEL ${i + 1}${done ? " · ✓" : ""}</span>
      <div class="level-name">${level.name.replace(/^Nivel \d+:\s*/, "")}</div>
      ${done ? `<div class="level-mine">Tu mejor: ${(myBest[i] / 1000).toFixed(1)}s</div>` : ""}
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
        ? `Récord: ${(scores[0].time_ms / 1000).toFixed(1)}s (${escapeHtml(scores[0].player_name)})`
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
    li.innerHTML = `<span>#${i + 1} ${escapeHtml(s.player_name)}</span><span>${(s.time_ms / 1000).toFixed(1)}s</span>`;
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

// ============================================================
// CUENTAS — registro / login en el menú de inicio (Supabase Auth)
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let authMode = "login"; // "login" | "register"
const authEls = {
  loggedOut: document.getElementById("auth-logged-out"),
  loggedIn: document.getElementById("auth-logged-in"),
  offline: document.getElementById("auth-offline"),
  form: document.getElementById("auth-form"),
  username: document.getElementById("auth-username"),
  email: document.getElementById("auth-email"),
  password: document.getElementById("auth-password"),
  submit: document.getElementById("auth-submit"),
  message: document.getElementById("auth-message"),
  name: document.getElementById("auth-display-name"),
  mail: document.getElementById("auth-display-email"),
  progressText: document.getElementById("deploy-progress-text"),
  progressFill: document.getElementById("deploy-progress-fill"),
  devboardBtn: document.getElementById("btn-devboard")
};

function setAuthMessage(text, kind = "") {
  authEls.message.textContent = text;
  authEls.message.className = "auth-message" + (kind ? " " + kind : "");
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.mode === mode));
  authEls.username.classList.toggle("hidden", mode !== "register");
  authEls.submit.textContent = mode === "register" ? "Crear cuenta" : "Iniciar sesión";
  authEls.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  setAuthMessage("");
}

document.querySelectorAll(".auth-tab").forEach((tab) =>
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode)));

// Evita que escribir "espacio" en los campos haga saltar a Byte.
authEls.form.addEventListener("keydown", (e) => e.stopPropagation());
authEls.form.addEventListener("keyup", (e) => e.stopPropagation());

authEls.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEls.email.value.trim();
  const password = authEls.password.value;
  const username = authEls.username.value.trim();

  if (!email || !password) return setAuthMessage("Escribe tu correo y contraseña.", "error");
  if (password.length < 6) return setAuthMessage("La contraseña debe tener al menos 6 caracteres.", "error");
  if (authMode === "register" && username.length < 2) {
    return setAuthMessage("Elige un nombre de jugador (mín. 2 letras).", "error");
  }

  authEls.submit.disabled = true;
  setAuthMessage(authMode === "register" ? "Creando cuenta…" : "Iniciando sesión…");
  const result = authMode === "register"
    ? await signUp({ email, password, username })
    : await signIn({ email, password });
  authEls.submit.disabled = false;

  if (result.error) return setAuthMessage(result.error, "error");
  if (result.needsConfirmation) {
    setAuthMode("login");
    return setAuthMessage("¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.", "ok");
  }
  authEls.password.value = "";
  // onAuthChange se encarga de actualizar la tarjeta.
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await signOut();
  setAuthMode("login");
});

/** Actualiza la barra "Etapas completadas" y el candado del DevBoard. */
async function refreshAccountProgress() {
  if (!currentUser) return;
  const completed = await getCompletedLevels();
  const n = completed.size;
  const total = LEVELS.length;
  authEls.progressText.textContent = `Etapas completadas: ${n}/${total}`;
  authEls.progressFill.style.width = (n / total) * 100 + "%";
  const unlocked = n >= total;
  authEls.devboardBtn.disabled = !unlocked;
  authEls.devboardBtn.textContent = unlocked ? "🚀 Mi DevBoard" : `🔒 Mi DevBoard (${n}/${total})`;
}

function renderAuthCard(user) {
  authEls.offline.classList.toggle("hidden", supabaseReady);
  authEls.loggedOut.classList.toggle("hidden", !supabaseReady || !!user);
  authEls.loggedIn.classList.toggle("hidden", !supabaseReady || !user);
  if (user) {
    authEls.name.textContent = displayNameOf(user);
    authEls.mail.textContent = user.email;
    playerName = displayNameOf(user);
    refreshAccountProgress();
  }
}

getCurrentUser().then(renderAuthCard);
onAuthChange(renderAuthCard);
