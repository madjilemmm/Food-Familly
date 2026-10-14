# 🛒 Kaddie

La petite appli familiale pour choisir les repas et faire les courses sans prise de tête.
Chaque famille crée son espace, ajoute ses membres et partage un code. Ensuite, **n'importe qui** peut faire les courses :

- **Celui ou celle qui part** l'annonce en 2 taps. Les autres sont prévenus, il voit leurs réponses en direct, coche les plats, et la liste de courses se fait toute seule, triée par rayon.
- **Tout le monde** swipe des recettes comme sur une appli de rencontre. Quand la **majorité de la famille** like le même plat, c'est un **match**. Quand quelqu'un part, les autres répondent avec du texte libre et/ou des matchs.
- Chacun choisit son **style d'interface** : **simple** (très gros boutons, l'essentiel) ou **fun** (animé).

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
| Familles | Au premier lancement : **« Créer ma famille »** (nom, membres, style de chacun) ou **« J'ai un code famille »**. Chaque famille a ses propres membres, recettes, matchs et listes, invisibles des autres. Une nouvelle famille reçoit 10 recettes de départ. |
| Connexion | Le code famille est saisi une seule fois, puis on choisit son prénom (ou « Je ne suis pas dans la liste »). C'est retenu sur le téléphone pendant plus d'un an. |
| Qui fait les courses | N'importe quel membre. Une seule course à la fois par famille : les autres voient « X part dans… » et lui envoient leurs demandes. Tout le monde peut consulter et compléter la liste. |
| Départ en courses | Choix : 30 min, 1 h, 2 h ou « ce soir, 18 h ». Ce dernier choix disparaît après 17 h. |
| Heure limite dépassée | Si personne n'a répondu, la personne qui fait les courses voit automatiquement les plats matchés. C'est calculé à l'affichage, sans tâche planifiée. Elle n'attend jamais personne : elle peut faire sa liste à tout moment. |
| Match | Une recette likée par **plus de la moitié** de la famille dans les 14 derniers jours (2 sur 3, 3 sur 4, 3 sur 5…). |
| Paquet de swipe | Une recette swipée revient dans le paquet 14 jours plus tard, donc il ne s'épuise jamais. |
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
   Chaque fichier ne se lance qu'une seule fois, dans cet ordre.

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
2. Touchez le bouton **Partager** (le carré avec une flèche vers le haut ⬆︎).
3. Faites défiler et touchez **« Sur l'écran d'accueil »**, puis **Ajouter**.
4. **Fermez Safari** et ouvrez l'appli **depuis sa nouvelle icône** 🍽️ sur l'écran d'accueil.
5. La première personne touche **« Créer ma famille »** et ajoute tous les membres. Elle obtient un **code famille** (exemple : `paella-6024-lasagne`) à partager avec le bouton 📤.
   Les autres touchent **« J'ai un code famille »**, saisissent ce code puis leur prénom.
6. Touchez le bouton **« Activer les notifications »**, puis **Autoriser**.
7. Pour vérifier : ⚙️ (en haut à droite) → **Tester**. Une notification doit arriver.

Points importants sur iPhone :

- L'appli installée et Safari ne partagent pas leur mémoire. Il faut donc saisir le code **dans l'appli installée**, pas dans Safari.
- Les notifications ne marchent **que** dans l'appli installée. Pour cette raison, la demande d'autorisation ne s'affiche jamais toute seule : elle part toujours de ce bouton.
- Si vous avez touché « Ne pas autoriser » : **Réglages de l'iPhone → Notifications → Kaddie** → activez **Autoriser les notifications**.
- Un mauvais profil a été choisi sur un téléphone ? ⚙️ → **« Ce n'est pas moi »**.

---

## 7. Personnaliser

### Remplacer les recettes d'exemple

