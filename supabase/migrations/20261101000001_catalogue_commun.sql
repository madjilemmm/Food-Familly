-- Le catalogue commun : des recettes que Kaddie a le droit de proposer à toutes les familles (sources autorisées, licence connue).
-- Une recette n'y entre que complète : photo, au moins 3 ingrédients, au moins 2 étapes, origine et licences indiquées.
-- Chaque famille en reçoit des copies dans « recipes » (recipes.catalogue_id) : le reste de l'application ne change pas, et un plat refusé
-- reste en mémoire (il n'est jamais re-proposé).
-- Même sécurité que le reste : RLS activée sans policy, seule la clé secrète du serveur y accède.

create table if not exists public.catalogue_commun (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  source_id        text not null,
  titre            text not null check (char_length(titre) between 3 and 90),
  photo_url        text not null check (photo_url ~ '^https://[^/]+/.+'),
  photo_auteur     text,
  photo_licence    text not null,
  texte_licence    text not null,
  attribution_url  text not null check (attribution_url ~ '^https://'),
  attribution_texte text not null,
  minutes          integer check (minutes is null or minutes > 0),
  portions         integer check (portions is null or portions > 0),
  etapes           jsonb not null check (jsonb_typeof(etapes) = 'array' and jsonb_array_length(etapes) >= 2),
  ingredients      jsonb not null check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) >= 3),
  cuisine          text,
  langue           text not null default 'fr',
  -- false : la recette est chargée mais pas encore proposée (licence à confirmer, relecture en cours).
  publiable        boolean not null default false,
  cree_le          timestamptz not null default now(),
  unique (source, source_id)
);
alter table public.catalogue_commun enable row level security;

alter table public.recipes add column if not exists catalogue_id uuid references public.catalogue_commun(id) on delete set null;
-- Une recette du catalogue n'arrive qu'une fois dans une famille (deux écrans ouverts en même temps ne doublent rien).
create unique index if not exists recipes_famille_catalogue_idx on public.recipes(family_id, catalogue_id) where catalogue_id is not null;
