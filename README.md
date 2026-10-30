# 🛒 Kaddie

La petite appli familiale pour choisir les repas et faire les courses sans prise de tête.
Chaque famille crée son espace, ajoute ses membres et partage un code. Ensuite, **n'importe qui** peut faire les courses :

- **Celui ou celle qui part** l'annonce en 2 taps. Les autres sont prévenus, il voit leurs réponses en direct, coche les plats, et la liste de courses se fait toute seule, triée par rayon.
- **Tout le monde** swipe des recettes comme sur une appli de rencontre : à droite « j'en ai envie », à gauche « pas envie là ». Quand **au moins deux personnes** ont envie du même plat, c'est un **match**, pour ces personnes-là. Quand quelqu'un part, les autres répondent avec du texte libre et/ou des plats, et leurs envies arrivent de toute façon à la personne qui fait les courses.
- Une seule appli pour tout le monde, trois onglets : **Envies** (swipe), **Menu** (ce qu'on mange), **Courses** (la liste). « Tu swipes, Kaddie fait le reste » : un plat qui fait un match (seul dans la famille, une envie) entre au **Menu**, et ses ingrédients vont tout seuls sur la **liste**, toujours ouverte. Personne ne lance de course ni ne choisit les plats ; on retire un plat du Menu d'un appui (×) ou on en ajoute un (+). « Je pars faire les courses » est facultatif : il prévient la famille, pour une dernière envie. « J'ai fini les courses » passe les plats achetés « à cuisiner » et ouvre une nouvelle liste. Les recettes s'ouvrent depuis le Menu. En tête du Menu : la réponse du soir (« Ce soir », une seule idée, « Je cuisine », « Autre idée »). Les plats cuisinés au moins 3 fois sont des « Classiques ». Un nouveau membre voit d'abord ce dont la famille a déjà envie.

Stack : Next.js 15 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres, Realtime, Storage), Web Push (VAPID), hébergement sur Vercel (gratuit).

---

## Sommaire

