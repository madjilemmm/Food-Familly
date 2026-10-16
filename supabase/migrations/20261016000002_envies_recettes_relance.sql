-- Kaddie : envies, recette complète, nombre de personnes, relance avant l'heure limite.
-- Idempotent : peut être relancé sans risque.

-- Envies de chacun : styles de plats, temps de cuisine, piquant
alter table public.profiles add column if not exists envies jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists envies_done_at timestamptz;

-- La recette complète (importée de Marmiton ou saisie)
alter table public.recipes add column if not exists servings int check (servings between 1 and 50);
alter table public.recipes add column if not exists total_minutes int check (total_minutes between 1 and 2880);
alter table public.recipes add column if not exists steps jsonb;

-- Les courses : pour combien de personnes, et relance déjà envoyée ?
alter table public.shopping_trips add column if not exists people int check (people between 1 and 30);
alter table public.shopping_trips add column if not exists reminded_at timestamptz;

-- Relance « plus que 10 minutes » : Supabase appelle l'appli chaque minute.
-- L'appel ne fait qu'envoyer les relances dues (une seule fois par course) : il n'a rien de secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'kaddie-relance';
select cron.schedule(
  'kaddie-relance',
  '* * * * *',
  $$ select net.http_post(url := 'https://food-familly.vercel.app/api/cron/relance', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$
);
