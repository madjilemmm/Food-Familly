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
