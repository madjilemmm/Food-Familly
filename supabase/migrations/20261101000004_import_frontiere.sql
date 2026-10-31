-- La frontière d'exploration de l'import, par famille : les adresses de recettes découvertes (sur les pages déjà lues) et ce qu'on en a décidé.
-- Sans elle, chaque import oubliait ce qu'il avait déjà essayé (les fiches refusées étaient relues à chaque fois) et ne partait que de quelques
-- recettes. Avec elle : une file de nouveautés qui grandit toute seule, jamais de page relue pour rien.
-- Même sécurité que le reste : RLS activée sans policy.
create table if not exists public.import_frontiere (
  family_id uuid not null references public.families(id) on delete cascade,
  url       text not null,
  etat      text not null default 'a_voir' check (etat in ('a_voir', 'rejete', 'retenu')),
  -- Les voisines de cette page ont été lues et ajoutées à la file.
  explore   boolean not null default false,
  -- Combien de fois la page n'a pas pu être lue (on abandonne après deux).
  essais    integer not null default 0,
  trouve_le timestamptz not null default now(),
  primary key (family_id, url)
);
create index if not exists import_frontiere_etat on public.import_frontiere (family_id, etat);
alter table public.import_frontiere enable row level security;