1. [Comment ça marche](#1-comment-ça-marche)
2. [Configurer Supabase](#2-configurer-supabase-pas-à-pas)
3. [Générer les clés de notification (VAPID)](#3-générer-les-clés-de-notification-vapid)
4. [Lancer l'appli sur son ordinateur](#4-lancer-lappli-sur-son-ordinateur-facultatif)
5. [Déployer sur Vercel](#5-déployer-sur-vercel)
6. [Installer l'appli sur un iPhone et activer les notifications](#6-installer-lappli-sur-un-iphone-et-activer-les-notifications)
7. [Personnaliser](#7-personnaliser)
8. [Dépannage](#8-dépannage)
9. [Pour les développeurs](#9-pour-les-développeurs)

---

## 1. Comment ça marche

| Règle | Détail |
|---|---|
| Familles | Au premier lancement : **« Commencer »** (un prénom et combien vous êtes à table : Kaddie propose tout de suite un repas) ou **« J'ai déjà un code »**. Chaque famille a ses propres membres, recettes, matchs et listes, invisibles des autres. Une nouvelle famille reçoit 10 recettes de départ. |
| Connexion | Le code famille est saisi une seule fois, puis on choisit son prénom (ou « Je ne suis pas dans la liste »). C'est retenu sur le téléphone pendant plus d'un an. |
| Qui fait les courses | N'importe quel membre. Une seule course à la fois par famille : les autres voient « X part dans… » et lui envoient leurs demandes. Tout le monde peut consulter et compléter la liste. |
| Départ en courses | Choix : 30 min, 1 h, 2 h ou « ce soir, 18 h ». Ce dernier choix disparaît après 17 h. |
| Heure limite dépassée | Si personne n'a répondu, la personne qui fait les courses voit automatiquement les plats matchés. C'est calculé à l'affichage, sans tâche planifiée. Elle n'attend jamais personne : elle peut faire sa liste à tout moment. |
| Goût, envie, repas | Trois choses distinctes (règles : `src/lib/domain/reco.ts`). **Goût** : « j'aime ce plat » (dernier like, gardé même après un « Bof ») ou « pas pour moi », plus le questionnaire ; il s'estompe doucement (demi-vie 90 jours). **Envie** : un like de moins de 14 jours, éteint dès que le plat a été acheté. **Repas retenu** : un plat gardé pour une course, avec qui le mange vraiment. On corrige son avis depuis la fiche recette. |
| Match | **Au moins deux personnes** ont envie du même plat : une compatibilité entre elles, pas un repas décidé. Ceux qui n'ont rien dit, ou qui ne swipent plus, n'entrent pas dans le calcul (ne pas avoir voté n'est jamais un refus). Les interdits excluent toujours le plat. |
| Propositions des courses | Un score explicable : compatibilité des personnes concernées (moyenne des goûts, l'inconnu est neutre, un désaccord pèse) + contexte (demandé, envies, retenu récemment, retiré la dernière fois). Les « autres idées » passent à tour de rôle par personne, et quelqu'un qui n'a eu aucun plat aux dernières courses remonte : personne n'est oublié parce que ses goûts sont minoritaires. Tous les poids sont dans `REGLAGES`. |
| Paquet de swipe | D'abord des plats jamais vus, classés pour moi (mes goûts, ce dont les autres ont envie, la découverte), sans trois plats du même style d'affilée ; un favori revient une carte sur 5 (aimé : après 3 semaines, refusé : après 6), donc le paquet ne s'épuise jamais. Quand il reste moins de 8 plats à découvrir, une dizaine de plats principaux bien notés arrivent tout seuls de Marmiton ; ceux que personne n'a aimés en 4 semaines laissent la place. |
| Goûts | À sa première connexion, chacun remplit un petit questionnaire (régime et allergies, **tes envies** : styles de plats, temps de cuisine, piquant, puis des cartes d'ingrédients qu'on peut arrêter quand on veut) (modifiable dans Réglages → **Mes goûts**, ou « Plus tard »). Trois niveaux : **interdit** (régime, allergie : la recette disparaît pour **toute la famille**, du swipe, des matchs, des plats des courses et de l'import Marmiton), **j'aime pas** (disparaît de **mon** paquet ; pour les autres, en **mode strict** — par défaut, réglable dans Ma famille — elle disparaît aussi, sinon elle passe en fin de paquet avec « Madji n'aime pas »), **j'adore** (en tête de mon paquet). Les régimes sont des groupes d'aliments : « sans porc » attrape lardons, jambon, chorizo… Tout reste visible dans **Recettes**, avec une étiquette. Pour une allergie, vérifiez toujours les étiquettes : le tri se fait sur les noms des ingrédients. |
| Relance | 10 minutes avant l'heure limite, ceux qui n'ont pas encore répondu reçoivent « Plus que 10 min », une seule fois. Supabase (pg_cron) appelle `/api/cron/relance` chaque minute. Pour qu'on ne puisse pas la solliciter à vide : définissez `CRON_SECRET` dans Vercel et ajoutez `"Authorization": "Bearer <le même secret>"` aux en-têtes de la tâche `kaddie-relance` (sans `CRON_SECRET`, elle reste ouverte). |
| Recettes importées | Uniquement des plats principaux populaires que des jeunes mangent volontiers (burgers, pâtes, tacos, curry coco, gratins…), cherchés selon les **envies** de la famille ; rien de « léger », d'abats ni de trop long pour la personne la plus pressée. Chaque recette garde ses étapes, sa durée et son nombre de personnes : on la consulte en touchant un match ou un plat. |
| Nombre de personnes | Au départ en courses, « Pour combien ? » (toute la famille par défaut) : la liste recalcule les quantités de chaque recette (600 g pour 6 → 300 g pour 3 ; œufs et pièces arrondis à l'unité, une pincée reste une pincée). |
| Liste de courses | Les doublons sont fusionnés (« 1 oignon » + « 2 oignons » = 3 oignons, 400 g + 1 kg = 1,4 kg) et regroupés par rayon. Régénérer la liste garde les articles ajoutés à la main et ce qui est déjà coché. |
| Sécurité | Toute la base passe par le serveur avec la clé secrète. La clé publique Supabase ne peut **rien** lire ni écrire (RLS activée sans aucune autorisation). Elle sert uniquement à recevoir le signal « rafraîchis-toi », qui ne contient aucune donnée. |

---

## 2. Configurer Supabase (pas à pas)

1. Créez un compte gratuit sur [supabase.com](https://supabase.com), puis cliquez sur **New project**.
   - **Name** : `a-table` (au choix).
   - **Database password** : générez-en un et gardez-le de côté (il ne servira plus ensuite).
   - **Region** : **West EU (Paris)**, le plus proche de vous.
   - Cliquez sur **Create new project** et attendez environ 2 minutes.

2. **Créer les tables** : menu de gauche **SQL Editor** → **New query**. Copiez-collez **tout** le contenu du fichier
   [`supabase/migrations/20261005000001_schema.sql`](supabase/migrations/20261005000001_schema.sql), puis cliquez sur **Run**. Le message attendu est « Success. No rows returned ».

3. **Ajouter les familles** : nouvelle requête, collez le contenu de
   [`supabase/migrations/20261013000001_familles.sql`](supabase/migrations/20261013000001_familles.sql), puis **Run**.
4. **Recettes Marmiton et goûts** : de la même façon, lancez
   [`supabase/migrations/20261015000001_recettes_web.sql`](supabase/migrations/20261015000001_recettes_web.sql) puis
   [`supabase/migrations/20261016000001_gouts.sql`](supabase/migrations/20261016000001_gouts.sql), puis
   [`supabase/migrations/20261016000002_envies_recettes_relance.sql`](supabase/migrations/20261016000002_envies_recettes_relance.sql)
   (envies, recette complète, nombre de personnes, et la relance « plus que 10 minutes » appelée chaque minute par Supabase), puis
   [`supabase/migrations/20261017000001_deja_a_la_maison.sql`](supabase/migrations/20261017000001_deja_a_la_maison.sql)
   (« j'en ai déjà » : un ingrédient de recette retiré de la liste ne revient pas), puis
   [`supabase/migrations/20261017000002_qui_mange_quoi.sql`](supabase/migrations/20261017000002_qui_mange_quoi.sql)
   (nombre de personnes par plat), puis
   [`supabase/migrations/20261017000003_envies.sql`](supabase/migrations/20261017000003_envies.sql)
   (goût gardé après un « Bof », et qui mange chaque plat retenu ; ajouts seulement), puis
   [`supabase/migrations/20261019000001_confiance.sql`](supabase/migrations/20261019000001_confiance.sql)
   (limite d'essais sur les codes, liens d'invitation), puis
   [`supabase/migrations/20261019000002_courses_malignes.sql`](supabase/migrations/20261019000002_courses_malignes.sql)
   (ce que la famille apprend à Kaddie sur ses articles, achats habituels, anti-doublon), puis
   [`supabase/migrations/20261019000003_repas.sql`](supabase/migrations/20261019000003_repas.sql)
   (« Ce soir, on mange quoi ? » et les mercis), puis
   [`supabase/migrations/20261019000004_a_table.sql`](supabase/migrations/20261019000004_a_table.sql)
   (« À table ! » : l'appel et les réponses), puis
   [`supabase/migrations/20261022000001_voix_et_ce_soir.sql`](supabase/migrations/20261022000001_voix_et_ce_soir.sql)
   (« Ta voix fait le match » et « Autre idée » dans Ce soir), puis
   [`supabase/migrations/20261028000001_ce_soir_choisi.sql`](supabase/migrations/20261028000001_ce_soir_choisi.sql)
   (« Ce sera ça » : le plat retenu pour ce soir), puis
   [`supabase/migrations/20261028000002_recettes_de_depart.sql`](supabase/migrations/20261028000002_recettes_de_depart.sql)
   (durée et étapes des 10 recettes de départ, pour les familles créées avant), puis
   [`supabase/migrations/20261029000001_premiere_experience.sql`](supabase/migrations/20261029000001_premiere_experience.sql)
   (le nombre de personnes à table, et des compteurs d'étapes anonymes pour voir où l'on s'arrête : voir plus bas), puis
   [`supabase/migrations/20261030000001_mesure.sql`](supabase/migrations/20261030000001_mesure.sql)
   (deux colonnes sur la décision du soir pour la mesure : `rang` et `raison`, voir « Mesurer le retour »).
   Chaque fichier se lance dans cet ordre ; on peut les relancer sans risque.

   Pas besoin de données de départ : on crée sa famille directement dans l'appli. (Le fichier facultatif
   [`supabase/seed.sql`](supabase/seed.sql) crée une famille de démonstration, code `demo-1234-test`.)

4. **Vérifier** : menu **Table Editor**. Vous devez voir `profiles` (3 lignes), `recipes` (10 lignes) et `recipe_ingredients`.
   Menu **Storage** : un bucket public `recipe-photos` doit exister (il sert aux photos des recettes).

5. **Vérifier le temps réel** : menu **Realtime** → **Settings**. L'option **« Allow public access »** doit être **activée** (c'est le réglage par défaut).
   L'appli utilise un canal public qui ne transporte aucune donnée, seulement un signal « rafraîchis-toi ».

6. **Récupérer les clés** : **Project Settings** (roue crantée) → **API Keys** et **Data API**.

   | À copier | Dans la variable |
   |---|---|
   | Project URL (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
   | Clé **publishable** (ou ancienne clé `anon`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | Clé **secret** (ou ancienne clé `service_role`) | `SUPABASE_SERVICE_ROLE_KEY` |

   ⚠️ La clé secrète ne doit **jamais** être publiée ni préfixée par `NEXT_PUBLIC_`.

> Vous préférez la ligne de commande ? Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :
> `supabase link --project-ref <ref>`, puis `supabase db push`, puis exécutez `supabase/seed.sql` dans le SQL Editor.

---

## 3. Générer les clés de notification (VAPID)

Les notifications push ont besoin d'une paire de clés. Après `npm install` :

```bash
npm run vapid
# équivalent : npx web-push generate-vapid-keys
```

Ce qui s'affiche :

```
Public Key:
BOx...   → NEXT_PUBLIC_VAPID_PUBLIC_KEY
Private Key:
k3F...   → VAPID_PRIVATE_KEY
```

Choisissez ces clés **une fois pour toutes**. Si vous les changez, il faudra réactiver les notifications sur chaque téléphone.

Il reste trois variables à remplir :

- `VAPID_SUBJECT` : `mailto:votre@email.fr` (une adresse de contact pour Apple et Google).
- `SESSION_SECRET` : une longue chaîne aléatoire. Générez-la avec `openssl rand -base64 32`, ou tapez 40 caractères au hasard.
- `FAMILY_CODE` : facultatif depuis l'arrivée des familles (chaque famille a son code, géré dans l'appli). Si la variable existe déjà, **ne la supprimez pas** : elle entre dans la signature des sessions, et la retirer déconnecterait tout le monde.

---

## 4. Lancer l'appli sur son ordinateur (facultatif)

Prérequis : [Node.js 20 ou plus](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # puis remplissez les valeurs
npm run dev                  # http://localhost:3000
```

Les notifications ne fonctionnent pas sur iPhone en local : elles demandent un vrai déploiement en HTTPS.

---

## 5. Déployer sur Vercel

1. Mettez le code sur GitHub (c'est déjà le cas si vous lisez ceci sur GitHub).
2. Sur [vercel.com](https://vercel.com), connectez-vous avec GitHub, puis **Add New… → Project**. Choisissez le dépôt `Food-Familly` et cliquez sur **Import**.
3. Laissez les réglages détectés (Framework : **Next.js**).
4. Ouvrez **Environment Variables** et ajoutez les 8 variables de [`.env.example`](.env.example) :

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   FAMILY_CODE
   SESSION_SECRET
   NEXT_PUBLIC_VAPID_PUBLIC_KEY
   VAPID_PRIVATE_KEY
   VAPID_SUBJECT
   ```

   Astuce : vous pouvez coller tout le contenu de votre `.env.local` d'un coup dans le premier champ.
5. Cliquez sur **Deploy**. Environ 1 minute plus tard, vous avez une adresse du type `https://a-table-xxxx.vercel.app`.
6. Facultatif : dans **Settings → Functions → Function Region**, choisissez **Paris (cdg1)** pour être au plus près de Supabase.

À chaque `git push` sur la branche principale, Vercel redéploie automatiquement.

> Vous modifiez une variable plus tard ? Il faut **redéployer** (onglet **Deployments**, menu ⋯ → **Redeploy**) pour qu'elle soit prise en compte.
> Les variables `NEXT_PUBLIC_…` sont intégrées au moment du build.

---

## 6. Installer l'appli sur un iPhone et activer les notifications

Il faut **iOS 16.4 ou plus récent** (Réglages → Général → Informations → Version iOS).

À faire sur **chaque** iPhone de la famille :

1. Ouvrez l'adresse Vercel dans **Safari** (pas Chrome : seul Safari permet l'installation sur iPhone).
2. Touchez **« Commencer »**, donnez votre prénom et combien vous êtes à table : Kaddie propose un repas pour ce soir, et son caddie se remplit.
   Sur l'écran **Ce soir**, le bouton de partage envoie à la famille un message prêt (le plat, la liste déjà faite) avec un lien d'invitation : chacun donne son prénom, sans code.
3. Sur l'écran **Caddie**, la carte « Garde Kaddie sur ton écran d'accueil » donne les trois gestes et **le code de la famille** (exemple : `paella-6024-lasagne`).
   Touchez le bouton **Partager** (le carré avec une flèche vers le haut ⬆︎), puis **« Sur l'écran d'accueil »**, puis **Ajouter**.
4. **Fermez Safari** et ouvrez l'appli **depuis sa nouvelle icône** 🍽️. Touchez **« J'ai déjà un code »**, tapez le code (une seule fois), puis choisissez votre prénom.
5. Touchez la cloche 🔔 de l'écran Caddie (**« Activer les notifs »**), puis **Autoriser**.
6. Pour vérifier : ⚙️ (en haut à droite) → **Tester**. Une notification doit arriver.

Points importants sur iPhone :

- L'appli installée et Safari ne partagent pas leur mémoire. Il faut donc saisir le code **dans l'appli installée**, pas dans Safari.
- Les notifications ne marchent **que** dans l'appli installée. Pour cette raison, la demande d'autorisation ne s'affiche jamais toute seule : elle part toujours de ce bouton.
- Si vous avez touché « Ne pas autoriser » : **Réglages de l'iPhone → Notifications → Kaddie** → activez **Autoriser les notifications**.
- Un mauvais profil a été choisi sur un téléphone ? ⚙️ → **« Ce n'est pas moi »**.

---

## 7. Personnaliser

### Remplacer les recettes d'exemple

Depuis l'appli, dans l'onglet **Recettes**, vous pouvez :
- **ajouter** une recette (nom, emoji, photo, ingrédients avec quantité, unité et rayon) ;
- **modifier** une recette ;
- **supprimer** une recette.

Les photos prises avec l'iPhone sont réduites automatiquement avant l'envoi.

Conseils pour une liste de courses bien fusionnée :
- Utilisez les mêmes noms d'une recette à l'autre (« Oignon » et « Oignons » sont reconnus comme le même article).
- Les unités `g`/`kg` et `ml`/`cl`/`l` s'additionnent entre elles. Laissez l'unité vide pour compter à la pièce.

### Gérer les membres et le code

Tout se fait dans l'appli, ⚙️ → **Ma famille** :
- ajouter, modifier (prénom) ou retirer un membre ;
- renommer la famille ;
- **partager** le code, ou en **changer** (l'ancien ne permet plus de rejoindre la famille ; les téléphones déjà connectés le restent).


---

## 8. Dépannage

| Problème | Solution |
|---|---|
| Pas de bouton « Activer les notifications », mais un message d'installation | L'appli est ouverte dans Safari : ouvrez-la depuis l'icône de l'écran d'accueil. |
| « Tester » ne fait rien | Vérifiez les 3 variables VAPID dans Vercel, puis redéployez. Ensuite, sur le téléphone : ⚙️ → Désactiver, puis réactivez. |
| Les écrans ne se mettent pas à jour tout seuls | Vérifiez l'option *Realtime → Settings → Allow public access*. Sans elle, l'appli se rafraîchit quand même toutes les 2 minutes et à chaque retour dans l'appli. |
| « Variable d'environnement manquante » | Une variable manque dans Vercel. Ajoutez-la, puis redéployez. |
| L'appli affiche une ancienne version | Fermez-la complètement (glisser vers le haut) puis rouvrez-la. |
| L'envoi d'une photo échoue | Vérifiez que le bucket `recipe-photos` existe dans Supabase (Storage). Sinon, relancez la migration. |

---

## 9. Pour les développeurs

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm test           # tests unitaires (Vitest) : recommandation, liste et quantités, allergènes (55 plats d'essai), import, heures, session
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run vapid      # nouvelle paire de clés VAPID
npm run icons      # régénère les icônes depuis scripts/generate-icons.mjs
```

À chaque envoi, GitHub lance types, règles de code, tests unitaires et compilation (`.github/workflows/controles.yml`).
Les scénarios de bout en bout (plusieurs téléphones, pannes d'écriture, formats d'écran) sont dans `tests/e2e/` : ils demandent
PostgreSQL et PostgREST en local, voir `tests/e2e/README.md`.

### Organisation

```
src/
  middleware.ts          # famille rejointe, profil choisi, anciennes adresses
  app/
    bienvenue/ profil/   # saisie du code puis choix du profil
    (appli)/             # Envies (swipe) · Menu · Courses (la liste) · Ce soir · Notre année
    famille/             # membres, code de la famille
    bienvenue/creer/     # création d'une famille
    recettes/            # liste + formulaire de recette
    reglages/            # notifications, changement de profil
    actions/             # server actions : toutes les écritures en base
    api/push/            # abonnement et test des notifications
    manifest.ts          # manifeste PWA
  lib/
    domain/              # logique pure et testée (liste, swipe, heures)
    data.ts views.ts     # lectures en base (côté serveur uniquement)
    push.ts notifications.ts
    session.ts auth.ts   # cookie de session signé (HMAC)
  components/
public/
  sw.js                  # service worker : push, clic sur notification, hors connexion
  icons/ offline.html
supabase/
  migrations/            # schéma SQL
  seed.sql               # famille de démonstration (facultatif)
```

### Modèle de données

- `families` : chaque famille et son code pour la rejoindre
- `families.strict_dislikes` : le mode strict des goûts (vrai par défaut)
- `families.foyer` : le nombre de personnes à table d'habitude (de 1 à 12), demandé à la création ; les quantités de la liste en partent
- `ce_soir_choix` : le plat retenu pour ce soir, un par famille et par jour ; `rang` (combien d'idées écartées avec « Autre idée » ce jour-là avant « Ce sera ça ») et `raison` (la ligne affichée sous le plat : `achete`, `envie`, `classique_jour`, `adore`, `classique`, `aime`, `pas_fait` ou `idee`), gardés pour la mesure
- `parcours_etapes` : des compteurs anonymes de l'entrée dans l'appli (voir « Mesurer le début »), sans identifiant ni famille
- `profiles` : les membres d'une famille, avec les dates du questionnaire de goûts (`tastes_seen_at`, `tastes_done_at`)
- `profile_tastes` : les goûts de chacun (`food` = clé de `src/lib/domain/foods.ts` ou `autre:…`, `level` = `interdit` / `pas_fan` / `adore`)
- `recipes`, `recipe_ingredients` : nom, quantité, unité, rayon ; `recipes.source_url` pour les recettes importées de Marmiton
- `swipes` : le dernier swipe par profil et par recette (`swiped_at`, et `liked_at` : la dernière fois qu'on l'a aimé)
- `trip_recipes` : les plats d'une course (gardé ou non, `eaters` : qui le mange, `people` : invités compris) ; envies et matchs sont calculés dans `reco.ts` (la vue `active_matches` n'est plus utilisée)
- `shopping_trips` : une session de courses d'une famille, avec la personne qui la fait (heure limite, statut `open` → `validated` → `done`)
- `trip_requests` : la réponse de chaque fils (texte libre + recettes choisies)
- `trip_recipes` : les plats cochés par la personne qui fait les courses
- `shopping_list_items` : la liste (origine `recipe` / `manual` / `request`, coché ou non)
- `push_subscriptions` : un abonnement par appareil

### Mesurer le début

Pour voir où l'on s'arrête, Kaddie compte, **par jour**, combien de fois chaque étape est atteinte : `accueil` (page d'accueil affichée),
`famille_creee`, `premier_choix` (le premier « Ce sera ça » d'une famille), `liste_ouverte` (le Caddie ouvert pour la première fois sur un téléphone),
`invitation_envoyee` (le lien préparé pour la famille) et `invite_arrive` (quelqu'un rejoint par le lien). Un simple total : aucun identifiant, aucune famille, aucun prénom
(la page Confidentialité l'annonce). Pour les lire, dans le **SQL Editor** de Supabase :

```sql
select etape, sum(n) as fois from parcours_etapes where jour >= current_date - 7 group by etape order by fois desc;
```

Pour voir si l'on **revient**, d'autres totaux par jour, de la même façon : `ouverture_icone` (Kaddie ouverte depuis l'icône de l'écran d'accueil, une fois par visite),
`ouverture_notification` (ouverte par une notification : son adresse porte `?via=notification`, retiré aussitôt), `ouverture_lien` (un membre rouvre un lien partagé dans
le groupe), `ce_soir_affiche` (l'écran Ce soir, une fois par visite), `autre_idee` (une idée écartée), `prevenir_propose` (la question « Prévenir la famille ? » posée, une fois par jour et par
téléphone), `prevenir_oui` et `prevenir_plus_tard` (sa réponse). Même règle : aucun identifiant.

### Mesurer le retour

La décision du soir garde, sans rien dire de qui, `rang` (0 : la première proposition a plu) et `raison` (ce qui était écrit sous le plat). Dans le **SQL Editor** :

```sql
-- Les dîners décidés, selon la raison affichée : part décidée à la première proposition, et idées écartées en moyenne.
select raison, count(*) as diners, round(avg((rang = 0)::int) * 100) as pct_premiere_proposition, round(avg(rang), 1) as ecartees
from ce_soir_choix where jour >= current_date - 28 and raison is not null group by raison order by diners desc;

-- Comment Kaddie est ouverte, et la question « Prévenir la famille ? » (7 jours).
select etape, sum(n) as fois from parcours_etapes
where jour >= current_date - 7 and etape in ('ouverture_icone', 'ouverture_notification', 'ouverture_lien', 'ce_soir_affiche', 'autre_idee', 'prevenir_propose', 'prevenir_oui', 'prevenir_plus_tard')
group by etape order by fois desc;
```

### La mémoire de la maison

Kaddie retient ce que la famille mange, sans qu'on le lui dise (règles : `src/lib/domain/memoire.ts`) :

- **Mangé sans « C'est fait »** : un dîner décidé (« Ce sera ça ») dont les courses sont faites compte comme mangé : la course terminée avec ce plat, au plus 10 jours avant ce soir-là ou jusqu'au lendemain ; ou, pour les deux derniers jours, la liste toute cochée. Le dîner d'aujourd'hui n'est jamais compté. La carte « C'était bon ? » du lendemain, les classiques et la liste des plats « à cuisiner » en profitent.
- **La ligne sous le plat** dit une seule raison, la plus vraie, datée quand la date est connue : « Déjà acheté aux dernières courses », l'envie de quelqu'un, « Votre classique du mardi », « Adoré il y a 3 semaines », « Un classique : 4 fois », « Tu l'avais aimé », « Pas fait depuis 12 jours », « Une idée de Kaddie ».
- **Un plat aimé et déjà mangé** (pas depuis une semaine) passe devant une idée neuve, jamais devant une envie ni un plat déjà acheté.
- **Prévenir la famille ?** : juste après « Ce sera ça », une ligne d'un appui ouvre le message prêt (le plat, la liste faite, et « comme Karin le voulait » si quelqu'un en avait envie). Elle ne revient pas pour ce dîner ; sur l'écran de Karin : « ton envie ».
- **Un lien partagé** n'expire jamais pour un membre de la famille : il arrive sur Ce soir, même au bout de 7 jours.
- **« À ajouter ? »** : aux deux premières courses, le groupe « La dernière fois » propose ce qui a été acheté à la main à la course précédente (ensuite, ce sont « Tes habituels »).

### Temps réel

Après chaque écriture, le serveur envoie un **broadcast** Supabase vide sur le canal de la famille (`famille-<id>`).
Les écrans ouverts reçoivent ce signal et rechargent leurs données côté serveur (`router.refresh()`).
Il y a aussi un rafraîchissement de secours toutes les 2 minutes (seulement quand le temps réel est coupé) et au retour au premier plan après 30 s d'absence.
