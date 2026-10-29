-- Première expérience : le nombre de personnes à table, et des compteurs d'étapes anonymes.
-- Ajout seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

-- Le foyer : combien mangent à table d'habitude (les quantités de la liste et du mode cuisine en partent).
alter table public.families add column if not exists foyer integer check (foyer between 1 and 12);

-- Combien de fois chaque étape du début est atteinte, par jour. Aucun identifiant, aucune personne, aucune famille.
create table if not exists public.parcours_etapes (
  jour  date not null,
  etape text not null,
  n     integer not null default 0,
  primary key (jour, etape)
);
alter table public.parcours_etapes enable row level security;
revoke all on public.parcours_etapes from anon, authenticated;
grant all on public.parcours_etapes to service_role;

create or replace function public.noter_etape(p_etape text) returns void
language sql security definer set search_path = public as $$
  insert into public.parcours_etapes (jour, etape, n)
  values ((now() at time zone 'Europe/Paris')::date, p_etape, 1)
  on conflict (jour, etape) do update set n = public.parcours_etapes.n + 1
$$;
revoke all on function public.noter_etape(text) from public, anon, authenticated;
grant execute on function public.noter_etape(text) to service_role;

-- L'API voit tout de suite la nouvelle colonne et la nouvelle table.
notify pgrst, 'reload schema';
