Mon appli de courses familiale change de nom et d'identité : elle s'appelle maintenant **Kaddie**. Le design system complet est dans le dossier `design-system/` à la racine du repo. Je veux un habillage graphique de qualité sur toute l'appli, sans toucher à la logique (Supabase, notifications, matching).

Procède en 4 étapes et arrête-toi après l'étape 1 pour que je valide.

**1. Lire et proposer un plan**
- Lis `design-system/DESIGN.md` en entier et regarde `design-system/exemples/ecrans.png` (la cible visuelle) et `design-system/exemples/Ecrans.tsx` (comment utiliser les composants).
- Explore le projet : version de Tailwind, layout, globals.css, manifest, service worker, liste de tous les écrans et composants d'interface.
- Propose-moi un plan écran par écran : quel duo, quels composants, ce qui change. Signale tout écran qui n'est pas couvert par DESIGN.md.

**2. Poser les fondations** (après ma validation)
- Installation comme décrit dans la section 2 de DESIGN.md : tokens, styles, Tailwind, polices, métadonnées, manifest, icônes, service worker.
- Supprime complètement l'ancienne identité « À table » (Fredoka, ancienne palette, anciens logos et icônes).

**3. Habiller chaque écran**
- Un écran à la fois, en suivant la section 6 de DESIGN.md et les maquettes de `exemples/`.
- Utilise les composants de `design-system/components/Kaddie.tsx`. Si un composant manque, crée-le dans le même esprit et avec les mêmes tokens.
- Implémente le swipe et les animations comme décrit dans la section 7, avec `prefers-reduced-motion` respecté.
- Réécris les textes de l'interface selon la section 8.

**4. Vérifier**
- Suis la checklist de la section 9 de DESIGN.md.
- Fais des captures de chaque écran à 390 × 844 et compare-les à `exemples/ecrans.png`. Corrige ce qui s'en éloigne.
- Termine par un résumé : écrans modifiés, composants créés, et tout ce que tu n'as pas pu faire.
