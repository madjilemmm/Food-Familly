-- ════════════════════════════════════════════════════════════════════
-- À table ! — famille de démonstration (FACULTATIF)
--
-- Inutile en temps normal : on crée sa famille directement dans l'appli
-- (« Créer ma famille »), qui ajoute aussi 10 recettes de départ.
-- Ce script crée une famille d'essai, code « demo-1234-test ».
-- À exécuter après les deux migrations.
-- ════════════════════════════════════════════════════════════════════

-- Recettes de départ (dans l'appli, elles viennent de src/lib/starter-recipes.ts)
create or replace function public.add_starter_recipes(p_family uuid) returns void
language plpgsql as $$
declare
  r jsonb;
  new_id uuid;
begin
  for r in select * from jsonb_array_elements('[{"title": "Blanquette de veau", "emoji": "🍲", "ingredients": [{"name": "Épaule de veau", "quantity": 1.2, "unit": "kg", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Champignons de Paris", "quantity": 250.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Crème fraîche", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 40.0, "unit": "g", "aisle": "cremerie"}, {"name": "Farine", "quantity": 40.0, "unit": "g", "aisle": "epicerie"}, {"name": "Citron", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Riz", "quantity": 400.0, "unit": "g", "aisle": "epicerie"}]}, {"title": "Hachis parmentier", "emoji": "🥔", "ingredients": [{"name": "Bœuf haché", "quantity": 600.0, "unit": "g", "aisle": "boucherie"}, {"name": "Pommes de terre", "quantity": 1.2, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Lait", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 50.0, "unit": "g", "aisle": "cremerie"}, {"name": "Gruyère râpé", "quantity": 100.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Gratin dauphinois", "emoji": "🧀", "ingredients": [{"name": "Pommes de terre", "quantity": 1.5, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Crème fraîche", "quantity": 40.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Lait", "quantity": 50.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Ail", "quantity": 2.0, "unit": "gousses", "aisle": "fruits_legumes"}, {"name": "Muscade", "quantity": null, "unit": "", "aisle": "epicerie"}]}, {"title": "Poulet rôti et pommes de terre", "emoji": "🍗", "ingredients": [{"name": "Poulet fermier", "quantity": 1.0, "unit": "", "aisle": "boucherie"}, {"name": "Pommes de terre", "quantity": 1.0, "unit": "kg", "aisle": "fruits_legumes"}, {"name": "Ail", "quantity": 1.0, "unit": "tête", "aisle": "fruits_legumes"}, {"name": "Thym", "quantity": 1.0, "unit": "bouquet", "aisle": "fruits_legumes"}, {"name": "Beurre", "quantity": 30.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Bœuf bourguignon", "emoji": "🍷", "ingredients": [{"name": "Bœuf à braiser", "quantity": 1.5, "unit": "kg", "aisle": "boucherie"}, {"name": "Vin rouge", "quantity": 75.0, "unit": "cl", "aisle": "boissons"}, {"name": "Lardons", "quantity": 200.0, "unit": "g", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Champignons de Paris", "quantity": 250.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Farine", "quantity": 30.0, "unit": "g", "aisle": "epicerie"}, {"name": "Bouquet garni", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Pâtes tagliatelles", "quantity": 500.0, "unit": "g", "aisle": "epicerie"}]}, {"title": "Quiche lorraine", "emoji": "🥧", "ingredients": [{"name": "Pâte brisée", "quantity": 1.0, "unit": "rouleau", "aisle": "cremerie"}, {"name": "Lardons", "quantity": 200.0, "unit": "g", "aisle": "boucherie"}, {"name": "Œufs", "quantity": 3.0, "unit": "", "aisle": "cremerie"}, {"name": "Crème fraîche", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Lait", "quantity": 20.0, "unit": "cl", "aisle": "cremerie"}, {"name": "Gruyère râpé", "quantity": 80.0, "unit": "g", "aisle": "cremerie"}, {"name": "Salade verte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Lasagnes à la bolognaise", "emoji": "🍝", "ingredients": [{"name": "Feuilles de lasagne", "quantity": 500.0, "unit": "g", "aisle": "epicerie"}, {"name": "Bœuf haché", "quantity": 500.0, "unit": "g", "aisle": "boucherie"}, {"name": "Coulis de tomate", "quantity": 70.0, "unit": "cl", "aisle": "epicerie"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Carotte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Lait", "quantity": 1.0, "unit": "l", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 60.0, "unit": "g", "aisle": "cremerie"}, {"name": "Farine", "quantity": 60.0, "unit": "g", "aisle": "epicerie"}, {"name": "Gruyère râpé", "quantity": 150.0, "unit": "g", "aisle": "cremerie"}]}, {"title": "Pot-au-feu", "emoji": "🥕", "ingredients": [{"name": "Paleron de bœuf", "quantity": 1.5, "unit": "kg", "aisle": "boucherie"}, {"name": "Os à moelle", "quantity": 4.0, "unit": "", "aisle": "boucherie"}, {"name": "Carottes", "quantity": 6.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Poireaux", "quantity": 3.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Navets", "quantity": 4.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Pommes de terre", "quantity": 800.0, "unit": "g", "aisle": "fruits_legumes"}, {"name": "Oignon", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Bouquet garni", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Croque-monsieur et salade", "emoji": "🥪", "ingredients": [{"name": "Pain de mie", "quantity": 1.0, "unit": "paquet", "aisle": "boulangerie"}, {"name": "Jambon blanc", "quantity": 8.0, "unit": "tranches", "aisle": "boucherie"}, {"name": "Gruyère râpé", "quantity": 150.0, "unit": "g", "aisle": "cremerie"}, {"name": "Beurre", "quantity": 50.0, "unit": "g", "aisle": "cremerie"}, {"name": "Salade verte", "quantity": 1.0, "unit": "", "aisle": "fruits_legumes"}]}, {"title": "Ratatouille et riz", "emoji": "🍆", "ingredients": [{"name": "Aubergines", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Courgettes", "quantity": 3.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Poivrons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Tomates", "quantity": 6.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Oignons", "quantity": 2.0, "unit": "", "aisle": "fruits_legumes"}, {"name": "Ail", "quantity": 3.0, "unit": "gousses", "aisle": "fruits_legumes"}, {"name": "Huile d''olive", "quantity": null, "unit": "", "aisle": "epicerie"}, {"name": "Riz", "quantity": 400.0, "unit": "g", "aisle": "epicerie"}]}]'::jsonb) loop
    insert into public.recipes (family_id, title, emoji)
    values (p_family, r->>'title', r->>'emoji')
    returning id into new_id;

    insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
    select new_id, i.ord::int, i.item->>'name', (i.item->>'quantity')::numeric, i.item->>'unit', i.item->>'aisle'
    from jsonb_array_elements(r->'ingredients') with ordinality as i(item, ord);
  end loop;
end $$;

revoke all on function public.add_starter_recipes(uuid) from public, anon, authenticated;
grant execute on function public.add_starter_recipes(uuid) to service_role;


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
