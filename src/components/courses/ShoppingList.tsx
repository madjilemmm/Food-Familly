"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { apprendreArticle, corrigerArticle, deleteItem, restoreItem } from "@/app/actions/list";
import { finishTrip } from "@/app/actions/trips";
import { groupByAisle, isAisle } from "@/lib/domain/aisles";
import { articlesDe, type Article } from "@/lib/domain/articles";
import { cleApprise, cleProduit, lireSaisie, type Appris, type Lecture } from "@/lib/domain/reconnaissance";
import { formatQuantity } from "@/lib/domain/shopping-list";
import { attendreFile, mettreEnAttente, nouvelId, retirerDeLAttente, useAttente, type Entree } from "@/lib/attente";
import type { ListItem } from "@/lib/data";
import { IconeCroix, IconePlus } from "@/components/ui";
import { ConfirmButton } from "./ConfirmButton";
import { useAnnuler } from "@/components/Annuler";
import { useErreurReseau } from "@/components/ErreurReseau";

type Ajout = Entree & { sorte: "ajouter" };
type Coche = Entree & { sorte: "cocher" };
/** Sous le champ : « Lequel ? » (mot ambigu, faute possible), ou « déjà sur la liste ». */
type Aide = { id: string; saisie: string; lecture: Lecture } | { deja: string };

const enArticle = (l: Lecture): Article => ({ name: l.nom.slice(0, 100), quantity: l.quantite, unit: l.unite, aisle: l.rayon });

/**
 * La liste en magasin. Cocher et ajouter passent par la file d'attente du téléphone
 * (lib/attente) : l'écran change tout de suite, même sans réseau, et tout part dès que
 * possible. Sans réseau, ce qui n'est pas encore parti est marqué « En attente ».
 */
