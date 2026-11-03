-- ════════════════════════════════════════════════════════════════════════════
-- KoCo — Migration 002 : rattacher l'historique d'avant l'authentification
-- (user_id du type "user_1776…") au compte Supabase Auth de Stéphane.
-- À exécuter UNE FOIS, après ta première connexion dans la nouvelle version.
-- ════════════════════════════════════════════════════════════════════════════

-- ÉTAPE A — repérer l'ancien identifiant (celui qui a le plus de lignes)
select user_id, count(*) as nb from (
  select user_id from public.sessions
  union all select user_id from public.corrections
  union all select user_id from public.review_items
  union all select user_id from public.lesson_content
) t group by user_id order by nb desc;

-- ÉTAPE B — repérer ton nouvel identifiant (UUID du compte Auth)
select id, email, last_sign_in_at from auth.users order by created_at;

-- ÉTAPE C — remplacer les deux valeurs ci-dessous, puis exécuter ce bloc seul
begin;
do $$
declare
  old_id text := 'user_REMPLACER_PAR_ANCIEN_ID';
  new_id text := 'REMPLACER-PAR-UUID-AUTH';
  t text;
  n int;
begin
  if old_id like '%REMPLACER%' or new_id like '%REMPLACER%' then
    raise exception 'Remplace old_id et new_id avant d''exécuter.';
  end if;
  foreach t in array array[
    'lesson_content', 'sessions', 'corrections', 'review_items',
    'session_metrics', 'drill_sessions', 'shadowing_sessions',
    'lesson_content_staging', 'sentence_mastery'
  ] loop
    execute format('update public.%I set user_id = $1 where user_id = $2', t)
      using new_id, old_id;
    get diagnostics n = row_count;
    raise notice '% : % ligne(s) migrée(s)', t, n;
  end loop;
end $$;
commit;
