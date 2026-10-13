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

-- ─── Recettes de départ pour une nouvelle famille ────────────────────
create or replace function public.add_starter_recipes(p_family uuid) returns void
language plpgsql as $$
declare
  r jsonb;
  new_id uuid;
begin
  for r in select * from jsonb_array_elements('[{"title": "Blanquette de veau", "emoji": "🍲", "ingredients": [{"name": "Épaule de veau", "quantity": 1.2, "unit": "kg", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Champignons de Paris", "quantity": 250.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Crème fraîche", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 40.0, "unit": "g", "aisle": "cremerie"}, {"name": "Farine", "quantity": 40.0, "unit": "g", "aisle": "epicerie"}, {"name": "Citron", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Riz", "quantity": 400.0, "unit": "g", "aisle": "epicerie"}]}, {"title": "Hachis parmentier", "emoji": "🥔", "ingredients": [{"name": "Bœuf haché", "quantity": 600.0, "unit": "g", "aisle": "boucherie"}, {"name": "Pommes de terre", "quantity": 1.2, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Lait", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 50.0, "unit": "g", "aisle": "cremerie"}, {"name": "Gruyère râpé", "quantity": 100.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Gratin dauphinois", "emoji": "🧀", "ingredients": [{"name": "Pommes de terre", "quantity": 1.5, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Crème fraîche", "quantity": 40.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Lait", "quantity": 50.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Ail", "quantity": 2.0, "unit": "gousses", "aisle": "fruits_legumes"}, {"name": "Muscade", "quantity": null, "unit": "", "aisle": "epicerie"}]}, {"title": "Poulet rôti et pommes de terre", "emoji": "🍗", "ingredients": [{"name": "Poulet fermier", "quantity": 1.0, "unit": "", "aisle": "boucherie"}, {"name": "Pommes de terre", "quantity": 1.0, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Ail", "quantity": 1.0, "unit": "tête", "aisle": "fruits_legumes"}, {"name": "Thym", "quantity": 1.0, "unit": "bouquet", "aisle": "fruits_legumes"}, {"name": "Beurre", "quantity": 30.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Bœuf bourguignon", "emoji": "🍷", "ingredients": [{"name": "Bœuf à braiser", "quantity": 1.5, "unit": "kg", "aisle": "boucherie"}, {"name": "Vin rouge", "quantity": 75.0, "unit": "cl", "aisle": "boissons"}, {"name": "Lardons", "quantity": 200.0, "unit": "g", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Champignons de Paris", "quantity": 250.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Farine", "quantity": 30.0, "unit": "g", "aisle": "epicerie"}, {"name": "Bouquet garni", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Pâtes tagliatelles", "quantity": 500.0, "unit": "g", "aisle": "epicerie"}]}, {"title": "Quiche lorraine", "emoji": "🥧", "ingredients": [{"name": "Pâte brisée", "quantity": 1.0, "unit": "rouleau", "aisle": "cremerie"}, {"name": "Lardons", "quantity": 200.0, "unit": "g", "aisle": "boucherie"}, {"name": "Œufs", "quantity": 3.0, "unit": "", "aisle": "cremerie"}, {"name": "Crème fraîche", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Lait", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Gruyère râpé", "quantity": 80.0, "unit": "g", "aisle": "cremerie"}, {"name": "Salade verte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Lasagnes à la bolognaise", "emoji": "🍝", "ingredients": [{"name": "Feuilles de lasagne", "quantity": 500.0, "unit": "g", "aisle": "epicerie"}, {"name": "Bœuf haché", "quantity": 500.0, "unit": "g", "aisle": "boucherie"}, {"name": "Coulis de tomate", "quantity": 70.0, "unit": "cl", "aisle": "epicerie"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Carotte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Lait", "quantity": 1.0, "unit": "l", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 60.0, "unit": "g", "aisle": "cremerie"}, {"name": "Farine", "quantity": 60.0, "unit": "g", "aisle": "epicerie"}, {"name": "Gruyère râpé", "quantity": 150.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Pot-au-feu", "emoji": "🥕", "ingredients": [{"name": "Paleron de bœuf", "quantity": 1.5, "unit": "kg", "aisle": "boucherie"}, {"name": "Os à moelle", "quantity": 4.0, "unit": "", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 6.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Poireaux", "quantity": 3.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Navets", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Pommes de terre", "quantity": 800.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Bouquet garni", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Croque-monsieur et salade", "emoji": "🥪", "ingredients": [{"name": "Pain de mie", "quantity": 1.0, "unit": "paquet", "aisle": "boulangerie"}, {"name": "Jambon blanc", "quantity": 8.0, "unit": "tranches", "aisle": "boucherie"}, {"name": "Gruyère râpé", "quantity": 150.0, "unit": "g", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 50.0, "unit": "g", "aisle": "cremerie"}, {"name": "Salade verte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Ratatouille et riz", "emoji": "🍆", "ingredients": [{"name": "Aubergines", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Courgettes", "quantity": 3.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Poivrons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Tomates", "quantity": 6.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Ail", "quantity": 3.0, "unit": "gousses", "aisle": "fruits_legumes"}, {"name": "Huile d''olive", "quantity": null, "unit": "", "aisle": "epicerie"}, {"name": "Riz", "quantity": 400.0, "unit": "g", "aisle": "epicerie"}]}]'::jsonb) loop
    insert into public.recipes (family_id, title, emoji)
    values (p_family, r->>'title', r->>'emoji')
    returning id into new_id;

    insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
    select new_id, i.ord::int, i.item->>'name', (i.item->>'quantity')::numeric, i.item->>'unit', i.item->>'aisle'
    from jsonb_array_elements(r->'ingredients') with ordinality as i(item, ord);
  end loop;
end $$;

revoke all on function public.add_starter_recipes(uuid) from public, anon, authenticated;
grant execute on function public.add_starter_recipes(uuid) to service_role;
