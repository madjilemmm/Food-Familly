-- Mesurer si la recherche de repas s'améliore (lecture seule : rien n'est modifié).
-- À lancer dans Supabase → SQL Editor, avant et après un changement de l'algorithme.

-- 1. Par semaine : nombre de swipes et part de « J'en veux ».
select date_trunc('week', swiped_at)::date as semaine,
       count(*) as swipes,
       round(100.0 * count(*) filter (where liked) / count(*)) as pct_oui
from swipes
group by 1 order by 1 desc limit 12;

-- 2. Par semaine : recettes importées de Marmiton, et part de celles qui ont reçu au moins un « oui ».
select date_trunc('week', r.created_at)::date as semaine,
       count(*) as importees,
       round(100.0 * count(*) filter (where exists (select 1 from swipes s where s.recipe_id = r.id and s.liked)) / count(*)) as pct_aimees
from recipes r
where r.source_url is not null
group by 1 order by 1 desc limit 12;

-- 3. Par semaine : plats où au moins 2 membres ont dit « oui » (des matchs possibles).
select date_trunc('week', d.premier_oui)::date as semaine, count(*) as plats_a_deux
from (
  select s.recipe_id, min(s.swiped_at) filter (where s.liked) as premier_oui
  from swipes s
  group by s.recipe_id
  having count(*) filter (where s.liked) >= 2
) d
group by 1 order by 1 desc limit 12;

-- ─────────────────────────────────────────────────────────────────────────────
-- Les 6 indicateurs du produit (lecture seule). À lancer chaque lundi.
-- Limite : l'activité se lit surtout dans les swipes ; une famille qui ne fait que cocher la liste y apparaît peu.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Activation : part des foyers créés (par semaine) qui ont un plat au Menu dans la première heure.
select date_trunc('week', f.created_at)::date as semaine,
       count(*) as foyers_crees,
       round(100.0 * count(*) filter (where exists (
         select 1 from shopping_trips t join trip_recipes tr on tr.trip_id = t.id and tr.selected
         where t.family_id = f.id and tr.created_at <= f.created_at + interval '1 hour')) / count(*)) as pct_menu_en_1h
from families f
group by 1 order by 1 desc limit 12;

-- B. Temps jusqu'à la première valeur : minutes entre la création du foyer et le premier article sur la liste (médiane, par semaine).
select date_trunc('week', f.created_at)::date as semaine,
       count(*) as foyers_avec_liste,
       round((percentile_cont(0.5) within group (order by extract(epoch from (p.premier - f.created_at)) / 60))::numeric, 1) as minutes_mediane
from families f
join lateral (
  select min(i.created_at) as premier
  from shopping_trips t join shopping_list_items i on i.trip_id = t.id
  where t.family_id = f.id
) p on p.premier is not null
group by 1 order by 1 desc limit 12;

-- C. Rétention : foyers créés il y a plus de 4 semaines encore actifs (au moins un swipe) entre les semaines 3 et 5.
select count(*) as foyers_ages_de_4_semaines,
       count(*) filter (where exists (
         select 1 from swipes s join profiles pr on pr.id = s.profile_id
         where pr.family_id = f.id and s.swiped_at between f.created_at + interval '21 days' and f.created_at + interval '35 days')) as encore_actifs,
       round(100.0 * count(*) filter (where exists (
         select 1 from swipes s join profiles pr on pr.id = s.profile_id
         where pr.family_id = f.id and s.swiped_at between f.created_at + interval '21 days' and f.created_at + interval '35 days')) / nullif(count(*), 0)) as pct
from families f
where f.created_at < now() - interval '28 days';

-- D. Fréquence : jours actifs (au moins un swipe) par semaine et par foyer, en moyenne.
select semaine, round(avg(jours), 1) as jours_actifs_moyens, count(*) as foyers_actifs
from (
  select date_trunc('week', s.swiped_at)::date as semaine, pr.family_id, count(distinct s.swiped_at::date) as jours
  from swipes s join profiles pr on pr.id = s.profile_id
  group by 1, 2
) x
group by 1 order by 1 desc limit 12;

-- E. Sessions collectives : plats à deux « oui » par foyer et par semaine (voir 3), et part des plats du Menu réellement cuisinés.
select count(*) filter (where tr.selected) as plats_au_menu_courses_finies,
       count(*) filter (where tr.selected and r.fait_le is not null) as plats_cuisines,
       round(100.0 * count(*) filter (where tr.selected and r.fait_le is not null) / nullif(count(*) filter (where tr.selected), 0)) as pct_cuisines
from shopping_trips t
join trip_recipes tr on tr.trip_id = t.id
left join repas r on r.trip_id = t.id and r.recipe_id = tr.recipe_id
where t.status = 'done';

-- F. Invitations : membres par foyer, membres actifs sur 7 jours, liens d'invitation créés par semaine.
select f.id as foyer,
       count(distinct pr.id) as membres,
       count(distinct pr.id) filter (where exists (select 1 from swipes s where s.profile_id = pr.id and s.swiped_at > now() - interval '7 days')) as membres_actifs_7j
from families f join profiles pr on pr.family_id = f.id
group by f.id order by membres desc limit 30;

select date_trunc('week', created_at)::date as semaine, count(*) as liens_crees
from invitations
group by 1 order by 1 desc limit 12;
