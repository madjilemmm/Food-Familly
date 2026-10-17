# Kaddie — design system pour Claude Code

Lis ce fichier en entier avant de toucher à l'interface. Regarde ensuite `exemples/ecrans.png` : c'est la cible visuelle.

Kaddie est l'appli de courses de la famille (PWA iPhone). Maman appuie sur « Je pars faire les courses », ses deux fils reçoivent une notif, swipent des recettes, et les plats likés par les deux deviennent des matchs qui remplissent la liste de courses.

L'identité reprend la DA de Frutz Up : un fond saturé, un mur de grands blocs arrondis un peu de travers, et la typo BoldenVan en blanc par-dessus. L'appli doit avoir l'air gourmande, rebondie et un peu bancale, jamais propre et corporate.

**La palette est volontairement courte : du violet, du pistache, du blanc.** Le violet (`violet` + `aubergine`) fait l'ambiance, le pistache est le seul accent vif, le lilas sert de fond calme. N'ajoute aucune autre couleur.

---

## 1. Contenu du dossier

| Chemin | Rôle |
| --- | --- |
| `tokens/tokens.css` | Toutes les variables CSS (couleurs, typo, espaces, rayons, mouvement) + `@font-face` BoldenVan. |
| `tokens/tailwind-v4.css` | Bloc `@theme` pour Tailwind v4 (utilitaires `bg-violet`, `font-display`, `text-titre-2`, `rounded-carte`…). |
| `tokens/tailwind-v3.preset.js` | Le même chose en preset Tailwind v3. |
| `tokens/tokens.json` | La source des tokens, avec une note d'usage pour chacun. |
| `styles/kaddie.css` | Les classes des composants, toutes préfixées `kd-`. |
| `components/Kaddie.tsx` | `Logo`, `Motif`, `Scene`, `Bouton`, `CarteRecette`, `IconeJenVeux`, `IconePasEnvie`. |
| `components/motif.ts` | Le générateur du motif de blocs (`motifPath`) et la table des duos. |
| `components/logo-paths.ts` | Les tracés vectoriels du logo. Ne pas modifier. |
| `exemples/Ecrans.tsx` | Les 6 écrans de référence construits avec les composants. |
| `exemples/ecrans.png` / `ecrans.html` | Le rendu de ces écrans. |
| `public/` | À fusionner dans le `public/` de l'appli : `fonts/`, `icons/`, `brand/` (logos, fonds, motifs, illustrations). |

## 2. Installation (Next.js App Router)

1. Le dossier `design-system/` est à la racine du repo. Copie le contenu de `design-system/public/` dans `public/` (sans écraser autre chose que les anciennes icônes), puis supprime `design-system/public/`.
2. Dans `app/globals.css`, en tête :
   - Tailwind v4 : `@import "tailwindcss";` puis `@import "../design-system/tokens/tokens.css";`, `@import "../design-system/styles/kaddie.css";`, puis colle le contenu de `tokens/tailwind-v4.css`.
   - Tailwind v3 : les deux `@import` de tokens.css et kaddie.css avant `@tailwind base;`, et `presets: [require("./design-system/tokens/tailwind-v3.preset.js")]` dans `tailwind.config`. En v3, les couleurs sont des variables : le modificateur d'opacité (`bg-violet/50`) ne marche pas, c'est voulu.
3. Dans `app/layout.tsx` :
   - Rubik via `next/font/google` (`weight: ["400", "500", "600"]`, `variable: "--font-rubik"`, `display: "swap"`). BoldenVan est déjà chargée par `tokens.css` depuis `/fonts/BoldenVan.ttf`.
   - `<body className={`${rubik.variable} kd-app`}>`.
   - `export const viewport = { themeColor: "#971cd0", viewportFit: "cover" }`.
   - `metadata` : titre « Kaddie », `icons: { icon: "/icons/favicon.svg", apple: "/icons/apple-touch-icon.png" }`, `appleWebApp: { title: "Kaddie", statusBarStyle: "black-translucent" }`.
