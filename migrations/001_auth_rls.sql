-- ════════════════════════════════════════════════════════════════════════════
-- KoCo — Migration 001 : authentification + règles d'accès par utilisateur
-- À exécuter UNE FOIS dans Supabase > SQL Editor, APRÈS le déploiement du code
-- de la branche secure/auth-rls (sinon l'ancienne app ne peut plus rien lire).
-- Idempotent : peut être relancé sans danger.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Table de quota journalier (utilisée par api/_lib/auth.js) ────────────
create table if not exists public.api_usage (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  endpoint   text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_user_endpoint_day
  on public.api_usage (user_id, endpoint, created_at);

-- ── 2. Supprimer les anciennes règles "tout le monde peut tout faire" ───────
drop policy if exists "Public all lesson_content"   on public.lesson_content;
drop policy if exists "Public all grand_themes"     on public.grand_themes;
drop policy if exists "Public all snu_units"        on public.snu_units;
drop policy if exists "Public all sessions"         on public.sessions;
drop policy if exists "Public all corrections"      on public.corrections;
drop policy if exists "Public all review_items"     on public.review_items;
drop policy if exists "Public all session_metrics"  on public.session_metrics;
drop policy if exists "Public all drill_sessions"   on public.drill_sessions;
drop policy if exists "Public all shadowing_sessions" on public.shadowing_sessions;
drop policy if exists "Public all staging"          on public.lesson_content_staging;
drop policy if exists "Public all koco_users"       on public.koco_users;
drop policy if exists "Public all local_entities"   on public.local_entities;
drop policy if exists "Public all campus_situations" on public.campus_situations;
drop policy if exists "Enable read access for all users" on public.gms_sentences;
drop policy if exists "Enable read access for all users" on public.sentence_mastery;

-- ── 3. Données personnelles : chaque utilisateur ne voit que les siennes ────
--    user_id est TEXT : on compare à auth.uid()::text
do $$
declare t text;
begin
  foreach t in array array[
    'lesson_content', 'sessions', 'corrections', 'review_items',
    'session_metrics', 'drill_sessions', 'shadowing_sessions',
    'lesson_content_staging', 'koco_users', 'sentence_mastery'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()::text)
         with check (user_id = auth.uid()::text)', t);
  end loop;
end $$;

-- api_usage : lecture + insertion de ses propres lignes, jamais de suppression
-- (sinon un utilisateur pourrait remettre son quota à zéro)
alter table public.api_usage enable row level security;
drop policy if exists "own usage read"   on public.api_usage;
drop policy if exists "own usage insert" on public.api_usage;
create policy "own usage read" on public.api_usage for select to authenticated
  using (user_id = auth.uid()::text);
create policy "own usage insert" on public.api_usage for insert to authenticated
  with check (user_id = auth.uid()::text);

-- ── 4. Contenu partagé : lecture seule pour les utilisateurs connectés ──────
--    (écriture uniquement depuis le tableau de bord / la clé service_role)
do $$
declare t text;
begin
  foreach t in array array[
    'gms_sentences', 'snu_units', 'grand_themes', 'local_entities', 'campus_situations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read for signed-in" on public.%I', t);
    execute format(
      'create policy "read for signed-in" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

commit;

-- Vérification : doit lister uniquement "own rows", "own usage …" et "read for signed-in"
-- pour les tables KoCo (les tables héritées users/levels/… gardent leurs règles auth.uid()).
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' order by tablename;
