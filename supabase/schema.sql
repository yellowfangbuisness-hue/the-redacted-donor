-- The Redacted Donor: online records (leaderboard, run reports, cloud saves).
-- Paste this whole file into a new Supabase project's SQL editor and run it once.
--
-- No sign-in: each device holds a random secret key. Tables have no direct write access;
-- every write goes through a function that hashes the key and only touches that player's rows.

create extension if not exists pgcrypto with schema extensions;

-- Player names: 2-16 letters/numbers/spaces, with a small bad-word block.
create or replace function public.is_clean_name(n text) returns boolean
language sql immutable set search_path = '' as $$
  select n ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,15}$'
     and not exists (
       select 1 from unnest(array['fuck','shit','cunt','nigg','fag','bitch','whore','slut','rape','nazi','hitler','dick','cock','pussy','penis','vagina','porn','retard','kike','spic','chink','twat','wank']) w
       where regexp_replace(lower(translate(n, '013457@$', 'oieastas')), '[^a-z]', '', 'g') like '%' || w || '%'
     );
$$;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  name text check (name is null or public.is_clean_name(name)),
  created_at timestamptz not null default now()
);
create table public.scores (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  score int not null check (score between -1000 and 6000),
  cases_closed smallint not null check (cases_closed between 0 and 3),
  rank text not null default '' check (char_length(rank) <= 40),
  seconds int not null check (seconds between 0 and 86400),
  veteran boolean not null default false,
  created_at timestamptz not null default now(),
  -- A finished three-case run cannot be faster than two minutes.
  constraint plausible_time check (cases_closed < 3 or seconds >= 120)
);
create index scores_board on public.scores (veteran, score desc);
create index scores_player on public.scores (player_id, created_at desc);
create table public.runs (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  outcome text not null check (outcome in ('won', 'caught', 'quit')),
  case_index smallint not null check (case_index between 0 and 3),
  cause text not null default '' check (char_length(cause) <= 40),
  score int not null check (score between -1000 and 6000),
  times_caught smallint not null default 0 check (times_caught between 0 and 999),
  spent int not null default 0 check (spent between 0 and 100000),
  items text[] not null default '{}' check (cardinality(items) <= 20),
  seconds int not null default 0 check (seconds between 0 and 86400),
  veteran boolean not null default false,
  created_at timestamptz not null default now()
);
create index runs_player on public.runs (player_id);
create table public.saves (
  player_id uuid primary key references public.players (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 32768),
  code text not null unique default upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12)),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.scores enable row level security;
alter table public.runs enable row level security;
alter table public.saves enable row level security;
-- Only names and scores are readable; key hashes, runs and saves are not.
revoke all on public.players, public.scores, public.runs, public.saves from anon, authenticated;
grant select (id, name) on public.players to anon, authenticated;
grant select on public.scores to anon, authenticated;
create policy "names are public" on public.players for select to anon, authenticated using (true);
create policy "scores are public" on public.scores for select to anon, authenticated using (true);

-- Leaderboard: each named player's best run per board (standard / veteran).
create view public.leaderboard with (security_invoker = on) as
select distinct on (s.player_id, s.veteran) p.name, s.score, s.cases_closed, s.rank, s.seconds, s.veteran, s.created_at
from public.scores s join public.players p on p.id = s.player_id
where p.name is not null
order by s.player_id, s.veteran, s.score desc, s.seconds asc;
grant select on public.leaderboard to anon, authenticated;