4. Manifest PWA : `name` et `short_name` « Kaddie », `theme_color` `#971cd0`, `background_color` `#f6eefb`, icônes `/icons/icon-192.png`, `/icons/icon-512.png` et `/icons/icon-maskable-512.png` (`"purpose": "maskable"`).
5. Service worker : `icon: "/icons/icon-192.png"` dans `showNotification`.
6. **Supprime l'ancienne identité « À table »** : la police Fredoka, les anciens logos et icônes, et l'ancienne palette Tailwind (`tomate`, `safran`, `aubergine`, `peche`, `rebord`). Attention : `aubergine` existe aussi dans Kaddie, avec une autre valeur. Remplace chaque usage selon son rôle : ancien fond pêche → `fond`, ancien texte aubergine → `encre`, anciens boutons tomate → `action`, anciens accents safran → `accent`.

## 3. Règles non négociables

- **Le logo vient de `<Logo />` ou de `public/brand/logo/`.** Ne l'écris jamais avec la police : le i-couteau et le e-fourchette sont dessinés. Sous 120 px de large, utilise `<Logo variante="monogramme" />` (« ie »).
- **Trois couleurs, pas une de plus** : violet (et aubergine), pistache, blanc, plus le lilas et l'encre pour les écrans calmes. Pas de rouge pour « Pas envie », pas de vert pour « validé » : c'est le pistache.
- **Une scène = un duo.** Dans l'appli, c'est toujours le duo `aubergine`. Le duo `pistache` est réservé aux visuels de com.
- **BoldenVan pour ce qui se voit, Rubik pour ce qui se lit.** Titres, noms de plats, boutons, tampons : BoldenVan. Listes, infos, formulaires : Rubik. Jamais de paragraphe en BoldenVan. Pas de gras ni d'italique simulés sur BoldenVan.
- **Pas de couleur en dur.** Uniquement les variables de `tokens.css` (ou les utilitaires Tailwind qui en dérivent).
- **Pas d'ombre portée, pas de dégradé, pas de flou.** La profondeur vient des blocs et de la superposition, comme sur une affiche.
- **Coins arrondis partout** : `--rayon-s` (pastilles, champs, cases), `--rayon-m` (boutons), `--rayon-l` (cartes, grand bouton, tuiles).
- **Un seul bouton principal par écran.** Sur une scène colorée, le bouton d'action est blanc (`variante="secondaire"` ou `"geant"`).
- **Pas d'emoji dans l'interface.**
- **Cibles tactiles d'au moins 56 px de haut.** Maman tape d'une main, le panier dans l'autre.

## 4. Couleurs

| Token | Valeur | Rôle |
| --- | --- | --- |
| `violet` | #971cd0 | Fond des scènes, bouton principal (`action`) sur fond clair, logo sur fond clair. |
| `aubergine` | #540472 | Blocs du motif, texte sur pistache et sur blanc, focus. |
| `pistache` (= `accent`) | #aaf951 | Le seul accent : « J'en veux », matchs, cases cochées, pastilles, monogramme du match. Texte dessus : `aubergine`. |
| `blanc` | #ffffff | Logo et titres sur les scènes, cartes, « Pas envie ». |
| `lilas` (= `fond`) | #f6eefb | Fond des écrans calmes (liste, recettes, réglages). |
| `encre` / `encre-douce` | #24062f / #6a4479 | Texte courant / infos secondaires sur lilas et blanc. |
| `trait` | #e3d0ee | Séparateurs, emplacement photo vide. |

Deux duos pour `<Scene>` :

| Duo | Fond / blocs | Texte | Usage |
| --- | --- | --- | --- |
| `aubergine` | violet / aubergine | blanc | Tous les écrans à motif de l'appli. |
| `pistache` | pistache / aubergine | blanc (sur les blocs) | Visuels de com, réseaux. Pas dans l'appli. |

### Illustrations

Trois fonds illustrés dans les mêmes violets que le motif, en SVG dans `public/brand/illustrations/` :

| Nom | Contenu | Où |
| --- | --- | --- |
| `courses` | panier, pain, lait, pâtes, légumes | En-tête de la liste de courses, tuile de profil de maman |
| `marche` | fruits et légumes | En-tête des recettes, tuile d'un des fils |
| `table` | assiette, couverts, bol | En-tête des matchs côté maman, tuile de l'autre fils |

