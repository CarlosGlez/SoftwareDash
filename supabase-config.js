// ============================================================
// SoftwareDash — Configuración e integración con Supabase
// ------------------------------------------------------------
// Tablas, índices y políticas de seguridad: ver supabase-schema.sql
// (córrelo una vez en Supabase > SQL Editor).
//
// Este archivo expone tres grupos de funciones que usan game.js y
// dashboard.js:
//   - Cuentas (Supabase Auth): registro, login, logout, sesión actual.
//   - Resultados: guardar un nivel completado, ranking por nivel.
//   - Estadísticas personales: muertes y resultados del usuario.
//
// Si Supabase no está configurado, el juego sigue funcionando en modo
// local (localStorage) sin cuentas.
// ============================================================

const SUPABASE_URL = "https://xlbvxqcehjzyjlvwuhoc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NXLD9hjzXYf87__Qc1unZA_JprZO5g_";

let supabaseClient = null;
let supabaseReady = false;

try {
  if (
    typeof supabase !== "undefined" &&
    SUPABASE_URL &&
    !SUPABASE_URL.startsWith("PEGA_AQUI") &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.startsWith("PEGA_AQUI")
  ) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseReady = true;
    console.log("[SoftwareDash] Supabase conectado.");
  } else {
    console.warn(
      "[SoftwareDash] Supabase no configurado todavía. " +
      "El progreso se guardará solo localmente (localStorage)."
    );
  }
} catch (err) {
  console.error("[SoftwareDash] Error inicializando Supabase:", err);
}

// ============================================================
// CUENTAS (Supabase Auth — correo + contraseña)
// ============================================================

/** Sesión actual en caché (se actualiza con onAuthChange). */
let currentUser = null;

/** Nombre visible del usuario: el que eligió al registrarse, o la parte antes de la @. */
function displayNameOf(user) {
  if (!user) return "Invitado";
  return (user.user_metadata && user.user_metadata.username) || user.email.split("@")[0];
}

async function getCurrentUser() {
  if (!supabaseReady) return null;
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session ? data.session.user : null;
  return currentUser;
}

/** Llama a `callback(user|null)` ahora y cada vez que cambie la sesión. */
function onAuthChange(callback) {
  if (!supabaseReady) { callback(null); return; }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    callback(currentUser);
  });
}

/** Traduce los errores más comunes de Supabase Auth a español. */
function authErrorMessage(error) {
  const msg = (error && error.message) || "";
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de iniciar sesión (revisa tu bandeja y spam).";
  if (/already registered|already exists/i.test(msg)) return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (/password.*(6|characters)/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  // Límite del servicio de correo gratuito de Supabase (se alcanza rápido si "Confirm email" está activo).
  if (/email rate limit/i.test(msg)) return "Se alcanzó el límite de correos de confirmación por hora. Intenta más tarde (o pide al admin desactivar la confirmación por correo).";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  if (/invalid.*email|email.*invalid/i.test(msg)) return "Ese correo no es válido.";
  return msg || "Ocurrió un error. Intenta de nuevo.";
}

/**
 * Registra una cuenta nueva. Devuelve { user, needsConfirmation, error }.
 * Si en Supabase está activado "Confirm email", no hay sesión hasta que el
 * usuario da clic en el enlace de su correo (needsConfirmation = true).
 */
async function signUp({ email, password, username }) {
  if (!supabaseReady) return { error: "Supabase no está configurado." };
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) return { error: authErrorMessage(error) };
  // Supabase devuelve un usuario "falso" sin identidades si el correo ya existía.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: "Ese correo ya tiene una cuenta. Inicia sesión." };
  }
  return { user: data.user, needsConfirmation: !data.session };
}

async function signIn({ email, password }) {
  if (!supabaseReady) return { error: "Supabase no está configurado." };
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };
  return { user: data.user };
}

async function signOut() {
  if (!supabaseReady) return;
  await supabaseClient.auth.signOut();
}