Depuis l'appli, dans l'onglet **Recettes** (style fun) ou **Plats → Gérer mes recettes** (style simple), vous pouvez :
- **ajouter** une recette (nom, emoji, photo, ingrédients avec quantité, unité et rayon) ;
- **modifier** une recette ;
- **supprimer** une recette.

Les photos prises avec l'iPhone sont réduites automatiquement avant l'envoi.

Conseils pour une liste de courses bien fusionnée :
- Utilisez les mêmes noms d'une recette à l'autre (« Oignon » et « Oignons » sont reconnus comme le même article).
- Les unités `g`/`kg` et `ml`/`cl`/`l` s'additionnent entre elles. Laissez l'unité vide pour compter à la pièce.

### Gérer les membres, le style et le code

Tout se fait dans l'appli, ⚙️ → **Ma famille** :
- ajouter, modifier (prénom, emoji, style) ou retirer un membre ;
- renommer la famille ;
- **partager** le code, ou en **changer** (l'ancien ne permet plus de rejoindre la famille ; les téléphones déjà connectés le restent).

Chacun peut aussi changer son propre style dans ⚙️ → **Style de l'appli** : l'interface bascule tout de suite.

---

## 8. Dépannage

| Problème | Solution |
|---|---|
| Pas de bouton « Activer les notifications », mais un message d'installation | L'appli est ouverte dans Safari : ouvrez-la depuis l'icône de l'écran d'accueil. |
| « Tester » ne fait rien | Vérifiez les 3 variables VAPID dans Vercel, puis redéployez. Ensuite, sur le téléphone : ⚙️ → Désactiver, puis réactivez. |
| Les écrans ne se mettent pas à jour tout seuls | Vérifiez l'option *Realtime → Settings → Allow public access*. Sans elle, l'appli se rafraîchit quand même toutes les 30 secondes et à chaque retour dans l'appli. |
| « Variable d'environnement manquante » | Une variable manque dans Vercel. Ajoutez-la, puis redéployez. |
| L'appli affiche une ancienne version | Fermez-la complètement (glisser vers le haut) puis rouvrez-la. |
| L'envoi d'une photo échoue | Vérifiez que le bucket `recipe-photos` existe dans Supabase (Storage). Sinon, relancez la migration. |

---

## 9. Pour les développeurs

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm test           # tests unitaires (Vitest) : fusion de liste, paquet de swipe, heures de Paris, session
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run vapid      # nouvelle paire de clés VAPID
npm run icons      # régénère les icônes depuis scripts/generate-icons.mjs
```

### Organisation

```
src/
  middleware.ts          # famille rejointe, profil choisi, style simple/fun
  app/
    bienvenue/ profil/   # saisie du code puis choix du profil
    simple/              # style simple : Courses · Plats · Liste · J'aime
    fun/                 # style fun : Swipe · Matchs · Courses · Liste
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
- `profiles` : les membres d'une famille, avec leur style `simple` ou `fun`
- `recipes`, `recipe_ingredients` : nom, quantité, unité, rayon
- `swipes` : un swipe par profil et par recette, daté (expiration après 14 jours)
- vue `active_matches` : recettes likées par la majorité de la famille il y a moins de 14 jours
- `shopping_trips` : une session de courses d'une famille, avec la personne qui la fait (heure limite, statut `open` → `validated` → `done`)
- `trip_requests` : la réponse de chaque fils (texte libre + recettes choisies)
- `trip_recipes` : les plats cochés par la personne qui fait les courses
- `shopping_list_items` : la liste (origine `recipe` / `manual` / `request`, coché ou non)
- `push_subscriptions` : un abonnement par appareil

### Temps réel

Après chaque écriture, le serveur envoie un **broadcast** Supabase vide sur le canal de la famille (`famille-<id>`).
Les écrans ouverts reçoivent ce signal et rechargent leurs données côté serveur (`router.refresh()`).
Il y a aussi un rafraîchissement de secours toutes les 30 s et au retour au premier plan.