`<Scene duo="aubergine" illustration="courses" format="paysage">` remplace le motif de blocs par l'illustration. **Uniquement dans des cadres horizontaux** (en-têtes, tuiles, bannières) : en plein écran vertical, l'illustration est tellement recadrée qu'on ne reconnaît plus les objets. Les écrans plein écran gardent le motif de blocs.

Le motif est réservé aux moments forts (code famille, profils, maman, swipe, match, en-têtes). Les écrans de liste, de réglages et de recettes restent sur `fond` (lilas), texte `encre`, infos `encre-douce`, séparateurs `trait`.

Contraste : blanc sur violet 6,2:1 et sur aubergine 12,8:1, à toutes les tailles. Aubergine sur pistache 10:1. Jamais de texte blanc sur pistache (1,3:1), jamais de texte pistache sur lilas ou blanc.

## 5. Composants

```tsx
import { Logo, Scene, Bouton, CarteRecette, IconeJenVeux, IconePasEnvie } from "@/design-system/components/Kaddie";

<Logo width={280} />                          // prend currentColor
<Logo variante="monogramme" width={32} />     // « ie »
<Scene duo="aubergine" seed={4}>…</Scene>      // format "portrait" | "paysage" | "carre", unit = taille des blocs
<Scene duo="aubergine" illustration="courses" format="paysage">…</Scene>  // fond illustré, cadres horizontaux uniquement
<Bouton>Valider la liste</Bouton>             // variante "principal" | "secondaire" | "like" | "nope" | "geant", rond, large
<Bouton variante="like" rond aria-label="J'en veux"><IconeJenVeux /></Bouton>
<CarteRecette titre="Gratin dauphinois" photo={url} infos="1 h 10 · 4 pers." pastille="Ton frère aussi" />
```

Classes utiles de `kaddie.css` : `kd-titre-1` à `kd-titre-3`, `kd-display`, `kd-petit`, `kd-etiquette`, `kd-pastille` (`--match`), `kd-champ` (`--code`), `kd-liste`, `kd-liste__article`, `kd-case` (case à cocher), `kd-tampon--like` / `--nope`, `kd-carte--pleine`, `kd-pop`, `kd-monte`.

Garde une graine (`seed`) fixe par écran : le motif ne doit pas changer d'un rendu à l'autre. Les composants de `Kaddie.tsx` sont des Client Components (`"use client"`), utilisables depuis n'importe quelle page. `motifPath` (dans `motif.ts`) est une fonction pure, utilisable aussi côté serveur.

## 6. Écran par écran

Les maquettes de `exemples/` montrent l'intention. Adapte-les aux vrais écrans et aux vraies données de l'appli, sans changer la logique. Toutes les scènes utilisent le duo `aubergine` ; change seulement la graine (`seed`) d'un écran à l'autre.

