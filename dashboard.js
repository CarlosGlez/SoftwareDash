// ============================================================
// DevBoard — el "software" que Byte estuvo compilando.
// ------------------------------------------------------------
// Página final de SoftwareDash. Lee de Supabase (supabase-config.js)
// los resultados y choques del usuario con sesión y los muestra como
// si fuera el dashboard de un proyecto desplegado:
//   - cada nivel = una etapa del pipeline de CI/CD
//   - cada nivel completado = un "build" exitoso
//   - cada choque = un bug que detuvo el build
// Solo se desbloquea si el usuario completó los 5 niveles.
// ============================================================

const $ = (id) => document.getElementById(id);
const stageName = (i) => LEVELS[i].name.replace(/^Nivel \d+:\s*/, "");
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Hash corto estilo git (determinístico) para decorar builds. */
function shortHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function timeAgo(iso) {
  const diff = (new Date(iso) - Date.now()) / 1000;
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), unit);
  return "justo ahora";
}

// ---------- Tooltip compartido ----------
const tip = $("tooltip");
function showTip(e, html) {
  tip.innerHTML = html;
  tip.classList.remove("hidden");
  const pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
function hideTip() { tip.classList.add("hidden"); }

// ============================================================
// Carga inicial
// ============================================================
async function init() {
  const user = await getCurrentUser();
  $("loading").classList.add("hidden");

  if (!supabaseReady) return showLocked("DevBoard no disponible", "Supabase no está configurado, así que no hay cuentas ni estadísticas.", null);
  if (!user) return showLocked("Inicia sesión para ver tu DevBoard", "Cada jugador tiene su propio DevBoard. Inicia sesión (o crea una cuenta) desde el menú del juego y completa los 5 niveles.", null);

  $("user-chip").classList.remove("hidden");
  $("btn-logout").classList.remove("hidden");
  const name = displayNameOf(user);
  $("user-name").textContent = name;
  $("user-avatar").textContent = name.slice(0, 2).toUpperCase();

  const [scores, deaths, ranks] = await Promise.all([getMyScores(), getMyDeaths(), getBestTimesByLevel()]);
  const completed = new Set(scores.map((s) => s.level));

  if (completed.size < LEVELS.length) {
    return showLocked(
      "Build pendiente",
      `Llevas ${completed.size} de ${LEVELS.length} etapas. DevBoard se despliega cuando completas todos los niveles con tu cuenta.`,
      completed
    );
  }

  renderDashboard({ user, name, scores, deaths, ranks });
}

function showLocked(title, text, completed) {
  $("locked-title").textContent = title;
  $("locked-text").textContent = text;
  const wrap = $("locked-stages");
  wrap.innerHTML = "";
  if (completed) {
    LEVELS.forEach((_, i) => {
      const s = document.createElement("span");
      s.className = completed.has(i) ? "ok" : "";
      s.textContent = `${completed.has(i) ? "✓" : "○"} Nivel ${i + 1}`;
      wrap.appendChild(s);
    });
  }
  $("locked").classList.remove("hidden");
}

// ============================================================
// Dashboard
// ============================================================
function renderDashboard({ user, name, scores, deaths, ranks }) {
  $("dashboard").classList.remove("hidden");
  if (new URLSearchParams(location.search).has("deploy")) {
    $("deploy-banner").classList.remove("hidden");
    history.replaceState(null, "", location.pathname); // que no salga de nuevo al recargar
  }

  // ----- Estadísticas por nivel -----
  const perLevel = LEVELS.map((_, i) => {
    const runs = scores.filter((s) => s.level === i);
    const lvlDeaths = deaths.filter((d) => d.level === i);
    const best = Math.min(...runs.map((r) => r.time_ms));
    const firstClear = runs.reduce((a, r) => (!a || r.created_at < a ? r.created_at : a), null);
    const board = ranks[i] || [];
    const pos = board.findIndex((r) => r.user_id === user.id);
    const killers = {};
    lvlDeaths.forEach((d) => { killers[d.obstacle] = (killers[d.obstacle] || 0) + 1; });
    const topKiller = Object.entries(killers).sort((a, b) => b[1] - a[1])[0] || null;
    return {
      i, best, firstClear,
      clears: runs.length,
      deaths: lvlDeaths.length,
      rank: pos >= 0 ? pos + 1 : null,
      players: board.length,
      topKiller
    };
  });

  // ----- Cabecera -----
  const deployedAt = perLevel.reduce((a, l) => (l.firstClear > a ? l.firstClear : a), "");
  $("crumb-user").textContent = name;
  $("project-meta").textContent =
    `commit ${shortHash(user.id + deployedAt)} · desplegado ${new Date(deployedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} · ${user.email}`;

  // ----- KPIs -----
  const totalBest = perLevel.reduce((a, l) => a + l.best, 0);
  const successRate = scores.length / (scores.length + deaths.length);
  const bestRank = perLevel.filter((l) => l.rank).sort((a, b) => a.rank - b.rank)[0];
  const kpis = [
    { label: "Tiempo de build", value: secs(totalBest), sub: "suma de tus mejores tiempos" },
    { label: "Builds exitosos", value: scores.length, sub: "niveles completados en total" },
    { label: "Choques", value: deaths.length, sub: "bugs que te detuvieron" },
    { label: "Tasa de éxito", value: Math.round(successRate * 100) + "%", sub: "builds / (builds + choques)" },
    bestRank
      ? { label: "Mejor posición", value: "#" + bestRank.rank, sub: `en Nivel ${bestRank.i + 1} de ${bestRank.players} jugadores` }
      : { label: "Mejor posición", value: "—", sub: "sin datos de ranking" }
  ];
  $("kpis").innerHTML = kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join("");

  // ----- Pipeline (una tarjeta por nivel) -----
  $("pipeline").innerHTML = perLevel.map((l) => `
    <article class="stage">
      <div class="stage-num">✓ ETAPA ${l.i + 1}</div>
      <div class="stage-name">${escapeHtml(stageName(l.i))}</div>
      <dl>
        <dt>Mejor tiempo</dt><dd>${secs(l.best)}</dd>
        <dt>Completado</dt><dd>${l.clears}×</dd>
        <dt>Choques</dt><dd>${l.deaths}</dd>
        <dt>Ranking</dt><dd>${l.rank ? `#${l.rank} de ${l.players}` : "—"}</dd>
      </dl>
      <div class="killer">${l.topKiller
        ? `Bug más letal: <code>${escapeHtml(l.topKiller[0])}</code> (${l.topKiller[1]})`
        : "Sin choques registrados 🧼"}</div>
    </article>`).join("");

  renderDeathsChart(perLevel);
  renderHeatmap(deaths);
  renderTopBugs(deaths);
  renderBuildLog(scores);
}

// ---------- Barras: choques por nivel ----------
function renderDeathsChart(perLevel) {
  const W = 420, H = 210, padL = 28, padB = 26, padT = 18;
  const max = Math.max(1, ...perLevel.map((l) => l.deaths));
  const niceMax = Math.ceil(max / 4) * 4;
  const plotH = H - padB - padT;
  const slot = (W - padL) / perLevel.length;
  const barW = Math.min(44, slot * 0.55);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Choques por nivel">`;
  // Rejilla recesiva
  [0, 0.5, 1].forEach((f) => {
    const y = padT + plotH * (1 - f);
    svg += `<line class="grid" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/>`;
    svg += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end">${Math.round(niceMax * f)}</text>`;
  });
  perLevel.forEach((l, idx) => {
    const cx = padL + slot * idx + slot / 2;
    const h = (l.deaths / niceMax) * plotH;
    const y = padT + plotH - h;
    const r = Math.min(4, h / 2);
    // Barra con esquinas superiores redondeadas (4px) y base plana
    if (h > 0) {
      svg += `<path class="bar" data-idx="${idx}" d="M${cx - barW / 2},${padT + plotH} V${y + r} Q${cx - barW / 2},${y} ${cx - barW / 2 + r},${y} H${cx + barW / 2 - r} Q${cx + barW / 2},${y} ${cx + barW / 2},${y + r} V${padT + plotH} Z"/>`;
    }
    svg += `<text class="val" x="${cx}" y="${y - 6}" text-anchor="middle">${l.deaths}</text>`;
    svg += `<text x="${cx}" y="${H - 8}" text-anchor="middle">N${l.i + 1}</text>`;
    svg += `<rect class="hit" data-idx="${idx}" x="${cx - slot / 2}" y="${padT}" width="${slot}" height="${plotH}"/>`;
  });
  svg += "</svg>";
  const el = $("chart-deaths");
  el.innerHTML = svg;
  el.querySelectorAll(".hit").forEach((hit) => {
    const l = perLevel[+hit.dataset.idx];
    hit.addEventListener("mousemove", (e) => {
      el.querySelectorAll(".bar").forEach((b) => b.classList.toggle("dim", b.dataset.idx !== hit.dataset.idx));
      showTip(e, `<strong>Nivel ${l.i + 1}: ${escapeHtml(stageName(l.i))}</strong>${l.deaths} choques · ${l.clears} veces completado`);
    });
    hit.addEventListener("mouseleave", () => {
      el.querySelectorAll(".bar").forEach((b) => b.classList.remove("dim"));
      hideTip();
    });
  });
}

// ---------- Mapa de calor: dónde chocas (nivel × % de avance) ----------
function renderHeatmap(deaths) {
  const BUCKETS = 10;
  const grid = LEVELS.map(() => new Array(BUCKETS).fill(0));
  deaths.forEach((d) => {
    if (!grid[d.level]) return;
    grid[d.level][Math.min(BUCKETS - 1, Math.floor(d.progress / (100 / BUCKETS)))]++;
  });
  const max = Math.max(1, ...grid.flat());
  const W = 520, padL = 30, padB = 20, cellH = 30;
  const cellW = (W - padL) / BUCKETS;
  const H = LEVELS.length * cellH + padB;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de calor de choques por nivel y avance">`;
  grid.forEach((row, li) => {
    svg += `<text x="${padL - 8}" y="${li * cellH + cellH / 2 + 4}" text-anchor="end">N${li + 1}</text>`;
    row.forEach((n, b) => {
      // Escala secuencial de un solo tono: más choques = azul más intenso
      const alpha = n === 0 ? 0.06 : 0.18 + 0.82 * (n / max);
      svg += `<rect class="cell" data-l="${li}" data-b="${b}" x="${padL + b * cellW}" y="${li * cellH}" width="${cellW}" height="${cellH}" rx="3" fill="rgba(88,166,255,${alpha.toFixed(3)})"/>`;
    });
  });
  [0, 50, 100].forEach((p) => {
    const x = padL + (p / 100) * (W - padL);
    svg += `<text x="${x}" y="${H - 4}" text-anchor="${p === 0 ? "start" : p === 100 ? "end" : "middle"}">${p}%</text>`;
  });
  svg += "</svg>";
  const el = $("chart-heatmap");
  el.innerHTML = svg;
  el.querySelectorAll(".cell").forEach((c) => {
    const li = +c.dataset.l, b = +c.dataset.b;
    c.addEventListener("mousemove", (e) => showTip(e,
      `<strong>Nivel ${li + 1} · ${b * 10}–${b * 10 + 10}% del nivel</strong>${grid[li][b]} choques`));
    c.addEventListener("mouseleave", hideTip);
  });
}

// ---------- Top de bugs ----------
function renderTopBugs(deaths) {
  const counts = {};
  deaths.forEach((d) => {
    const key = d.obstacle;
    counts[key] = counts[key] || { n: 0, levels: new Set() };
    counts[key].n++;
    counts[key].levels.add(d.level + 1);
  });
  const top = Object.entries(counts).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  const el = $("top-bugs");
  if (top.length === 0) { el.outerHTML = `<p class="empty">Ningún bug te ha detenido. Código limpio. 🧼</p>`; return; }
  el.innerHTML = top.map(([bug, info]) => `
    <li><span><code>${escapeHtml(bug)}</code> <span class="muted">· N${[...info.levels].join(", N")}</span></span><strong>${info.n}</strong></li>`).join("");
}

// ---------- Historial tipo git log ----------
function renderBuildLog(scores) {
  $("build-log").innerHTML = scores.slice(0, 25).map((s) => `
    <li>
      <span class="hash">${shortHash(s.created_at + s.level)}</span>
      <span><span class="ok">✓</span> build(nivel-${s.level + 1}): ${secs(s.time_ms)} · ${s.attempts} choque${s.attempts === 1 ? "" : "s"}</span>
      <span class="when" title="${new Date(s.created_at).toLocaleString("es-MX")}">${timeAgo(s.created_at)}</span>
    </li>`).join("");
}

$("btn-logout").addEventListener("click", async () => {
  await signOut();
  location.href = "index.html";
});

init();
