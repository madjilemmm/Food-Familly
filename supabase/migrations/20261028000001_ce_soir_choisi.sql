-- « Ce sera ça » : le plat que la famille a retenu pour ce soir (un par jour).
-- Ajout seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

create table if not exists public.ce_soir_choix (
  family_id   uuid not null references public.families(id) on delete cascade,
  jour        date not null,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  choisi_par  uuid references public.profiles(id) on delete set null,
  choisi_le   timestamptz not null default now(),
  primary key (family_id, jour)
);

alter table public.ce_soir_choix enable row level security;
revoke all on public.ce_soir_choix from anon, authenticated;
grant all on public.ce_soir_choix to service_role;

-- L'API voit tout de suite la nouvelle table.
notify pgrst, 'reload schema';
