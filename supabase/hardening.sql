-- The Redacted Donor: database hardening from the 2026-11-15 security audit.
-- NOT YET APPLIED to the live project. Run it once in the Supabase SQL editor (Dashboard → SQL → New query).
-- It changes no table shape and no function signature, so the shipped game works before and after.
-- Written from supabase/schema.sql; if the live functions differ from that file, compare before running.

-- 1. The rank on the board is worked out from the score. The client's p_rank is ignored, so it can no longer
--    carry free text (an advert, an insult) onto every player's leaderboard. Same thresholds as rankOf() in game.js.
create or replace function public.rank_for(p_score int) returns text
language sql immutable set search_path = '' as $$
  select case when p_score >= 2400 then 'Chief investigator' when p_score >= 1550 then 'Senior investigator' else 'Field investigator' end
$$;

create or replace function public.submit_score(p_key text, p_score int, p_cases int, p_rank text, p_seconds int, p_veteran boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.player_for(p_key);
begin
  if (select name from public.players where id = pid) is null then raise exception 'Name needed first' using errcode = '22023'; end if;
  if exists (select 1 from public.scores where player_id = pid and created_at > now() - interval '20 seconds') then
    raise exception 'Too many submissions, try again shortly' using errcode = '54000';
  end if;
  insert into public.scores (player_id, score, cases_closed, rank, seconds, veteran) values (pid, p_score, p_cases, public.rank_for(p_score), p_seconds, coalesce(p_veteran, false));
  -- Place on the board among players' best scores.
  return 1 + (select count(*) from public.leaderboard l where l.veteran = coalesce(p_veteran, false) and l.score > p_score);
end $$;

-- Rows already on the board get the computed rank too.
update public.scores set rank = public.rank_for(score) where rank is distinct from public.rank_for(score);

-- 2. A run report's item list holds short ids. Its count was capped at 20; this caps its total length as well,
--    so a script cannot store megabytes per row.
alter table public.runs add constraint items_short check (char_length(array_to_string(items, '')) <= 400);

-- 3. New players: at most 120 a minute across the whole project, so a script cannot fill the database with
--    throwaway keys. The game treats error 54000 as "try again later" and keeps the row in its outbox.
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
  if not exists (select 1 from public.players where key_hash = h)
     and (select count(*) from public.players where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'Busy, try again shortly' using errcode = '54000';
  end if;
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
