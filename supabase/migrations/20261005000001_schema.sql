-- ════════════════════════════════════════════════════════════════════
-- À table ! — schéma de base
-- Toutes les lectures/écritures passent par le serveur Next.js avec la clé
-- secrète. La RLS est activée SANS aucune policy : la clé publique (anon)
-- ne peut rien lire ni écrire.
-- ════════════════════════════════════════════════════════════════════

-- ─── Profils ─────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  role        text not null check (role in ('parent', 'child')),
  emoji       text not null default '🙂',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Recettes ────────────────────────────────────────────────────────
create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  emoji       text not null default '🍽️',
  photo_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  position    int  not null default 0,
  name        text not null check (length(trim(name)) > 0),
  quantity    numeric check (quantity is null or quantity > 0),
  unit        text not null default '',
  aisle       text not null default 'autre' check (aisle in (
                'fruits_legumes', 'boucherie', 'poissonnerie', 'cremerie', 'boulangerie',
                'epicerie', 'surgeles', 'boissons', 'hygiene', 'autre'))
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, position);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- ─── Swipes ──────────────────────────────────────────────────────────
-- Un seul swipe par (profil, recette) : re-swiper une recette revenue dans
-- le paquet écrase l'ancien swipe et remet sa date à jour.
create table public.swipes (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id)  on delete cascade,
  liked       boolean not null,
  swiped_at   timestamptz not null default now(),
  primary key (profile_id, recipe_id)
);
create index swipes_recipe_idx on public.swipes(recipe_id) where liked;

-- ─── Matchs ──────────────────────────────────────────────────────────
-- Une recette est un match quand TOUS les profils "enfant" l'ont likée il y a
-- moins de 14 jours. Le match expire 14 jours après le plus ancien des likes.
create view public.active_matches
with (security_invoker = true) as
select
  s.recipe_id,
  max(s.swiped_at)                       as matched_at,
  min(s.swiped_at) + interval '14 days'  as expires_at
from public.swipes s
join public.profiles p on p.id = s.profile_id and p.role = 'child'
where s.liked
  and s.swiped_at > now() - interval '14 days'
group by s.recipe_id
having count(distinct s.profile_id) = (select count(*) from public.profiles where role = 'child')
   and count(distinct s.profile_id) > 0;

-- ─── Sessions de courses ─────────────────────────────────────────────
-- open      : maman a annoncé son départ, les fils peuvent répondre
-- validated : maman a choisi les plats, la liste est générée
-- done      : courses terminées (ou remplacées par une nouvelle session)
create table public.shopping_trips (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references public.profiles(id) on delete set null,
  departs_at    timestamptz not null default now(),
  deadline_at   timestamptz not null,
  status        text not null default 'open' check (status in ('open', 'validated', 'done')),
  validated_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index shopping_trips_current_idx on public.shopping_trips(created_at desc) where status <> 'done';

-- Réponse d'un fils pour une session : texte libre et/ou recettes choisies.
-- Une seule réponse par fils et par session, qu'il peut compléter.
create table public.trip_requests (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.shopping_trips(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  free_text   text,
  recipe_ids  uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (trip_id, profile_id)
);

create trigger trip_requests_touch before update on public.trip_requests
  for each row execute function public.touch_updated_at();

-- Recettes retenues (ou décochées) par maman pour une session.
create table public.trip_recipes (
  trip_id     uuid not null references public.shopping_trips(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  selected    boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (trip_id, recipe_id)
);

-- ─── Liste de courses ────────────────────────────────────────────────
create table public.shopping_list_items (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.shopping_trips(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  quantity     numeric,
  unit         text not null default '',
  aisle        text not null default 'autre',
  -- recipe : généré depuis les recettes ; manual : ajouté par maman ;
  -- request : demande texte d'un fils ajoutée à la liste
  source       text not null default 'manual' check (source in ('recipe', 'manual', 'request')),
  for_recipes  text,
  checked      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index shopping_list_items_trip_idx on public.shopping_list_items(trip_id);

-- ─── Notifications push ──────────────────────────────────────────────
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions(profile_id);

-- ─── Sécurité : RLS activée, aucune policy ───────────────────────────
alter table public.profiles            enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.swipes              enable row level security;
alter table public.shopping_trips      enable row level security;
alter table public.trip_requests       enable row level security;
alter table public.trip_recipes        enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.push_subscriptions  enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on public.active_matches from anon, authenticated;

-- Le serveur (clé secrète = rôle service_role) a besoin d'un accès explicite :
-- les projets Supabase récents n'exposent plus les nouvelles tables par défaut.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ─── Stockage des photos ─────────────────────────────────────────────
-- Bucket public en lecture (URL difficile à deviner), écriture réservée au
-- serveur (clé secrète).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