// ============================================================
// RESULTADOS Y RANKING
// ============================================================
const LOCAL_KEY = "softwaredash_scores";

function localGetAll() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function localSave(entry) {
  try {
    const all = localGetAll();
    all.push(entry);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch { /* almacenamiento bloqueado: no pasa nada */ }
}

/**
 * Guarda un nivel completado. Con Supabase activo solo se guarda si hay
 * sesión (los invitados no entran al ranking). Sin Supabase, va a localStorage.
 */
async function saveScore({ playerName, level, timeMs, attempts }) {
  const entry = {
    player_name: playerName || "Anónimo",
    level,
    time_ms: Math.round(timeMs),
    attempts
  };

  if (!supabaseReady) { localSave(entry); return true; }
  if (!currentUser) return false; // invitado

  const { error } = await supabaseClient
    .from("scores")
    .insert({ ...entry, user_id: currentUser.id });
  if (error) {
    console.error("[SoftwareDash] Error guardando en Supabase:", error);
    return false;
  }
  return true;
}

/** Registra un choque (solo usuarios con sesión). No bloquea el juego si falla. */
async function logDeath({ level, obstacle, progress }) {
  if (!supabaseReady || !currentUser) return;
  const { error } = await supabaseClient.from("deaths").insert({
    user_id: currentUser.id,
    level,
    obstacle: String(obstacle).slice(0, 80),
    progress: Math.max(0, Math.min(100, Math.round(progress)))
  });
  if (error) console.error("[SoftwareDash] Error guardando muerte:", error);
}

/** Top 10 de mejores tiempos para un nivel (índice desde 0). */
async function getTopScores(level) {
  if (supabaseReady) {
    const { data, error } = await supabaseClient
      .from("scores")
      .select("player_name, time_ms, attempts")
      .eq("level", level)
      .order("time_ms", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[SoftwareDash] Error leyendo ranking:", error);
      return [];
    }
    return data;
  }

  return localGetAll()
    .filter((s) => s.level === level)
    .sort((a, b) => a.time_ms - b.time_ms)
    .slice(0, 10);
}

// ============================================================
// ESTADÍSTICAS PERSONALES (DevBoard)
// ============================================================

/** Todos los niveles completados por el usuario actual. */
async function getMyScores() {
  if (!supabaseReady || !currentUser) return [];
  const { data, error } = await supabaseClient
    .from("scores")
    .select("level, time_ms, attempts, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

/** Todos los choques del usuario actual. */
async function getMyDeaths() {
  if (!supabaseReady || !currentUser) return [];
  const { data, error } = await supabaseClient
    .from("deaths")
    .select("level, obstacle, progress, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) { console.error(error); return []; }
  return data;
}

/**
 * Mejor tiempo de cada jugador con cuenta en cada nivel, para calcular
 * posiciones en el ranking: { [level]: [{ user_id, time_ms }, ...] ordenado }.
 */
async function getBestTimesByLevel() {
  if (!supabaseReady) return {};
  const { data, error } = await supabaseClient
    .from("scores")
    .select("user_id, level, time_ms")
    .not("user_id", "is", null)
    .limit(10000);
  if (error) { console.error(error); return {}; }

  const best = {}; // level -> user_id -> time
  for (const row of data) {
    best[row.level] = best[row.level] || {};
    const prev = best[row.level][row.user_id];
    if (prev === undefined || row.time_ms < prev) best[row.level][row.user_id] = row.time_ms;
  }
  const out = {};
  for (const level of Object.keys(best)) {
    out[level] = Object.entries(best[level])
      .map(([user_id, time_ms]) => ({ user_id, time_ms }))
      .sort((a, b) => a.time_ms - b.time_ms);
  }
  return out;
}

/** Índices (desde 0) de los niveles que el usuario ya completó al menos una vez. */
async function getCompletedLevels() {
  const scores = await getMyScores();
  return new Set(scores.map((s) => s.level));
}
