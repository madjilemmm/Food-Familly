-- ════════════════════════════════════════════════════════════════════
-- À table ! — plusieurs familles, tout le monde peut faire les courses
--
-- • families : chaque famille a son espace et son code pour la rejoindre.
-- • profiles.style : « simple » (gros boutons) ou « fun » (animé) ;
--   le rôle parent/enfant n'est plus utilisé.
-- • Un match = une recette likée par la majorité de la famille.
-- Les données existantes sont rattachées à une première famille.
-- Le script peut être relancé sans risque (par exemple s'il s'est arrêté
-- en cours de route).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  join_code   text not null unique check (join_code = lower(join_code) and length(join_code) >= 6),
  created_at  timestamptz not null default now()
);
alter table public.families enable row level security;
revoke all on public.families from anon, authenticated;
grant all on public.families to service_role;

-- Famille des données déjà présentes (son code est à définir ensuite :
-- update public.families set join_code = '...' where id = '20000000-0000-4000-8000-000000000001';)
insert into public.families (id, name, join_code)
select '20000000-0000-4000-8000-000000000001', 'Notre famille', 'a-changer-' || substr(md5(random()::text), 1, 12)
where exists (select 1 from public.profiles) or exists (select 1 from public.recipes)
on conflict (id) do nothing;

-- ─── Profils ─────────────────────────────────────────────────────────
alter table public.profiles add column if not exists family_id uuid references public.families(id) on delete cascade;
update public.profiles set family_id = '20000000-0000-4000-8000-000000000001' where family_id is null;
alter table public.profiles alter column family_id set not null;
create index if not exists profiles_family_idx on public.profiles(family_id, sort_order);

-- Le style initial reprend l'ancien rôle, une seule fois (à l'ajout de la colonne).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'style') then
    alter table public.profiles add column style text not null default 'fun' check (style in ('simple', 'fun'));
    update public.profiles set style = case when role = 'parent' then 'simple' else 'fun' end;
  end if;
end $$;
-- Conservé le temps de la mise en ligne, plus utilisé par l'appli.
alter table public.profiles alter column role drop not null;

-- ─── Recettes et courses ─────────────────────────────────────────────
alter table public.recipes add column if not exists family_id uuid references public.families(id) on delete cascade;
update public.recipes set family_id = '20000000-0000-4000-8000-000000000001' where family_id is null;
alter table public.recipes alter column family_id set not null;
create index if not exists recipes_family_idx on public.recipes(family_id, title);

alter table public.shopping_trips add column if not exists family_id uuid references public.families(id) on delete cascade;
update public.shopping_trips set family_id = '20000000-0000-4000-8000-000000000001' where family_id is null;
alter table public.shopping_trips alter column family_id set not null;
create index if not exists shopping_trips_family_idx on public.shopping_trips(family_id, created_at desc) where status <> 'done';

-- ─── Matchs : la majorité de la famille a liké (likes de moins de 14 j) ─
-- expires_at : quand le like le plus ancien parmi ceux qui forment la
-- majorité aura 14 jours.
create or replace view public.active_matches
with (security_invoker = true) as
with fresh as (
  select s.recipe_id, r.family_id, s.swiped_at,
         row_number() over (partition by s.recipe_id order by s.swiped_at desc) as rank
  from public.swipes s
  join public.profiles p on p.id = s.profile_id
  join public.recipes r on r.id = s.recipe_id and r.family_id = p.family_id
  where s.liked and s.swiped_at > now() - interval '14 days'
),
sizes as (
  select family_id, count(*) as members, count(*) / 2 + 1 as needed
  from public.profiles group by family_id
)
select
  f.recipe_id,
  max(f.swiped_at) as matched_at,
  max(f.swiped_at) filter (where f.rank = z.needed) + interval '14 days' as expires_at,
  f.family_id,
  count(*)::int as like_count
from fresh f
join sizes z on z.family_id = f.family_id
group by f.recipe_id, f.family_id, z.needed
having count(*) >= z.needed;

revoke all on public.active_matches from anon, authenticated;
grant select on public.active_matches to service_role;
