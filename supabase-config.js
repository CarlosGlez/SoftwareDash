// ============================================================
// SoftwareDash — Configuración e integración con Supabase
// ------------------------------------------------------------
// 1) Crea un proyecto gratis en https://supabase.com
// 2) En el SQL Editor de tu proyecto, corre esto para crear la tabla:
//
//    create table scores (
//      id bigint generated always as identity primary key,
//      player_name text not null,
//      level int not null,
//      time_ms int not null,
//      attempts int not null,
//      created_at timestamp with time zone default now()
//    );
//
//    -- Permite lectura/escritura pública (suficiente para este proyecto escolar):
//    alter table scores enable row level security;
//    create policy "allow read" on scores for select using (true);
//    create policy "allow insert" on scores for insert with check (true);
//
// 3) Copia tu "Project URL" y tu "anon public key" (Settings > API)
//    y pégalas abajo.
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
      "El progreso se guardará solo localmente (localStorage) hasta que " +
      "pongas tu URL y anon key en supabase-config.js."
    );
  }
} catch (err) {
  console.error("[SoftwareDash] Error inicializando Supabase:", err);
}

const LOCAL_KEY = "softwaredash_scores";

function localGetAll() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function localSave(entry) {
  const all = localGetAll();
  all.push(entry);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

/**
 * Guarda un resultado (nivel completado) en Supabase, o en localStorage
 * si Supabase no está configurado todavía.
 */
async function saveScore({ playerName, level, timeMs, attempts }) {
  const entry = {
    player_name: playerName || "Anónimo",
    level,
    time_ms: Math.round(timeMs),
    attempts
  };

  if (supabaseReady) {
    const { error } = await supabaseClient.from("scores").insert(entry);
    if (error) {
      console.error("[SoftwareDash] Error guardando en Supabase:", error);
      localSave(entry); // fallback para no perder el progreso
    }
  } else {
    localSave(entry);
  }
}

/**
 * Devuelve el top 10 de mejores tiempos para un nivel dado (0, 1 o 2).
 */
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

  // Fallback local: filtra, ordena y recorta a 10
  return localGetAll()
    .filter((s) => s.level === level)
    .sort((a, b) => a.time_ms - b.time_ms)
    .slice(0, 10);
}