- **Code famille** : scène plein écran, grand logo blanc en haut, accroche « Les courses de la famille, en un swipe. » en `kd-titre-3`. En bas, une carte blanche avec le champ `kd-champ--code` et le bouton « C'est parti » (`action`).
- **Choix du profil** : fond lilas, petit logo violet, « C'est qui ? » en `kd-titre-1`. Une tuile par profil, chacune une petite scène `format="paysage"` avec sa propre illustration (maman = `courses`, les fils = `marche` et `table`), prénom en bas à gauche en `kd-titre-2` blanc. Profil sélectionné : contour pistache de 4 px.
- **Écran de maman** : scène plein écran, petit logo blanc, « Salut maman ! » en `kd-titre-1`, et en bas un seul `Bouton variante="geant"` (blanc, texte aubergine) « Je pars faire les courses ». Rien d'autre ne doit attirer l'œil. Une fois les courses lancées, le même écran affiche l'état (« Les garçons choisissent… ») et le nombre de matchs en `kd-pastille--match`.
- **Swipe (Envies)** : comme Recettes, en-tête en scène `format="paysage"` avec l'illustration `table` : « Ce soir » en `kd-etiquette` blanc et les boutons ronds blancs sur une ligne (matchs = cœur avec leur nombre en pastille pistache, puis réglages), « Ça te dit ? » en `kd-titre-1` blanc dessous. Corps sur lilas : pile de 3 cartes (`kd-carte--pleine`) qui remplit l'écran, celles du dessous décalées et légèrement tournées. En bas, deux boutons ronds : « Pas envie » blanc (`nope`) et « J'en veux » pistache (`like`). Pas de logo dans l'en-tête.
- **Match** : scène plein écran, monogramme pistache qui apparaît en `kd-pop`, « C'est un match ! » en `kd-display` blanc (56 px sur mobile), la carte du plat qui monte (`kd-monte`), un seul bouton pistache « Ajouter au caddie ».
- **Matchs côté maman** : en-tête en scène `format="paysage"` avec l'illustration `table` et « Ce soir, ils veulent » en `kd-titre-1` blanc, puis les cartes des plats matchés sur lilas, avec pour chacun « Valider » (`like`) ou « Pas cette fois » (`secondaire`).
- **Liste de courses** : en-tête en scène `format="paysage"` avec l'illustration `courses`, la date et le nombre de matchs en `kd-etiquette` blanc, puis « Ta liste » en `kd-titre-1` blanc. Corps sur lilas : un `kd-etiquette` par rayon, des articles `kd-liste__article` avec `kd-case` (cochée = pistache). Un article coché passe en `encre-douce` barré.
- **Recettes** : en-tête en scène `format="paysage"` avec l'illustration `marche`, puis fond lilas, titres BoldenVan en aubergine, cartes blanches.
- **Réglages** : fond lilas, titres BoldenVan en aubergine, aucun motif.
- **États vides** : une petite scène avec une phrase courte en BoldenVan blanc (« Plus de recettes pour ce soir. Reviens quand maman repart en courses ! ») et une action.
- **Chargement** : scène plein écran avec le monogramme blanc qui pulse doucement. Pas de spinner générique.
- **Erreurs** : une phrase qui dit ce qui s'est passé et quoi faire (« Pas de réseau. Tes choix seront envoyés dès que ça revient. »), jamais de code technique.

## 7. Mouvement

- Durées : `--duree-rapide` (120 ms, appui), `--duree` (240 ms, transitions), `--duree-lente` (420 ms, apparitions). Courbes : `--courbe-sortie` pour tout, `--courbe-rebond` pour les moments de joie (match, case cochée).
- **Swipe** : la carte suit le doigt ; rotation = déplacement horizontal / 20, plafonnée à 15°. Les tampons « Miam » (`kd-tampon--like`, pistache) et « Bof » (`kd-tampon--nope`, blanc) apparaissent en fondu selon le déplacement. Au-delà de 30 % de la largeur ou d'un geste rapide, la carte part hors de l'écran en 240 ms. Sinon elle revient à sa place en `--courbe-rebond`. Les boutons ronds déclenchent la même sortie.
- **Appui** : tous les boutons rétrécissent à 96 % (`kd-btn:active`).
- **Match** : `kd-pop` sur le monogramme, `kd-monte` sur la carte, 120 ms de décalage entre les deux.
- Respecte `prefers-reduced-motion` : pas de rotation ni de rebond, fondus courts seulement.

## 8. Rédaction

Tutoiement, phrases courtes, verbes d'action, vocabulaire de la cuisine et du marché. Écris « maman », « ton frère », jamais « l'utilisateur ». Un point d'exclamation par écran au maximum. Espace insécable avant « ! », « ? » et « : ». BoldenVan n'a ni « » ni € : dans un titre, reformule ; dans le texte courant (Rubik), aucun problème.

## 9. Vérification avant de dire « fini »

- `npm run build` et `npm run lint` passent.
- Chaque écran vérifié à 390 × 844 (iPhone), avec les zones sûres (`env(safe-area-inset-*)`) respectées en haut et en bas.
- Aucune couleur en dur restante (`grep` sur `#` dans les composants), aucune trace de Fredoka ni de l'ancienne palette.
- Aucune couleur hors palette (section 4) : pas de rouge, d'orange, de bleu ni de vert autre que le pistache.
- Focus clavier visible sur tous les boutons et champs.
- Rappel : après déploiement, supprimer l'appli de l'écran d'accueil des iPhone et la réinstaller depuis Safari, sinon iOS garde l'ancienne icône.
