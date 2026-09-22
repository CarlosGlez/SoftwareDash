-- ============================================================
-- SoftwareDash — Esquema de Supabase (cuentas + estadísticas)
-- ------------------------------------------------------------
-- Córrelo UNA vez en Supabase > SQL Editor > New query > Run.
-- Es seguro correrlo aunque ya exista la tabla `scores` original.
-- ============================================================

-- 1) Tabla de resultados (niveles completados) -----------------
create table if not exists scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  level int not null,
  time_ms int not null,
  attempts int not null,
  created_at timestamp with time zone default now()
);

-- Cada resultado nuevo pertenece a una cuenta (las filas viejas quedan con null).
alter table scores
  add column if not exists user_id uuid references auth.users (id) on delete cascade
  default auth.uid();

create index if not exists scores_level_time_idx on scores (level, time_ms);
create index if not exists scores_user_idx on scores (user_id);

alter table scores enable row level security;

-- Cualquiera puede LEER el ranking…
drop policy if exists "allow read" on scores;
create policy "allow read" on scores for select using (true);

-- …pero solo un usuario con sesión puede INSERTAR, y solo a su nombre.
drop policy if exists "allow insert" on scores;
drop policy if exists "insert own scores" on scores;
create policy "insert own scores" on scores
  for insert to authenticated
  with check (auth.uid() = user_id);
-- (No hay políticas de update/delete: nadie puede editar ni borrar resultados.)

-- 2) Tabla de muertes (para las estadísticas del DevBoard) -----
-- Una fila por cada choque: en qué nivel, contra qué "bug" y a qué % del nivel.
create table if not exists deaths (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level int not null,
  obstacle text not null,
  progress int not null check (progress between 0 and 100),
  created_at timestamp with time zone default now()
);

create index if not exists deaths_user_idx on deaths (user_id, level);

alter table deaths enable row level security;

drop policy if exists "read own deaths" on deaths;
create policy "read own deaths" on deaths
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own deaths" on deaths;
create policy "insert own deaths" on deaths
  for insert to authenticated
  with check (auth.uid() = user_id);
