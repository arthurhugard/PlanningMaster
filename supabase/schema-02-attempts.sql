-- ============================================================
--  PlanningMaster, migration 02 : historique des tentatives
--
--  La table scores ne garde que le meilleur résultat par épreuve,
--  ce qui suffit aux classements mais ne permet aucune courbe de
--  progression. Cette table-ci est en ajout seul : une ligne par
--  tentative validée, jamais modifiée.
--
--  À coller dans SQL Editor > New query, puis "Run".
--  Idempotent, comme la première.
-- ============================================================

create table if not exists public.attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  mode        text not null check (mode in ('level','seed','season')),
  ref         text not null check (char_length(ref) between 1 and 40),
  score       int  not null check (score between 0 and 100),
  payroll     int  check (payroll >= 0),
  treasury    int,
  created_at  timestamptz not null default now()
);

comment on table public.attempts is
  'Une ligne par tentative validée. Sert aux courbes de progression, pas aux classements.';

-- L''historique se lit toujours par joueur et par date.
create index if not exists attempts_user_idx
  on public.attempts (user_id, created_at desc);

-- Utile pour compter combien de personnes ont joué le défi du jour.
create index if not exists attempts_ref_idx
  on public.attempts (mode, ref, created_at desc);

alter table public.attempts enable row level security;

-- Chacun ne voit que ses propres tentatives. Aucune écriture cliente :
-- comme pour scores, seule l''Edge Function écrit, avec la clé service_role.
drop policy if exists "mes tentatives" on public.attempts;
create policy "mes tentatives"
  on public.attempts for select to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
--  Nombre de participants au défi du jour, sans exposer qui.
--  security definer : contourne la RLS ci-dessus pour ne renvoyer
--  qu'un compte agrégé, jamais une ligne nominative.
-- ------------------------------------------------------------
create or replace function public.players_on(p_mode text, p_ref text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(distinct user_id)::int
  from public.attempts
  where mode = p_mode and ref = p_ref;
$$;

grant execute on function public.players_on(text, text) to anon, authenticated;