export function ShoppingList({
  tripId,
  items,
  requests,
  appris: apprisServeur = {},
}: {
  tripId: string;
  items: ListItem[];
  requests: { id: string; from: string; text: string }[];
  /** Ce que la famille a appris à Kaddie (« Kinder » = Kinder Bueno chez nous). */
  appris?: Appris;
}) {
  const [aide, setAide] = useState<Aide | null>(null);
  // Ce que la famille vient d'apprendre à Kaddie compte tout de suite, sans attendre le serveur.
  const [apprisIci, setApprisIci] = useState<Appris>({});
  const appris = { ...apprisServeur, ...apprisIci };
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

  const add = (articles: Article[], source: "manual" | "request", id?: string) =>
    articles.map((article) => {
      const nouveau = id ?? nouvelId();
      mettreEnAttente({
        sorte: "ajouter",
        trip: tripId,
        id: nouveau,
        texte: [article.quantity ?? "", article.unit, article.name].filter(Boolean).join(" "),
        source,
        article,
        le: new Date().toISOString(),
      });
      return nouveau;
    });

  // Corriger un article qu'on vient d'ajouter : encore sur le téléphone, on remplace ;
  // déjà parti, on le corrige sur le serveur.
  const remplacer = (id: string, article: Article) => {
    const enFile = miennes.some((e) => e.sorte === "ajouter" && e.id === id && !e.envoyee);
    if (enFile) add([article], "manual", id);
    else startTransition(async () => void (await essayer(() => corrigerArticle(id, article))));
  };
  const apprendre = (saisie: string, choix: Parameters<typeof apprendreArticle>[1]) => {
    const rayon = choix !== "tel-quel" && isAisle(choix.rayon) ? choix.rayon : null;
    setApprisIci((a) => ({ ...a, [cleApprise(saisie)]: choix === "tel-quel" || !rayon ? "tel-quel" : { nom: choix.nom, rayon, produit: choix.produit } }));
    startTransition(async () => void (await apprendreArticle(saisie, choix).catch(() => {})));
  };

  const ajouterSaisie = (valeur: string) => {
    const lecture = lireSaisie(valeur, appris);
    if (!lecture) return;
    // Le même produit, ajouté ou demandé et pas encore pris : on ne le met pas deux fois.
    // (Le lait d'une recette et le lait de la maison sont deux besoins : une seule ligne, regroupée.)
    const deja = list.find((i) => !i.checked && i.source !== "recipe" && cleProduit(i.name, appris) === lecture.cle);
    if (deja) return setAide({ deja: deja.name });
    const tel = { name: valeur.trim().charAt(0).toUpperCase() + valeur.trim().slice(1), quantity: null, unit: "", aisle: lecture.rayon };
    const [id] = add([enArticle(lecture)], "manual");
    setAide(lecture.choix?.length ? { id, saisie: valeur, lecture } : null);
    // Faute corrigée (« chocapik » → Chocapic) : on le dit, et on peut revenir à ce qui a été tapé.
    if (lecture.confiance === "probable" && lecture.corrige) {
      proposer(`${lecture.nom} (tu as tapé « ${valeur.trim()} »)`, () => {
        remplacer(id, { ...tel, quantity: lecture.quantite, unit: lecture.unite });
        apprendre(valeur, "tel-quel");
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
    .map((r) => ({ ...r, articles: articlesDe(r.text, appris) }))
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
          ajouterSaisie(inputRef.current?.value ?? "");
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
          onChange={() => aide && setAide(null)}
          className="kd-champ min-w-0 flex-1"
        />
        <button type="submit" aria-label="Ajouter l'article" className="kd-btn kd-btn--secondaire w-14 shrink-0 px-0">
          <IconePlus />
        </button>
      </form>

      {aide && "deja" in aide && (
        <p role="status" className="-mt-3 mb-6 font-semibold text-violet">
          {aide.deja} est déjà sur la liste.
        </p>
      )}
      {aide && "lecture" in aide && (
        // Rien ne bloque : l'article est déjà ajouté tel quel, un appui le précise.
        <div role="group" aria-label={`Préciser ${aide.lecture.nom}`} className="-mt-3 mb-6">
          <p className="kd-petit mb-2">{aide.lecture.choix!.length > 1 ? "Lequel ?" : "Tu voulais dire :"}</p>
          <div className="flex flex-wrap gap-2">
            {aide.lecture.choix!.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  remplacer(aide.id, { name: c.nom, quantity: aide.lecture.quantite, unit: aide.lecture.unite, aisle: c.rayon });
                  apprendre(aide.saisie, { nom: c.nom, rayon: c.rayon, produit: c.id });
                  setAide(null);
                  inputRef.current?.focus();
                }}
                className="min-h-11 rounded-bouton border-[3px] border-aubergine bg-surface px-3 font-semibold text-aubergine active:scale-95"
              >
                {c.nom}
              </button>
            ))}
            <button type="button" onClick={() => setAide(null)} className="min-h-11 px-2 text-encre-douce underline underline-offset-4">
              Laisser
            </button>
          </div>
        </div>
      )}

      {list.length === 0 && <p className="text-center text-encre-douce">La liste est vide.</p>}

      {groups.map((group) => (
        <section key={group.id} data-glisse={`rayon-${group.id}`} className="mb-6">
          <h2 className="kd-etiquette flex items-center gap-2">
            {group.label}
            {group.done && <span className="kd-pastille kd-pastille--match ml-auto">Fini</span>}
          </h2>
          <ul className="kd-liste">
            {regrouper(group.items, appris).map((ligne) =>
              ligne.length === 1 ? (
                // Un article coché glisse en bas de son rayon (useGlissement).
                <li key={ligne[0].id} data-glisse={ligne[0].id} className="kd-liste__article">
                  <BoutonCoche
                    coche={ligne[0].checked}
                    onClick={() => cocher(ligne[0])}
                    nom={ligne[0].name}
                    quantite={ligne[0].quantity != null || ligne[0].unit ? formatQuantity(ligne[0].quantity, ligne[0].unit) : null}
                    detail={provenance(ligne[0])}
                    enAttente={sansReseau && enAttente.has(ligne[0].id)}
                  />
                  {/* Tout se retire : un ingrédient de recette qu'on a déjà ne revient pas à la mise à jour. */}
                  <button
                    type="button"
                    aria-label={`Retirer ${ligne[0].name}`}
                    onClick={() => supprimer(ligne[0])}
                    className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                  >
                    <IconeCroix className="size-6" />
                  </button>
                </li>
              ) : (
                // Le même produit pour plusieurs raisons (recette, habituel, demande) : une ligne,
                // chaque besoin garde sa quantité ; cocher la ligne coche tout.
                <LigneRegroupee
                  key={ligne[0].id}
                  besoins={ligne}
                  enAttente={sansReseau && ligne.some((i) => enAttente.has(i.id))}
                  onCocher={(coche) => ligne.forEach((i) => i.checked !== coche && cocher(i))}
                  onRetirer={supprimer}
                />
              ),
            )}
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
                ? `${restants} article${restants > 1 ? "s" : ""} pas pris : Kaddie ${restants > 1 ? "les" : "le"} proposera aux prochaines courses.`
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

/** D'où vient un article, en petit sous son nom. */
function provenance(item: ListItem): string | null {
  if (item.for_recipes) return `pour ${item.for_recipes}`;
  if (item.origine === "habituel") return "habituel";
  if (item.origine === "reporte") return "pas pris la dernière fois";
  return null;
}

/** Regroupe les articles d'un rayon par produit (même identité), dans l'ordre de la liste. */
function regrouper(items: ListItem[], appris: Appris): ListItem[][] {
  const lignes = new Map<string, ListItem[]>();
  for (const item of items) {
    const cle = cleProduit(item.name, appris);
    lignes.set(cle, [...(lignes.get(cle) ?? []), item]);
  }
  // Une ligne regroupée n'est cochée que si tous ses besoins le sont : elle se range comme telle.
  return [...lignes.values()].sort((a, b) => Number(a.every((i) => i.checked)) - Number(b.every((i) => i.checked)));
}

function BoutonCoche({
  coche,
  onClick,
  nom,
  quantite,
  detail,
  enAttente,
}: {
  coche: boolean;
  onClick: () => void;
  nom: string;
  quantite: string | null;
  detail: string | null;
  enAttente: boolean;
}) {
  return (
    <button type="button" aria-pressed={coche} onClick={onClick} className="flex min-h-14 flex-1 items-center gap-3 py-2 text-left">
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-content-center rounded-pastille border-[3px] border-aubergine transition-[background-color,transform] duration-240 ease-rebond ${
          coche ? "scale-108 bg-accent text-on-accent" : "bg-surface"
        }`}
      >
        {coche && (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
          </svg>
        )}
      </span>
      <span className={`flex-1 ${coche ? "text-encre-douce line-through decoration-2" : ""}`}>
        {nom}
        {quantite && <span className="ml-1 text-encre-douce">({quantite})</span>}
        {detail && <span className="kd-petit block no-underline">{detail}</span>}
      </span>
      {enAttente && <span className="kd-pastille shrink-0">En attente</span>}
    </button>
  );
}

function LigneRegroupee({
  besoins,
  enAttente,
  onCocher,
  onRetirer,
}: {
  besoins: ListItem[];
  enAttente: boolean;
  onCocher: (coche: boolean) => void;
  onRetirer: (item: ListItem) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const tousCoches = besoins.every((i) => i.checked);
  const resume = besoins
    .map((i) => [i.quantity != null || i.unit ? formatQuantity(i.quantity, i.unit) : null, provenance(i)].filter(Boolean).join(" ") || "ajouté")
    .join(" · ");
  return (
    <li data-glisse={besoins[0].id} className="flex flex-col">
      <div className="kd-liste__article">
        <BoutonCoche coche={tousCoches} onClick={() => onCocher(!tousCoches)} nom={besoins[0].name} quantite={null} detail={resume} enAttente={enAttente} />
        <button
          type="button"
          aria-expanded={ouvert}
          aria-label={`Détail de ${besoins[0].name}`}
          onClick={() => setOuvert(!ouvert)}
          className="flex size-14 shrink-0 items-center justify-center text-violet"
        >
          <IconePlus className={`size-6 transition-transform ${ouvert ? "rotate-45" : ""}`} />
        </button>
      </div>
      {ouvert && (
        <ul className="mb-2 flex flex-col pl-10">
          {besoins.map((i) => (
            <li key={i.id} className="flex min-h-12 items-center gap-2">
              <span className={`flex-1 ${i.checked ? "text-encre-douce line-through" : ""}`}>
                {i.quantity != null || i.unit ? `${formatQuantity(i.quantity, i.unit)} · ` : ""}
                {provenance(i) ?? "ajouté à la main"}
              </span>
              <button
                type="button"
                aria-label={`Retirer ce besoin : ${i.name}${provenance(i) ? `, ${provenance(i)}` : ""}`}
                onClick={() => onRetirer(i)}
                className="flex size-12 shrink-0 items-center justify-center text-encre-douce"
              >
                <IconeCroix className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
