-- Mesure : comment un dîner a été décidé, sans rien savoir de qui.
-- Ajout seulement : deux colonnes facultatives sur la décision du soir, rien n'est supprimé ni transformé. Peut être relancé sans risque.

-- rang : combien d'idées ont été écartées (« Autre idée ») ce jour-là avant « Ce sera ça » ; 0 : la première proposition a plu.
alter table public.ce_soir_choix add column if not exists rang integer check (rang >= 0);

-- raison : la ligne affichée sous le plat quand il a été retenu (achete, envie, classique_jour, adore, classique, aime, pas_fait, idee).
-- Jamais un texte libre : l'appli n'écrit que ces mots-là.
alter table public.ce_soir_choix add column if not exists raison text check (char_length(raison) <= 30);

-- L'API voit tout de suite les nouvelles colonnes.
notify pgrst, 'reload schema';
