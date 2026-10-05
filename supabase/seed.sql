-- ════════════════════════════════════════════════════════════════════
-- À table ! — données de départ
-- Les 3 profils de la famille et 10 recettes françaises classiques à
-- remplacer par les plats de Karin (depuis l'appli : onglet Recettes).
-- Le script peut être relancé : il ne crée pas de doublons.
-- ════════════════════════════════════════════════════════════════════

insert into public.profiles (id, name, role, emoji, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Karin',  'parent', '👩‍🍳', 0),
  ('00000000-0000-4000-8000-000000000002', 'Madji',  'child',  '😎',  1),
  ('00000000-0000-4000-8000-000000000003', 'Yoalem', 'child',  '🤙',  2)
on conflict (id) do update set name = excluded.name, role = excluded.role,
  emoji = excluded.emoji, sort_order = excluded.sort_order;

-- Recettes : (id, titre, emoji)
insert into public.recipes (id, title, emoji) values
  ('10000000-0000-4000-8000-000000000001', 'Blanquette de veau',           '🍲'),
  ('10000000-0000-4000-8000-000000000002', 'Hachis parmentier',            '🥔'),
  ('10000000-0000-4000-8000-000000000003', 'Gratin dauphinois',            '🧀'),
  ('10000000-0000-4000-8000-000000000004', 'Poulet rôti et pommes de terre','🍗'),
  ('10000000-0000-4000-8000-000000000005', 'Bœuf bourguignon',             '🍷'),
  ('10000000-0000-4000-8000-000000000006', 'Quiche lorraine',              '🥧'),
  ('10000000-0000-4000-8000-000000000007', 'Lasagnes à la bolognaise',     '🍝'),
  ('10000000-0000-4000-8000-000000000008', 'Pot-au-feu',                   '🥕'),
  ('10000000-0000-4000-8000-000000000009', 'Croque-monsieur et salade',    '🥪'),
  ('10000000-0000-4000-8000-000000000010', 'Ratatouille et riz',           '🍆')
on conflict (id) do nothing;

-- Ingrédients (pour 4 à 5 personnes). On ne les insère que pour les
-- recettes qui n'en ont pas encore, pour ne pas écraser vos modifications.
with data (recipe_id, position, name, quantity, unit, aisle) as (values
  -- Blanquette de veau
  ('10000000-0000-4000-8000-000000000001'::uuid, 1, 'Épaule de veau',        1.2,  'kg',     'boucherie'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 2, 'Carottes',              4,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 3, 'Oignon',                1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 4, 'Champignons de Paris',  250,  'g',      'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 5, 'Crème fraîche',         20,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 6, 'Beurre',                40,   'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 7, 'Farine',                40,   'g',      'epicerie'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 8, 'Citron',                1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000001'::uuid, 9, 'Riz',                   400,  'g',      'epicerie'),
  -- Hachis parmentier
  ('10000000-0000-4000-8000-000000000002'::uuid, 1, 'Bœuf haché',            600,  'g',      'boucherie'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 2, 'Pommes de terre',       1.2,  'kg',     'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 3, 'Oignons',               2,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 4, 'Lait',                  20,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 5, 'Beurre',                50,   'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 6, 'Gruyère râpé',          100,  'g',      'cremerie'),
  -- Gratin dauphinois
  ('10000000-0000-4000-8000-000000000003'::uuid, 1, 'Pommes de terre',       1.5,  'kg',     'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 2, 'Crème fraîche',         40,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 3, 'Lait',                  50,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 4, 'Ail',                   2,    'gousses','fruits_legumes'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 5, 'Muscade',               null, '',       'epicerie'),
  -- Poulet rôti
  ('10000000-0000-4000-8000-000000000004'::uuid, 1, 'Poulet fermier',        1,    '',       'boucherie'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 2, 'Pommes de terre',       1,    'kg',     'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 3, 'Ail',                   1,    'tête',   'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 4, 'Thym',                  1,    'bouquet','fruits_legumes'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 5, 'Beurre',                30,   'g',      'cremerie'),
  -- Bœuf bourguignon
  ('10000000-0000-4000-8000-000000000005'::uuid, 1, 'Bœuf à braiser',        1.5,  'kg',     'boucherie'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 2, 'Vin rouge',             75,   'cl',     'boissons'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 3, 'Lardons',               200,  'g',      'boucherie'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 4, 'Carottes',              4,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 5, 'Oignons',               2,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 6, 'Champignons de Paris',  250,  'g',      'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 7, 'Farine',                30,   'g',      'epicerie'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 8, 'Bouquet garni',         1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 9, 'Pâtes tagliatelles',    500,  'g',      'epicerie'),
  -- Quiche lorraine
  ('10000000-0000-4000-8000-000000000006'::uuid, 1, 'Pâte brisée',           1,    'rouleau','cremerie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 2, 'Lardons',               200,  'g',      'boucherie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 3, 'Œufs',                  3,    '',       'cremerie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 4, 'Crème fraîche',         20,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 5, 'Lait',                  20,   'cl',     'cremerie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 6, 'Gruyère râpé',          80,   'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 7, 'Salade verte',          1,    '',       'fruits_legumes'),
  -- Lasagnes
  ('10000000-0000-4000-8000-000000000007'::uuid, 1, 'Feuilles de lasagne',   500,  'g',      'epicerie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 2, 'Bœuf haché',            500,  'g',      'boucherie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 3, 'Coulis de tomate',      70,   'cl',     'epicerie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 4, 'Oignon',                1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 5, 'Carotte',               1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 6, 'Lait',                  1,    'l',      'cremerie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 7, 'Beurre',                60,   'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 8, 'Farine',                60,   'g',      'epicerie'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 9, 'Gruyère râpé',          150,  'g',      'cremerie'),
  -- Pot-au-feu
  ('10000000-0000-4000-8000-000000000008'::uuid, 1, 'Paleron de bœuf',       1.5,  'kg',     'boucherie'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 2, 'Os à moelle',           4,    '',       'boucherie'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 3, 'Carottes',              6,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 4, 'Poireaux',              3,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 5, 'Navets',                4,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 6, 'Pommes de terre',       800,  'g',      'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 7, 'Oignon',                1,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 8, 'Bouquet garni',         1,    '',       'fruits_legumes'),
  -- Croque-monsieur
  ('10000000-0000-4000-8000-000000000009'::uuid, 1, 'Pain de mie',           1,    'paquet', 'boulangerie'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 2, 'Jambon blanc',          8,    'tranches','boucherie'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 3, 'Gruyère râpé',          150,  'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 4, 'Beurre',                50,   'g',      'cremerie'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 5, 'Salade verte',          1,    '',       'fruits_legumes'),
  -- Ratatouille
  ('10000000-0000-4000-8000-000000000010'::uuid, 1, 'Aubergines',            2,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 2, 'Courgettes',            3,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 3, 'Poivrons',              2,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 4, 'Tomates',               6,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 5, 'Oignons',               2,    '',       'fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 6, 'Ail',                   3,    'gousses','fruits_legumes'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 7, 'Huile d''olive',        null, '',       'epicerie'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 8, 'Riz',                   400,  'g',      'epicerie')
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select d.recipe_id, d.position, d.name, d.quantity, d.unit, d.aisle
from data d
where not exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = d.recipe_id);
