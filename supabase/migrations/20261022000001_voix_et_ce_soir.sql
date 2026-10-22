-- « Ta voix fait le match » (une relance au plus par jour et par personne, une seule fois par plat)
-- et « Autre idée » dans Ce soir (le plat écarté ne revient pas en premier pendant deux jours).
-- Ajouts seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

create table if not exists public.relances (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  envoyee_le  timestamptz not null default now(),
  primary key (profile_id, recipe_id)
);
create index if not exists relances_profil_idx on public.relances(profile_id, envoyee_le desc);

create table if not exists public.pas_ce_soir (
  family_id   uuid not null references public.families(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  jusqu_a     timestamptz not null,
  primary key (family_id, recipe_id)
);

alter table public.relances enable row level security;
alter table public.pas_ce_soir enable row level security;
revoke all on public.relances, public.pas_ce_soir from anon, authenticated;
grant all on public.relances, public.pas_ce_soir to service_role;

-- L'API voit tout de suite les nouvelles tables.
notify pgrst, 'reload schema';