-- Internal: find or create the player for a device key (32-64 hex chars).
create function public.player_for(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h text; pid uuid;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{32,64}$' then raise exception 'bad key' using errcode = '22023'; end if;
  h := encode(extensions.digest(p_key, 'sha256'), 'hex');
  insert into public.players (key_hash) values (h) on conflict (key_hash) do nothing;
  select id into pid from public.players where key_hash = h;
  return pid;
end $$;
revoke execute on function public.player_for(text) from public, anon, authenticated;

create function public.set_name(p_key text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_clean_name(trim(p_name)) then raise exception 'Pick a different name.' using errcode = '23514'; end if;
  update public.players set name = trim(p_name) where id = public.player_for(p_key);
end $$;

create function public.submit_score(p_key text, p_score int, p_cases int, p_rank text, p_seconds int, p_veteran boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.player_for(p_key);
begin
  if (select name from public.players where id = pid) is null then raise exception 'Name needed first' using errcode = '22023'; end if;
  if exists (select 1 from public.scores where player_id = pid and created_at > now() - interval '20 seconds') then
    raise exception 'Too many submissions, try again shortly' using errcode = '54000';
  end if;
  insert into public.scores (player_id, score, cases_closed, rank, seconds, veteran) values (pid, p_score, p_cases, coalesce(p_rank, ''), p_seconds, coalesce(p_veteran, false));
  -- Place on the board among players' best scores.
  return 1 + (select count(*) from public.leaderboard l where l.veteran = coalesce(p_veteran, false) and l.score > p_score);
end $$;

create function public.log_run(p_key text, p_outcome text, p_case int, p_cause text, p_score int, p_caught int, p_spent int, p_items text[], p_seconds int, p_veteran boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.player_for(p_key);
begin
  if (select count(*) from public.runs where player_id = pid and created_at > now() - interval '1 hour') >= 60 then return; end if;
  insert into public.runs (player_id, outcome, case_index, cause, score, times_caught, spent, items, seconds, veteran)
  values (pid, p_outcome, p_case, coalesce(p_cause, ''), p_score, coalesce(p_caught, 0), coalesce(p_spent, 0), coalesce(p_items, '{}'), coalesce(p_seconds, 0), coalesce(p_veteran, false));
end $$;

create function public.push_save(p_key text, p_data jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.player_for(p_key); c text;
begin
  insert into public.saves (player_id, data) values (pid, p_data)
  on conflict (player_id) do update set data = excluded.data, updated_at = now()
  returning code into c;
  return c;
end $$;

create function public.pull_save(p_key text) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('data', s.data, 'code', s.code) from public.saves s where s.player_id = public.player_for(p_key);
$$;

-- Another device loads a save by its 12-character transfer code.
create function public.load_save_by_code(c text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select data from public.saves where code = upper(trim(c)) and char_length(trim(c)) = 12;
$$;

revoke execute on function public.set_name(text, text), public.submit_score(text, int, int, text, int, boolean), public.log_run(text, text, int, text, int, int, int, text[], int, boolean), public.push_save(text, jsonb), public.pull_save(text), public.load_save_by_code(text) from public;
grant execute on function public.set_name(text, text), public.submit_score(text, int, int, text, int, boolean), public.log_run(text, text, int, text, int, int, int, text[], int, boolean), public.push_save(text, jsonb), public.pull_save(text), public.load_save_by_code(text) to anon, authenticated;

-- ═════ Accounts (added later; run this block on its own on an existing project) ═════
-- Players can sign in (email or investigator ID + password). A signed-in player's rows follow the account
-- across devices. Guests keep using the device key. Nothing else in the schema changes.
alter table public.players add column if not exists user_id uuid unique references auth.users (id) on delete set null;

create or replace function public.player_for(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h text; pid uuid; uid uuid := auth.uid();
begin
  if uid is not null then
    select id into pid from public.players where user_id = uid;
    if pid is not null then return pid; end if;
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32,64}$' then raise exception 'bad key' using errcode = '22023'; end if;
  h := encode(extensions.digest(p_key, 'sha256'), 'hex');
  insert into public.players (key_hash) values (h) on conflict (key_hash) do nothing;
  select id into pid from public.players where key_hash = h;
  if uid is not null then
    -- First sign-in: this device's guest progress and scores move into the account.
    update public.players set user_id = uid where id = pid and user_id is null;
    if not found then
      insert into public.players (key_hash, user_id) values ('user:' || uid, uid) returning id into pid;
    end if;
  end if;
  return pid;
end $$;
revoke execute on function public.player_for(text) from public, anon, authenticated;

-- The signed-in (or guest) player's own summary for the home screen.
create or replace function public.my_stats(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.player_for(p_key);
begin
  return (select jsonb_build_object(
    'name', p.name,
    'best', (select max(score) from public.scores s where s.player_id = pid and not s.veteran),
    'best_veteran', (select max(score) from public.scores s where s.player_id = pid and s.veteran),
    'runs', (select count(*) from public.runs r where r.player_id = pid),
    'wins', (select count(*) from public.runs r where r.player_id = pid and r.outcome = 'won'),
    'saved_at', (select updated_at from public.saves v where v.player_id = pid))
  from public.players p where p.id = pid);
end $$;
revoke execute on function public.my_stats(text) from public;
grant execute on function public.my_stats(text) to anon, authenticated;

-- ═════ Every player has a name (run on its own on an existing project) ═════
-- New players get a codename until they choose one; existing nameless rows are filled in.
alter table public.players alter column name set default 'Agent ' || (1000 + floor(random() * 9000))::int;
update public.players set name = 'Agent ' || (1000 + floor(random() * 9000))::int where name is null;

-- ═════ Email column and self-service deletion (run on its own on an existing project) ═════
-- players.email mirrors the sign-in email of the linked account so it shows in the table editor.
-- It is not readable through the API: only (id, name) are granted to the game's roles.
alter table public.players add column if not exists email text;
update public.players p set email = u.email from auth.users u where u.id = p.user_id;

create or replace function public.player_for(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h text; pid uuid; uid uuid := auth.uid(); mail text;
begin
  if uid is not null then
    select id into pid from public.players where user_id = uid;
    if pid is not null then return pid; end if;
    select email into mail from auth.users where id = uid;
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{32,64}$' then raise exception 'bad key' using errcode = '22023'; end if;
  h := encode(extensions.digest(p_key, 'sha256'), 'hex');
  insert into public.players (key_hash) values (h) on conflict (key_hash) do nothing;
  select id into pid from public.players where key_hash = h;
  if uid is not null then
    update public.players set user_id = uid, email = mail where id = pid and user_id is null;
    if not found then
      insert into public.players (key_hash, user_id, email) values ('user:' || uid, uid, mail) returning id into pid;
    end if;
  end if;
  return pid;
end $$;
revoke execute on function public.player_for(text) from public, anon, authenticated;

-- Deletes the caller's player row (scores, run reports and cloud save go with it) and their account.
create or replace function public.delete_me(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  delete from public.players where id = public.player_for(p_key);
  if uid is not null then delete from auth.users where id = uid; end if;
end $$;
revoke execute on function public.delete_me(text) from public;
grant execute on function public.delete_me(text) to anon, authenticated;
