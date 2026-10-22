-- « À table ! » : la personne qui cuisine appelle, les autres répondent (« J'arrive », « 5 min »).
-- Ajouts seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

create table if not exists public.a_table (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  cuisinier   uuid references public.profiles(id) on delete set null,
  titre       text,
  -- L'heure du repas : maintenant, ou dans quelques minutes.
  a           timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists a_table_family_idx on public.a_table(family_id, created_at desc);

create table if not exists public.a_table_reponses (
  a_table_id  uuid not null references public.a_table(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  reponse     text not null check (reponse in ('arrive', 'retard')),
  at          timestamptz not null default now(),
  primary key (a_table_id, profile_id)
);

alter table public.a_table enable row level security;
alter table public.a_table_reponses enable row level security;
revoke all on public.a_table, public.a_table_reponses from anon, authenticated;
grant all on public.a_table, public.a_table_reponses to service_role;

-- L'API voit tout de suite les nouvelles tables.
notify pgrst, 'reload schema';
