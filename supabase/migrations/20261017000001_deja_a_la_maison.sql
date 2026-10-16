-- « J'en ai déjà » : un ingrédient de recette retiré de la liste reste noté (source « maison »)
-- pour ne pas revenir quand la liste se met à jour.
alter table shopping_list_items drop constraint if exists shopping_list_items_source_check;
alter table shopping_list_items add constraint shopping_list_items_source_check
  check (source in ('recipe', 'manual', 'request', 'maison'));
