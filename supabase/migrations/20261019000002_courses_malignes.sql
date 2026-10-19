-- Courses plus malignes : ce que la famille apprend à Kaddie sur ses articles.
-- Ajouts seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

-- « Kinder » veut dire Kinder Bueno chez nous ; « nutela » doit rester tel quel…
-- Écrit uniquement sur un geste (choix d'une pastille, « Annuler » une correction).
create table if not exists public.produits_appris (
  family_id   uuid not null references public.families(id) on delete cascade,
  saisie      text not null,
  nom         text,
  rayon       text,
  produit     text,
  tel_quel    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (family_id, saisie)
);

alter table public.produits_appris enable row level security;
revoke all on public.produits_appris from anon, authenticated;
grant all on public.produits_appris to service_role;

-- Les courses vraiment faites : posé uniquement par « J'ai fini les courses »
-- (une course fermée d'office au lancement de la suivante n'en a pas).
alter table public.shopping_trips add column if not exists finished_at timestamptz;

-- L'identité de chaque article (« PQ » et « Papier toilette » : la même), et d'où il vient
-- quand Kaddie l'a proposé : un achat habituel, ou pas pris la dernière fois.
alter table public.shopping_list_items add column if not exists cle text;
alter table public.shopping_list_items add column if not exists origine text;
alter table public.shopping_list_items drop constraint if exists shopping_list_items_origine_check;
alter table public.shopping_list_items add constraint shopping_list_items_origine_check
  check (origine is null or origine in ('habituel', 'reporte'));

-- Jamais deux fois le même produit ajouté à la main (ou proposé) sur une même liste,
-- même si deux téléphones l'ajoutent à la même milliseconde. Les articles déjà là
-- (sans clé) ne sont pas concernés.
create unique index if not exists shopping_list_items_produit_idx
  on public.shopping_list_items(trip_id, cle) where cle is not null and source in ('manual', 'request');
-- Les ingrédients des recettes : une ligne par produit et par unité (deux recalculs simultanés
-- de la liste ne doublent rien).
create unique index if not exists shopping_list_items_ingredient_idx
  on public.shopping_list_items(trip_id, cle, unit) where cle is not null and source = 'recipe';

-- Les réponses aux propositions : « pas besoin » (×), ou proposée sans réponse.
create table if not exists public.suggestions_reponses (
  trip_id     uuid not null references public.shopping_trips(id) on delete cascade,
  cle         text not null,
  reponse     text not null check (reponse in ('pas_besoin', 'sans_reponse')),
  created_at  timestamptz not null default now(),
  primary key (trip_id, cle)
);
alter table public.suggestions_reponses enable row level security;
revoke all on public.suggestions_reponses from anon, authenticated;
grant all on public.suggestions_reponses to service_role;

-- Ajouter des articles en ignorant ceux déjà là (même identifiant ou même produit).
create or replace function public.ajouter_articles(lignes jsonb) returns void
language sql security invoker as $$
  insert into public.shopping_list_items (id, trip_id, name, quantity, unit, aisle, source, for_recipes, checked, cle, origine)
  select coalesce((l->>'id')::uuid, gen_random_uuid()), (l->>'trip_id')::uuid, l->>'name', (l->>'quantity')::numeric,
         coalesce(l->>'unit', ''), coalesce(l->>'aisle', 'autre'), l->>'source', l->>'for_recipes',
         coalesce((l->>'checked')::boolean, false), l->>'cle', l->>'origine'
  from jsonb_array_elements(lignes) as l
  on conflict do nothing;
$$;
revoke all on function public.ajouter_articles(jsonb) from public, anon, authenticated;
grant execute on function public.ajouter_articles(jsonb) to service_role;

-- L'API voit tout de suite la nouvelle fonction.
notify pgrst, 'reload schema';
