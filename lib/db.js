import postgres from 'postgres';

let sql = null;
let ready = null;

export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) {
      const e = new Error('Database is not configured. Set DATABASE_URL.');
      e.status = 503;
      throw e;
    }
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    sql = postgres(url, {
      prepare: false,                 // required for transaction poolers (Supabase 6543, Neon pooled)
      max: Number(process.env.PG_POOL_MAX) || 3,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: local ? false : 'require',
      onnotice: () => {}
    });
  }
  return sql;
}

const SCHEMA = `
create table if not exists pc_questions (
  id serial primary key,
  key text unique not null,
  category text not null,
  difficulty smallint not null default 2,
  text text not null,
  options jsonb not null,
  answer smallint not null,
  fact text not null default '',
  time_s smallint not null default 20,
  times_used int not null default 0,
  active boolean not null default true
);
create table if not exists pc_players (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  nickname text not null,
  avatar jsonb not null,
  role text not null default '',
  interest text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists pc_players_nick on pc_players (lower(nickname));
create table if not exists pc_games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  phase text not null default 'lobby',
  idx int not null default -1,
  plan jsonb not null,
  settings jsonb,
  q_open_at timestamptz,
  q_ends_at timestamptz,
  reveal jsonb,
  matches jsonb,
  version int not null default 1
);
create index if not exists pc_games_created on pc_games (created_at desc);
create table if not exists pc_game_players (
  game_id uuid not null references pc_games(id) on delete cascade,
  player_id uuid not null references pc_players(id) on delete cascade,
  score int not null default 0,
  streak int not null default 0,
  correct int not null default 0,
  total_ms int not null default 0,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (game_id, player_id)
);
create index if not exists pc_gp_rank on pc_game_players (game_id, score desc, total_ms asc);
create table if not exists pc_answers (
  game_id uuid not null references pc_games(id) on delete cascade,
  player_id uuid not null references pc_players(id) on delete cascade,
  idx int not null,
  choice smallint not null,
  ms int not null,
  correct boolean,
  points int not null default 0,
  primary key (game_id, idx, player_id)
);
create table if not exists pc_meta (key text primary key, value jsonb);
`;

export function ensureSchema() {
  if (!ready) ready = db().begin(async tx => {
    await tx`select pg_advisory_xact_lock(724201)`; // avoid races when many cold starts create tables at once
    await tx.unsafe(SCHEMA);
  }).then(() => true, e => { ready = null; throw e; });
  return ready;
}
