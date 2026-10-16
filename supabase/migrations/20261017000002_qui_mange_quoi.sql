-- Qui mange quoi :
-- 1. un plat des courses peut être prévu pour un nombre de personnes choisi à la main ;
-- 2. la majorité d'un match se compte parmi celles et ceux qui swipent (ces 14 derniers jours),
--    pas parmi tous les membres : quelqu'un qui ne participe pas ne bloque plus les matchs.
--    Il faut toujours au moins 2 likes dès que la famille compte 2 membres ou plus.

alter table trip_recipes add column if not exists people int check (people between 1 and 30);

create or replace view public.active_matches
with (security_invoker = true) as
with fresh as (
  select s.recipe_id, r.family_id, s.swiped_at,
         row_number() over (partition by s.recipe_id order by s.swiped_at desc) as rank
  from public.swipes s
  join public.profiles p on p.id = s.profile_id
  join public.recipes r on r.id = s.recipe_id and r.family_id = p.family_id
  where s.liked and s.swiped_at > now() - interval '14 days'
),
sizes as (
  select p.family_id,
         greatest(count(distinct s.profile_id) / 2 + 1, least(2, count(distinct p.id))) as needed
  from public.profiles p
  left join public.swipes s on s.profile_id = p.id and s.swiped_at > now() - interval '14 days'
  group by p.family_id
)
select
  f.recipe_id,
  max(f.swiped_at) as matched_at,
  max(f.swiped_at) filter (where f.rank = z.needed) + interval '14 days' as expires_at,
  f.family_id,
  count(*)::int as like_count
from fresh f
join sizes z on z.family_id = f.family_id
group by f.recipe_id, f.family_id, z.needed
having count(*) >= z.needed;

revoke all on public.active_matches from anon, authenticated;
grant select on public.active_matches to service_role;
