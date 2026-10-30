"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { swipe, undoSwipe, type SwipeAvant } from "@/app/actions/swipes";
import { lireAttente, mettreEnAttente, retirerDeLAttente } from "@/lib/attente";
import { estErreurReseau } from "@/lib/reseau";
import { BandeauAnnuler, useProposition } from "@/components/Annuler";
import { Bouton, CarteRecette } from "@/design-system/components/Kaddie";
import type { Recipe } from "@/lib/data";
import type { EtatSource } from "@/lib/domain/import-etat";
import { listeDeNoms } from "@/lib/domain/convives";
import { ROUTES } from "@/lib/routes";
import { vibrer } from "@/lib/retour";
import { CarteGeste, PILE } from "./CarteGeste";

/*
 * Le swipe des recettes : à droite « Miam », à gauche « Bof ».
 * Le geste lui-même (DESIGN.md §7) est dans CarteGeste.
 */

/**
 * « hier » : le plat mangé hier, redemandé en premier (« C'était bon ? »).
 * « voix » : une seule autre personne en a envie (son prénom) ; un « Miam » et c'est un match.
 */
/** « contient » : les allergènes courants, dits comme sur « Ce soir » (« Contient du lait »). */
type Accord = { avec: string[]; auMenu: boolean };
type CarteDuPaquet = Recipe & { hier?: boolean; voix?: string; voixNb?: number; contient?: string | null };

/** Les trois premiers choix expliquent « Miam » : l'utilisateur sait à quoi ses envies servent. */
const PREMIERS_CHOIX = 3;

