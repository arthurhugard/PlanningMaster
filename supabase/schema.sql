-- ============================================================
--  Planning Coup de Feu — schéma Supabase
--  À coller dans SQL Editor > New query, puis "Run".
--  Idempotent : ré-exécutable sans casse.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profils publics
--    Le pseudo est la seule chose affichée dans les classements.
--    L'e-mail reste dans auth.users, jamais exposé.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  pseudo      text unique not null
                check (char_length(pseudo) between 2 and 24
                       and pseudo ~ '^[A-Za-z0-9 _.-]+$'),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Pseudo public associé à un compte. Créé à l''inscription.';

-- ------------------------------------------------------------
-- 2. Scores vérifiés
--    Écrits UNIQUEMENT par l'Edge Function (service_role).
--    Le client n'a aucun droit d'insertion : c'est ce qui empêche
--    d'envoyer un 100/100 depuis la console du navigateur.
--
--    mode  : 'level'  -> ref = 'l1'..'l5'
--            'seed'   -> ref = 'ABCDE:3'  (graine:difficulté)
--            'season' -> ref = 'season'
--    grid  : la ou les grilles soumises, conservées pour audit
--            et pour rejouer une partie contestée.
-- ------------------------------------------------------------
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  mode        text not null check (mode in ('level','seed','season')),
  ref         text not null check (char_length(ref) between 1 and 40),
  score       int  not null check (score between 0 and 100),
  payroll     int  check (payroll >= 0),
  treasury    int,
  grid        jsonb not null,
  created_at  timestamptz not null default now(),
  unique (user_id, mode, ref)
);

comment on table public.scores is
  'Scores recalculés côté serveur. Une ligne par joueur et par épreuve, on garde le meilleur.';

create index if not exists scores_leaderboard_idx
  on public.scores (mode, ref, score desc, created_at asc);

-- ------------------------------------------------------------
-- 3. Progression personnelle
--    Étoiles, saison en cours, préférences. Synchronisée entre
--    appareils. Le client écrit librement ici : ces données
--    n'entrent dans aucun classement, donc rien à tricher.
-- ------------------------------------------------------------
create table if not exists public.progress (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;
alter table public.progress enable row level security;

-- profils : lisibles par tous (affichage des classements),
--           modifiables seulement par leur propriétaire
drop policy if exists "profils lisibles par tous" on public.profiles;
create policy "profils lisibles par tous"
  on public.profiles for select using (true);

drop policy if exists "je cree mon profil" on public.profiles;
create policy "je cree mon profil"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "je modifie mon profil" on public.profiles;
create policy "je modifie mon profil"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- scores : lecture publique, AUCUNE écriture cliente.
-- L'Edge Function utilise la clé service_role, qui contourne RLS.
drop policy if exists "scores lisibles par tous" on public.scores;
create policy "scores lisibles par tous"
  on public.scores for select using (true);
-- (volontairement : pas de policy insert/update/delete)

-- progression : strictement privée
drop policy if exists "ma progression" on public.progress;
create policy "ma progression"
  on public.progress for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. Vue classement
--    Joint le pseudo au score. security_invoker : les RLS
--    ci-dessus s'appliquent normalement à travers la vue.
-- ------------------------------------------------------------
create or replace view public.leaderboard
  with (security_invoker = true) as
select
  s.mode,
  s.ref,
  s.score,
  s.payroll,
  s.treasury,
  s.created_at,
  p.pseudo,
  rank() over (partition by s.mode, s.ref
               order by s.score desc, s.created_at asc) as position
from public.scores s
join public.profiles p on p.id = s.user_id;

-- ------------------------------------------------------------
-- 6. Création automatique du profil à l'inscription
--    Le pseudo est passé dans les métadonnées à signUp().
--    En cas de collision on suffixe, plutôt que de faire
--    échouer l'inscription.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  final  text;
  n      int := 0;
begin
  base := coalesce(
            nullif(trim(new.raw_user_meta_data->>'pseudo'), ''),
            split_part(new.email, '@', 1));
  base := regexp_replace(base, '[^A-Za-z0-9 _.-]', '', 'g');
  base := left(nullif(base, ''), 20);
  if base is null or char_length(base) < 2 then
    base := 'Joueur';
  end if;

  final := base;
  while exists (select 1 from public.profiles where pseudo = final) loop
    n := n + 1;
    final := left(base, 20) || n::text;
  end loop;

  insert into public.profiles (id, pseudo) values (new.id, final);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 7. Garde-fou anti-spam
--    Empêche un client de marteler l'Edge Function.
--    Appelée par la fonction avant d'écrire.
-- ------------------------------------------------------------
create or replace function public.can_submit(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) < 30
  from public.scores
  where user_id = uid
    and created_at > now() - interval '1 minute';
$$;
