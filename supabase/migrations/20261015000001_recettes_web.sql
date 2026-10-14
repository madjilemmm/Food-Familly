-- Kaddie : recettes importées automatiquement depuis Marmiton.
-- On retient seulement d'où vient chaque recette (pour ne pas l'importer deux fois
-- et pour faire le ménage). Idempotent : peut être relancé sans risque.
alter table public.recipes add column if not exists source_url text;
create unique index if not exists recipes_family_source_idx
  on public.recipes(family_id, source_url) where source_url is not null;