export function SwipeDeck({
  initialDeck,
  toutCache = false,
  source = "ok",
  revoir = null,
  aRevoir = { aimes: 0, refuses: 0 },
  dejaSwipes = PREMIERS_CHOIX,
  ensuite,
}: {
  initialDeck: CarteDuPaquet[];
  toutCache?: boolean;
  /** Où en est la recherche de nouveautés : en cours, épuisée pour l'instant, en panne, ou rien à signaler. */
  source?: EtatSource;
  /** « Revoir » à la demande : ses plats aimés ou refusés. */
  revoir?: "aimes" | "refuses" | null;
  /** Combien de plats cette personne pourrait revoir (aimés, refusés). */
  aRevoir?: { aimes: number; refuses: number };
  /** Combien de plats cette personne a déjà swipés (avant d'ouvrir l'écran). */
  dejaSwipes?: number;
  /** Ce qui remplace la légende des premiers choix, une fois ceux-ci faits. */
  ensuite?: React.ReactNode;
}) {
  // L'état local n'est pas réinitialisé par les rafraîchissements de la page :
  // le paquet reste stable pendant qu'on swipe.
  const [deck, setDeck] = useState(initialDeck);
  // Nouvelles recettes arrivées pendant qu'on swipe (import Marmiton) : ajoutées au bout de la pile.
  const vues = useRef(new Set(initialDeck.map((r) => r.id)));
  useEffect(() => {
    const nouvelles = initialDeck.filter((r) => !vues.current.has(r.id));
    if (nouvelles.length > 0) {
      nouvelles.forEach((r) => vues.current.add(r.id));
      setDeck((d) => [...d, ...nouvelles]);
      return;
    }
    }, [initialDeck]);
  // Pile vide : si une recherche de nouveautés est en cours (ou va démarrer), on redemande le paquet quelques fois, 20 secondes au plus ;
  // ensuite l'écran dit clairement où l'on en est. Jamais d'attente sans fin.
  const router = useRouter();
  const vide = deck.length === 0;
  const [attenteFinie, setAttenteFinie] = useState(false);
  useEffect(() => {
    if (!vide || revoir || attenteFinie || source === "epuisee" || source === "indisponible") return;
    let essais = 0;
    const t = setInterval(() => {
      if (essais++ < 5) router.refresh();
      else {
        clearInterval(t);
        setAttenteFinie(true);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [vide, revoir, attenteFinie, source, router]);
  // « attente » : pas de réseau, le choix est gardé sur le téléphone et partira tout seul.
  const [error, setError] = useState<null | "attente" | "erreur">(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const top = deck[0];

  // « Annuler » est posé en haut de la pile : il ne recouvre ni Bof ni Miam, ni le nom du plat suivant.
  const { p: proposition, proposer, effacer } = useProposition();
  const [faits, setFaits] = useState(0);
  // Lecteur d'écran : la carte suivante est annoncée, comme on la verrait arriver.
  const [annonce, setAnnonce] = useState("");
  function decide(liked: boolean) {
    if (!top) return;
    const carte = top;
    setDeck((d) => d.slice(1));
    setFaits((n) => n + 1);
    setAnnonce(deck[1] ? `Plat suivant : ${deck[1].title}` : "Plus de plats pour l'instant");
    vibrer();
    const envoi: Promise<{ avant: SwipeAvant; auMenu: boolean; articles: number; accord: Accord | null } | "attente" | null> = swipe(carte.id, liked)
      .then((res) => {
        setError(null);
        // « Annuler » ne sort du Menu qu'un plat que ce swipe vient d'y faire entrer.
        return { avant: res.avant, auMenu: res.auMenu && res.entre, articles: res.auMenu ? res.ingredients : 0, accord: res.match ? { avec: res.avec, auMenu: res.auMenu } : null };
      })
      .catch((e) => {
        if (!estErreurReseau(e)) {
          setError("erreur");
          return null;
        }
        mettreEnAttente({ sorte: "swipe", recipeId: carte.id, liked });
        setError("attente");
        return "attente" as const;
      });
    // Un doigt qui glisse trop vite : la carte revient, et le swipe redevient ce qu'il était.
    const annuler = () => {
      setDeck((d) => [carte, ...d.filter((r) => r.id !== carte.id)]);
      setFaits((n) => Math.max(0, n - 1));
      envoi.then((res) => {
        if (res !== "attente") return undoSwipe(carte.id, res?.avant ?? null, res?.auMenu ?? false).catch(() => {});
        // Gardé hors connexion : s'il n'est pas encore parti, il suffit de l'oublier.
        const enFile = lireAttente().find((e) => e.cle === `swipe:${carte.id}`);
        if (enFile && !enFile.envoyee) retirerDeLAttente([enFile.cle]);
        else return undoSwipe(carte.id, null).catch(() => {});
      });
    };
    if (!liked) return proposer(`Bof : ${carte.title}`, annuler);
    // Un « Miam » dit ce qu'il a fait : attendre la réponse, pour annoncer les articles arrivés dans le caddie.
    void envoi.then((res) => {
      if (res === null) return;
      const articles = res === "attente" ? 0 : res.articles;
      const caddie = articles > 0 ? `${articles} article${articles > 1 ? "s" : ""} dans le caddie` : undefined;
      // Un accord de la famille s'annonce dans le bandeau, sans interrompre : on peut continuer à swiper.
      const accord = res === "attente" ? null : res.accord;
      if (!accord) return proposer(`Miam : ${carte.title}`, annuler, caddie);
      proposer(
        accord.avec.length ? `${listeDeNoms(accord.avec)} et toi : ${carte.title}` : `Au Menu : ${carte.title}`,
        annuler,
        accord.auMenu ? caddie : "Il est complet ou tu l'avais retiré : tu peux le remettre depuis le Menu.",
        { href: ROUTES.menu, libelle: "Voir" },
      );
    });
  }

  // Boutons et clavier : la carte du dessus part comme avec le doigt.
  const throwTop = useRef<((liked: boolean) => void) | null>(null);
  const press = (liked: boolean) => (throwTop.current ? throwTop.current(liked) : decide(liked));

  // Sur ordinateur : flèches ← → pour swiper.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") press(true);
      if (e.key === "ArrowLeft") press(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Les trois premiers choix : une phrase dit à quoi sert « Miam ». Ensuite, ce que la page y met d'habitude.
  const premiers = dejaSwipes + faits < PREMIERS_CHOIX && deck.length > 0;
  const entete = premiers ? (
    <p className="kd-petit">
      <strong className="font-semibold text-encre">Miam</strong>&nbsp;: je le mangerais. Kaddie apprend et vous propose pour ce soir.
    </p>
  ) : (
    ensuite
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-5">
      {entete && <div className="-mb-2">{entete}</div>}
      {/* Jamais moins de 12rem, même sur iPhone SE : la page défile alors un peu. */}
      <div ref={pileRef} className="relative mx-auto min-h-[12rem] w-full flex-1 sm:max-h-[36rem] sm:max-w-sm">
        {deck.length === 0 ? (
          <PileVide toutCache={toutCache} etat={revoir ? "revoir" : source === "ok" || source === "en_cours" ? (attenteFinie ? "epuisee" : "cherche") : source} revoir={revoir} aRevoir={aRevoir} />
        ) : (
          <AnimatePresence initial={false}>
            {deck
              .slice(0, PILE.length)
              .map((recipe, i) => (
                <Carte
                  key={recipe.id}
                  recipe={recipe}
                  rang={i}
                  pileRef={pileRef}
                  onDecide={decide}
                  register={i === 0 ? (fn) => (throwTop.current = fn) : undefined}
                />
              ))
              .reverse()}
          </AnimatePresence>
        )}
        <div aria-live="polite" className="pointer-events-none absolute inset-x-3 top-3 z-50">
          <AnimatePresence>{proposition && <BandeauAnnuler key={proposition.id} p={proposition} effacer={effacer} />}</AnimatePresence>
        </div>
      </div>

      {deck.length > 0 && (
        <div className="mx-auto flex w-full max-w-sm items-center gap-3">
          <Bouton variante="nope" large className="flex-1" onClick={() => press(false)}>
            Bof
          </Bouton>
          <Bouton variante="like" large className="flex-1" onClick={() => press(true)}>
            Miam
          </Bouton>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {annonce}
      </p>

      {error === "attente" && (
        <p role="status" className="kd-carte p-4 text-center">
          Pas de réseau : tes choix sont gardés et partiront tout seuls au retour du réseau.
        </p>
      )}
      {error === "erreur" && (
        <p role="alert" className="kd-carte p-4 text-center">
          Un choix n&apos;a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}

    </div>
  );
}

function Carte({
  recipe,
  rang,
  pileRef,
  onDecide,
  register,
}: {
  recipe: CarteDuPaquet;
  rang: number;
  pileRef: React.RefObject<HTMLDivElement | null>;
  onDecide: (liked: boolean) => void;
  register?: (fn: (liked: boolean) => void) => void;
}) {
  return (
    <CarteGeste
      rang={rang}
      pileRef={pileRef}
      onDecide={(d) => onDecide(d === "droite")}
      register={register ? (fn) => register((liked) => fn(liked ? "droite" : "gauche")) : undefined}
      tampons={{
        droite: <span className="kd-tampon kd-tampon--like">{recipe.hier ? "On le refait" : "Miam"}</span>,
        gauche: <span className="kd-tampon kd-tampon--nope">Bof</span>,
      }}
    >
      <CarteRecette
        className="kd-carte--pleine"
        titre={recipe.title}
        photo={recipe.photo_url}
        pastille={recipe.hier ? "Mangé hier" : recipe.voix ? (recipe.voixNb === 1 ? "Ta voix fait le match" : "La famille en a envie") : recipe.pastille}
        infos={
          recipe.hier
            ? "C'était bon ? Miam : on le refait"
            : [recipe.voix && `${recipe.voix} ${recipe.voixNb && recipe.voixNb > 1 ? "en ont" : "en a"} envie`, recipe.total_minutes && `${recipe.total_minutes} min`, recipe.contient, !recipe.voix && !recipe.contient && recipe.source_url && "Recette Marmiton"]
                .filter(Boolean)
                .join(" · ") || undefined
        }
      />
    </CarteGeste>
  );
}

function PileVide({
  toutCache,
  etat,
  revoir,
  aRevoir,
}: {
  toutCache: boolean;
  etat: "cherche" | "epuisee" | "indisponible" | "revoir";
  revoir: "aimes" | "refuses" | null;
  aRevoir: { aimes: number; refuses: number };
}) {
  if (toutCache) {
    return (
      <div className="kd-carte h-full justify-center gap-4 p-6 text-center">
        <p className="kd-titre-2 text-aubergine">Tous les plats sont cachés</p>
        <p className="text-encre-douce">
          Les régimes, allergies ou « j&apos;aime pas » de la famille écartent toutes les recettes. Vérifie ce qui a été coché dans les goûts.
        </p>
        <Link href={`/profil/gouts?suite=${encodeURIComponent("/envies")}`} className="kd-btn kd-btn--large">
          Voir mes goûts
        </Link>
      </div>
    );
  }
  if (etat === "revoir") {
    return (
      <div className="kd-carte h-full justify-center gap-4 p-6 text-center">
        <p className="kd-titre-2 text-aubergine">{revoir === "aimes" ? "Tu as tout revu" : "Rien d'autre à revoir"}</p>
        <p className="text-encre-douce">{revoir === "aimes" ? "Ce sont tous les plats que tu as aimés." : "Ce sont tous les plats que tu avais refusés."}</p>
        <Link href="/envies" className="kd-btn kd-btn--large">
          Retour aux idées
        </Link>
      </div>
    );
  }
  if (etat === "cherche") {
    return (
      <div role="status" className="kd-carte h-full justify-center gap-4 p-6 text-center">
        <p className="kd-titre-2 text-aubergine">Kaddie cherche de nouvelles idées…</p>
        <p className="text-encre-douce">Quelques secondes.</p>
      </div>
    );
  }
  // Rien de nouveau pour l'instant : on le dit, et on propose de revoir ses plats, à la demande.
  const principal = aRevoir.aimes > 0 ? "aimes" : null;
  return (
    <div role="status" className="kd-carte h-full justify-center gap-4 p-6 text-center">
      <p className="kd-titre-2 text-aubergine">{etat === "indisponible" ? "Kaddie n'arrive pas à chercher de nouvelles idées" : "Tu as fait le tour des idées du moment"}</p>
      <p className="text-encre-douce">
        {etat === "indisponible" ? "Réessaie dans quelques minutes : tes choix sont gardés." : "Kaddie en cherchera d'autres plus tard. En attendant, tu peux revoir tes plats ou ajouter une recette."}
      </p>
      {principal ? (
        <Link href="/envies?revoir=aimes" className="kd-btn kd-btn--large">
          Revoir mes plats aimés ({aRevoir.aimes})
        </Link>
      ) : (
        <Link href="/recettes/nouvelle" className="kd-btn kd-btn--large">
          Ajouter une recette
        </Link>
      )}
      <div className="flex flex-wrap justify-center gap-x-4">
        {aRevoir.refuses > 0 && (
          <Link href="/envies?revoir=refuses" className="flex min-h-11 items-center font-semibold text-violet">
            Revoir ceux que j&apos;ai refusés ({aRevoir.refuses})
          </Link>
        )}
        {principal && (
          <Link href="/recettes/nouvelle" className="flex min-h-11 items-center font-semibold text-violet">
            Ajouter une recette
          </Link>
        )}
      </div>
    </div>
  );
}
