-- ════════════════════════════════════════════════════════════════════
-- À table ! — famille de démonstration (FACULTATIF)
--
-- Inutile en temps normal : on crée sa famille directement dans l'appli
-- (« Créer ma famille »), qui ajoute aussi 10 recettes de départ.
-- Ce script crée une famille d'essai, code « demo-1234-test ».
-- À exécuter après les deux migrations.
-- ════════════════════════════════════════════════════════════════════

insert into public.families (id, name, join_code)
values ('20000000-0000-4000-8000-0000000000de', 'Famille démo', 'demo-1234-test')
on conflict (id) do nothing;

insert into public.profiles (id, family_id, name, style, emoji, sort_order) values
  ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000de', 'Karin',  'simple', '👩‍🍳', 0),
  ('00000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-0000000000de', 'Madji',  'fun',    '😎',  1),
  ('00000000-0000-4000-8000-0000000000d3', '20000000-0000-4000-8000-0000000000de', 'Yoalem', 'fun',    '🤙',  2)
on conflict (id) do nothing;

select public.add_starter_recipes('20000000-0000-4000-8000-0000000000de')
where not exists (select 1 from public.recipes where family_id = '20000000-0000-4000-8000-0000000000de');
