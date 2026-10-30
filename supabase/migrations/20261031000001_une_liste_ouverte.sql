-- Une seule liste ouverte par famille.
-- Deux écrans qui s'ouvrent au même moment sur une famille sans liste en ouvraient chacun une : l'un retirait celle de l'autre pendant
-- qu'elle s'y remplissait, et un plat pouvait rester au Menu sans ses articles. Avec cet index, la base refuse la deuxième liste
-- ouverte (l'appli le sait : elle reprend alors celle qui existe). Peut être relancé sans risque.

do $$
begin
  -- Les listes ouvertes en double qui sont vides (aucun plat, aucun article, aucune demande) sont retirées : la plus ancienne reste.
  delete from public.shopping_trips t
   where t.status <> 'done'
     and exists (
       select 1 from public.shopping_trips u
        where u.family_id = t.family_id and u.status <> 'done' and (u.created_at, u.id) < (t.created_at, t.id)
     )
     and not exists (select 1 from public.trip_recipes r where r.trip_id = t.id)
     and not exists (select 1 from public.shopping_list_items i where i.trip_id = t.id)
     and not exists (select 1 from public.trip_requests q where q.trip_id = t.id);

  if exists (select 1 from public.shopping_trips where status <> 'done' group by family_id having count(*) > 1) then
    -- Des listes en double contiennent encore quelque chose : rien n'est supprimé, l'index n'est pas créé. L'appli fonctionne comme avant.
    raise notice 'Index non créé : des familles ont encore plusieurs listes ouvertes avec du contenu. Relancez ce fichier après avoir terminé ou vidé les doublons.';
  else
    create unique index if not exists shopping_trips_une_ouverte_idx on public.shopping_trips (family_id) where status <> 'done';
  end if;
end $$;

-- L'API voit tout de suite le changement.
notify pgrst, 'reload schema';
