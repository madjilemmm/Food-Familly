-- L'état de l'import de nouvelles recettes, par famille : un verrou partagé entre tous les serveurs (deux écrans ouverts, plusieurs téléphones,
-- plusieurs instances : un seul import à la fois), un délai avant le prochain essai qui s'allonge quand l'import ne trouve rien, et la mémoire
-- des recherches qui n'ont rien donné. Même sécurité que le reste : RLS activée sans policy.
create table if not exists public.import_decouverte (
  family_id        uuid primary key references public.families(id) on delete cascade,
  verrou_jusqu     timestamptz,
  -- Qui détient le verrou : celui qui le prend écrit son jeton, puis relit pour vérifier que c'est bien le sien.
  verrou_jeton     text,
  prochain_essai   timestamptz,
  dernier_essai    timestamptz,
  dernier_resultat text check (dernier_resultat in ('ajoutees', 'rien', 'erreur')),
  essais_vides     integer not null default 0,
  ajoutees_total   integer not null default 0,
  termes_vides     jsonb not null default '{}'::jsonb
);
alter table public.import_decouverte enable row level security;
