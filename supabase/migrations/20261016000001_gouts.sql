-- Kaddie : les goûts de chacun (régimes, allergies, j'aime pas, j'adore).
-- Idempotent : peut être relancé sans risque.

create table if not exists public.profile_tastes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- clé du dictionnaire (src/lib/domain/foods.ts), ou « autre:… » pour le champ libre
  food       text not null check (char_length(food) between 1 and 80),
  level      text not null check (level in ('interdit', 'pas_fan', 'adore')),
  primary key (profile_id, food)
);

-- Questionnaire vu (« Plus tard » compris) / rempli
alter table public.profiles add column if not exists tastes_seen_at timestamptz;
alter table public.profiles add column if not exists tastes_done_at timestamptz;

-- Mode strict : ce qu'un membre n'aime pas disparaît pour toute la famille
alter table public.families add column if not exists strict_dislikes boolean not null default true;

alter table public.profile_tastes enable row level security;
revoke all on public.profile_tastes from anon, authenticated;
grant all on public.profile_tastes to service_role;
