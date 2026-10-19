"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { deleteItem, restoreItem } from "@/app/actions/list";
import { finishTrip } from "@/app/actions/trips";
import { groupByAisle } from "@/lib/domain/aisles";
import { articlesDe, lireArticle, type Article } from "@/lib/domain/articles";
import { formatQuantity } from "@/lib/domain/shopping-list";
import { attendreFile, mettreEnAttente, nouvelId, retirerDeLAttente, useAttente, type Entree } from "@/lib/attente";
import type { ListItem } from "@/lib/data";
import { IconeCroix, IconePlus } from "@/components/ui";
import { ConfirmButton } from "./ConfirmButton";
import { useAnnuler } from "@/components/Annuler";
import { useErreurReseau } from "@/components/ErreurReseau";

type Ajout = Entree & { sorte: "ajouter" };
type Coche = Entree & { sorte: "cocher" };

/**
 * La liste en magasin. Cocher et ajouter passent par la file d'attente du téléphone
 * (lib/attente) : l'écran change tout de suite, même sans réseau, et tout part dès que
 * possible. Sans réseau, ce qui n'est pas encore parti est marqué « En attente ».
 */
export function ShoppingList({
  tripId,
  items,
  requests,
}: {
  tripId: string;
  items: ListItem[];
  requests: { id: string; from: string; text: string }[];
}) {
  const [, startTransition] = useTransition();
  const proposer = useAnnuler();
  const { essayer, alerte } = useErreurReseau();
  const inputRef = useRef<HTMLInputElement>(null);
  const { entrees, horsLigne } = useAttente();
  const enLigne = useEnLigne();
  const sansReseau = horsLigne || !enLigne;

  // La liste du serveur, plus ce que le téléphone n'a pas encore pu envoyer.
  // Les ingrédients qu'on a déjà à la maison ne s'affichent plus.
  const visibles = items.filter((i) => i.source !== "maison");
  const miennes = entrees.filter((e): e is Ajout | Coche => e.sorte !== "swipe" && e.trip === tripId);
  const coches = new Map(miennes.filter((e): e is Coche => e.sorte === "cocher").map((e) => [e.id, e.checked]));
  const connus = new Set(visibles.map((i) => i.id));
  const ajouts = miennes.filter((e): e is Ajout => e.sorte === "ajouter" && !connus.has(e.id));
  const enAttente = new Set(miennes.filter((e) => !e.envoyee).map((e) => e.id));
  const base: ListItem[] = [
    ...visibles.map((i) => (coches.has(i.id) ? { ...i, checked: coches.get(i.id)! } : i)),
    ...ajouts.map((a) => ({ ...a.article, id: a.id, source: a.source, for_recipes: null, checked: coches.get(a.id) ?? false, created_at: a.le })),
  ];
  const [list, retirer] = useOptimistic(base, (state, id: string) => state.filter((i) => i.id !== id));

  const cocher = (item: ListItem) => mettreEnAttente({ sorte: "cocher", trip: tripId, id: item.id, checked: !item.checked });

  const add = (articles: Article[], source: "manual" | "request") => {
    for (const article of articles) {
      mettreEnAttente({
        sorte: "ajouter",
        trip: tripId,
        id: nouvelId(),
        texte: [article.quantity ?? "", article.unit, article.name].filter(Boolean).join(" "),
        source,
        article,
        le: new Date().toISOString(),
      });
    }
  };

  const supprimer = (item: ListItem) => {
    // Pas encore parti (ajouté hors connexion) : il suffit de l'oublier.
    const jamaisParti = miennes.some((e) => e.sorte === "ajouter" && e.id === item.id && !e.envoyee);
    retirerDeLAttente([`ajouter:${item.id}`, `cocher:${item.id}`]);
    if (jamaisParti) {
      proposer(`${item.name} retiré`, () => add([{ name: item.name, quantity: item.quantity, unit: item.unit, aisle: item.aisle }], item.source as "manual" | "request"));
      return;
    }
    startTransition(async () => {
      // Un ingrédient de recette ou un article demandé est gardé de côté : il ne revient pas.
      const deCote = item.source === "recipe" || item.source === "request";
      retirer(item.id);
      if (!(await essayer(() => deleteItem(item.id, deCote)))) return;
      // Retiré par erreur ? Il revient d'un geste.
      proposer(item.source === "recipe" ? `${item.name} : déjà à la maison` : `${item.name} retiré`, () =>
        deCote
          ? startTransition(async () => {
              await essayer(() => restoreItem(item.id, item.source as "recipe" | "request"));
            })
          : add([{ name: item.name, quantity: item.quantity, unit: item.unit, aisle: item.aisle }], item.source as "manual" | "request"),
      );
    });
  };

  // Une demande écrite (« des pâtes, du Nutella ») devient un article par chose demandée.
  const alreadyAdded = new Set(list.filter((i) => i.source === "request").map((i) => i.name.trim().toLowerCase()));
  const pendingRequests = requests
    .map((r) => ({ ...r, articles: articlesDe(r.text) }))
    .filter((r) => r.articles.some((a) => !alreadyAdded.has(a.name.toLowerCase())));
  // Demandés ou ajoutés à la main et pas pris : reportés sur les prochaines courses.
  const restants = list.filter((i) => !i.checked && i.source !== "recipe").length;
  const done = list.filter((i) => i.checked).length;
  const nbEnAttente = miennes.filter((e) => !e.envoyee).length;
  // Les rayons dans l'ordre du parcours en magasin ; un rayon terminé passe en bas.
  // Dans chaque rayon, ce qui reste à prendre en haut, ce qui est pris en bas.
  const groups = groupByAisle(list)
    .map((g) => ({
      ...g,
      done: g.items.every((i) => i.checked),
      items: [...g.items].sort((a, b) => Number(a.checked) - Number(b.checked)),
    }))
    .sort((a, b) => Number(a.done) - Number(b.done));

  const racine = useRef<HTMLDivElement>(null);
  useGlissement(racine);
  useGarderPourHorsLigne(items);

  return (
    <div ref={racine}>
      {sansReseau && (
        <p role="status" className="mb-5 flex items-center gap-3 rounded-bouton bg-aubergine px-4 py-3 text-petit leading-snug font-semibold text-blanc">
          <IconeHorsLigne />
          <span>
            {nbEnAttente > 0
              ? `Hors connexion. ${nbEnAttente} changement${nbEnAttente > 1 ? "s" : ""} en attente : ${nbEnAttente > 1 ? "ils partiront" : "il partira"} tout seul${nbEnAttente > 1 ? "s" : ""} au retour du réseau.`
              : "Hors connexion : la liste reste utilisable, tes changements partiront au retour du réseau."}
          </span>
        </p>
      )}

      {list.length > 0 && (
        <div className="mb-6">
          <p className="kd-etiquette mb-2">
            {done === list.length ? "Tout est dans le caddie" : `${done} sur ${list.length} dans le caddie`}
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-trait">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${(done / list.length) * 100}%` }} />
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <section className="mb-6">
          <h2 className="kd-etiquette">Demandé par la famille</h2>
          <ul className="kd-liste">
            {pendingRequests.map((r) => (
              <li key={r.id} className="kd-liste__article gap-3 py-2">
                <span className="flex-1">
                  <strong>{r.from}</strong>&nbsp;: « {r.text} »
                </span>
                <button
                  onClick={() => add(r.articles.filter((a) => !alreadyAdded.has(a.name.toLowerCase())), "request")}
                  className="kd-btn kd-btn--like min-h-12 shrink-0 px-4"
                >
                  {r.articles.length > 1 ? `Ajouter (${r.articles.length})` : "Ajouter"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const article = lireArticle(inputRef.current?.value ?? "");
          if (article) add([article], "manual");
          // Le clavier reste ouvert pour enchaîner les articles.
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          name="article"
          aria-label="Ajouter un article"
          placeholder="Ajouter un article…"
          // Pas de nom ni de contact proposé au-dessus du clavier : c'est un article.
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          className="kd-champ min-w-0 flex-1"
        />
        <button type="submit" aria-label="Ajouter l'article" className="kd-btn kd-btn--secondaire w-14 shrink-0 px-0">
          <IconePlus />
        </button>
      </form>

      {list.length === 0 && <p className="text-center text-encre-douce">La liste est vide.</p>}

      {groups.map((group) => (
        <section key={group.id} data-glisse={`rayon-${group.id}`} className="mb-6">
          <h2 className="kd-etiquette flex items-center gap-2">
            {group.label}
            {group.done && <span className="kd-pastille kd-pastille--match ml-auto">Fini</span>}
          </h2>
          <ul className="kd-liste">
            {group.items.map((item) => (
              // Un article coché glisse en bas de son rayon (useGlissement).
              <li key={item.id} data-glisse={item.id} className="kd-liste__article">
                <button
                  type="button"
                  aria-pressed={item.checked}
                  onClick={() => cocher(item)}
                  className="flex min-h-14 flex-1 items-center gap-3 py-2 text-left"
                >
                  <span
                    aria-hidden
                    className={`grid size-7 shrink-0 place-content-center rounded-pastille border-[3px] border-aubergine transition-[background-color,transform] duration-240 ease-rebond ${
                      item.checked ? "scale-108 bg-accent text-on-accent" : "bg-surface"
                    }`}
                  >
                    {item.checked && (
                      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                        <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex-1 ${item.checked ? "text-encre-douce line-through decoration-2" : ""}`}>
                    {item.name}
                    {item.quantity != null || item.unit ? (
                      <span className="ml-1 text-encre-douce">({formatQuantity(item.quantity, item.unit)})</span>
                    ) : null}
                    {item.for_recipes && <span className="kd-petit block no-underline">pour {item.for_recipes}</span>}
                  </span>
                  {sansReseau && enAttente.has(item.id) && <span className="kd-pastille shrink-0">En attente</span>}
                </button>
                {/* Tout se retire : un ingrédient de recette qu'on a déjà ne revient pas à la mise à jour. */}
                <button
                  type="button"
                  aria-label={`Retirer ${item.name}`}
                  onClick={() => supprimer(item)}
                  className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                >
                  <IconeCroix className="size-6" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.length > 0 && (
        <div className="mt-8">
          <ConfirmButton
            action={async () => {
              // Les dernières coches partent d'abord : le report des articles pas pris en dépend.
              await attendreFile();
              await finishTrip();
            }}
            question="Les courses sont finies ?"
            detail={
              restants > 0
                ? `${restants} article${restants > 1 ? "s" : ""} pas pris : ${restants > 1 ? "ils passeront" : "il passera"} dans la prochaine liste.`
                : "La liste sera effacée pour toute la famille."
            }
            confirmLabel="Oui, c'est fini"
            apres="/courses"
            className="kd-btn kd-btn--large"
          >
            J&apos;ai fini les courses
          </ConfirmButton>
        </div>
      )}
      {alerte}
    </div>
  );
}

function IconeHorsLigne() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

/** Le téléphone dit-il avoir du réseau ? (Le vrai test reste l'envoi : FileAttente.) */
function useEnLigne() {
  const [enLigne, setEnLigne] = useState(true);
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);
  return enLigne;
}

/**
 * Les lignes (et les rayons) qui changent de place glissent vers leur nouvelle place ;
 * une ligne qui arrive apparaît en fondu. Seules les lignes qui bougent sont animées,
 * sans bibliothèque : cocher reste instantané, même sur un téléphone modeste.
 */
function useGlissement(racine: React.RefObject<HTMLDivElement | null>) {
  const places = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el) return;
    const mesurer = () =>
      new Map([...el.querySelectorAll<HTMLElement>("[data-glisse]")].map((n) => [n.dataset.glisse!, n.getBoundingClientRect().top + window.scrollY]));
    // À l'arrivée sur l'écran, rien n'est animé : on relève les places juste après l'affichage,
    // sans retarder l'ouverture de l'onglet.
    if (!places.current) {
      const id = requestAnimationFrame(() => (places.current = mesurer()));
      return () => cancelAnimationFrame(id);
    }
    const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const avant = places.current;
    const nouvelles = mesurer();
    if (!calme) {
      for (const n of el.querySelectorAll<HTMLElement>("[data-glisse]")) {
        const y = nouvelles.get(n.dataset.glisse!)!;
        const y0 = avant.get(n.dataset.glisse!);
        if (y0 === undefined) n.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
        else if (Math.abs(y0 - y) > 1)
          n.animate([{ transform: `translateY(${y0 - y}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      }
    }
    places.current = nouvelles;
  });
}

/** Garde la dernière liste sur le téléphone (service worker) pour la rouvrir sans réseau. */
let gardeeLe = 0;
function useGarderPourHorsLigne(items: ListItem[]) {
  useEffect(() => {
    if (!navigator.onLine || Date.now() - gardeeLe < 30_000) return;
    const t = setTimeout(() => {
      navigator.serviceWorker?.controller?.postMessage({ type: "garder-liste" });
      gardeeLe = Date.now();
    }, 2000);
    return () => clearTimeout(t);
  }, [items]);
}
