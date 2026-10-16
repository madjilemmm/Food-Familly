-- Goûts, envies et repas retenus (règles : src/lib/domain/reco.ts).
-- Ajouts seulement : aucune donnée supprimée ni transformée ; relançable sans risque.

-- La dernière fois qu'on a aimé un plat : un « Bof » plus tard ne l'efface pas
-- (on peut aimer un plat sans en avoir envie cette semaine).
alter table public.swipes add column if not exists liked_at timestamptz;
-- Les likes existants restent des goûts (datés de leur swipe) ; rien d'autre ne change.
update public.swipes set liked_at = swiped_at where liked and liked_at is null;

-- Qui mange vraiment un plat retenu pour une course (indépendant de qui l'aime d'habitude).
alter table public.trip_recipes add column if not exists eaters uuid[];
