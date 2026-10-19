-- Après les courses : les repas qu'on cuisine, et les mercis à celle ou celui qui les a faites.
-- Ajouts seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

-- « Ce soir, on mange quoi ? » : les plats achetés déjà cuisinés (« C'est fait »).
create table if not exists public.repas (
  trip_id     uuid not null references public.shopping_trips(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  fait_le     timestamptz,
  primary key (trip_id, recipe_id)
);

-- « Dire merci » à la personne qui a fait les courses : un cœur par personne et par course.
create table if not exists public.mercis (
  trip_id     uuid not null references public.shopping_trips(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (trip_id, profile_id)
);

alter table public.repas enable row level security;
alter table public.mercis enable row level security;
revoke all on public.repas, public.mercis from anon, authenticated;
grant all on public.repas, public.mercis to service_role;

-- L'API voit tout de suite les nouvelles tables.
notify pgrst, 'reload schema';
