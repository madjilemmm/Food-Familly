"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { swipe, undoSwipe, type SwipeAvant } from "@/app/actions/swipes";
import { lireAttente, mettreEnAttente, retirerDeLAttente } from "@/lib/attente";
import { estErreurReseau } from "@/lib/reseau";
import { useAnnuler } from "@/components/Annuler";
import { Bouton, CarteRecette, IconeJenVeux, IconePasEnvie, Logo, Scene } from "@/design-system/components/Kaddie";
import type { Recipe } from "@/lib/data";
import { listeDeNoms } from "@/lib/domain/convives";
import { CarteGeste, PILE } from "./CarteGeste";
import { RecipeVisual } from "./RecipeVisual";

/*
 * Le swipe des recettes : à droite « Miam », à gauche « Bof ».
 * Le geste lui-même (DESIGN.md §7) est dans CarteGeste.
 */

/**
 * « hier » : le plat mangé hier, redemandé en premier (« C'était bon ? »).
 * « voix » : une seule autre personne en a envie (son prénom) ; un « Miam » et c'est un match.
 */
type CarteDuPaquet = Recipe & { hier?: boolean; voix?: string };

export function SwipeDeck({ initialDeck, toutCache = false }: { initialDeck: CarteDuPaquet[]; toutCache?: boolean }) {
  // L'état local n'est pas réinitialisé par les rafraîchissements de la page :
  // le paquet reste stable pendant qu'on swipe.
  const [deck, setDeck] = useState(initialDeck);
  // Nouvelles recettes arrivées pendant qu'on swipe (import Marmiton) : ajoutées au bout de la pile.
  const vues = useRef(new Set(initialDeck.map((r) => r.id)));
  useEffect(() => {
    const nouvelles = initialDeck.filter((r) => !vues.current.has(r.id));
    if (nouvelles.length === 0) return;
    nouvelles.forEach((r) => vues.current.add(r.id));
    setDeck((d) => [...d, ...nouvelles]);
  }, [initialDeck]);
  const [match, setMatch] = useState<{ recipe: Recipe; avec: string[]; auMenu: boolean } | null>(null);
  // « attente » : pas de réseau, le choix est gardé sur le téléphone et partira tout seul.
  const [error, setError] = useState<null | "attente" | "erreur">(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const top = deck[0];

  const proposer = useAnnuler();
  // Lecteur d'écran : la carte suivante est annoncée, comme on la verrait arriver.
  const [annonce, setAnnonce] = useState("");
  function decide(liked: boolean) {
    if (!top) return;
    const carte = top;
    setDeck((d) => d.slice(1));
    setAnnonce(deck[1] ? `Plat suivant : ${deck[1].title}` : "Plus de plats pour l'instant");
    const envoi: Promise<{ avant: SwipeAvant; auMenu: boolean } | "attente" | null> = swipe(carte.id, liked)
      .then((res) => {
        setError(null);
        if (res.match) setMatch({ recipe: carte, avec: res.avec, auMenu: res.auMenu });
        // « Annuler » ne sort du Menu qu'un plat que ce swipe vient d'y faire entrer.
        return { avant: res.avant, auMenu: res.auMenu && res.entre };
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
    proposer(`${liked ? "Miam" : "Bof"} : ${carte.title}`, () => {
      setMatch((m) => (m?.recipe.id === carte.id ? null : m));
      setDeck((d) => [carte, ...d.filter((r) => r.id !== carte.id)]);
      envoi.then((res) => {
        if (res !== "attente") return undoSwipe(carte.id, res?.avant ?? null, res?.auMenu ?? false).catch(() => {});
        // Gardé hors connexion : s'il n'est pas encore parti, il suffit de l'oublier.
        const enFile = lireAttente().find((e) => e.cle === `swipe:${carte.id}`);
        if (enFile && !enFile.envoyee) retirerDeLAttente([enFile.cle]);
        else return undoSwipe(carte.id, null).catch(() => {});
      });
    });
  }

  // Boutons et clavier : la carte du dessus part comme avec le doigt.
  const throwTop = useRef<((liked: boolean) => void) | null>(null);
  const press = (liked: boolean) => (throwTop.current ? throwTop.current(liked) : decide(liked));

  // Sur ordinateur : flèches ← → pour swiper.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (match || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") press(true);
      if (e.key === "ArrowLeft") press(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-5">
      {/* Jamais moins de 12rem, même sur iPhone SE : la page défile alors un peu. */}
      <div ref={pileRef} className="relative mx-auto min-h-[12rem] w-full flex-1 sm:max-h-[36rem] sm:max-w-sm">
        {deck.length === 0 ? (
          <PileVide toutCache={toutCache} />
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
      </div>

      {deck.length > 0 && (
        <div className="flex items-center justify-center gap-10">
          <Bouton variante="nope" rond aria-label="Pas envie" onClick={() => press(false)}>
            <IconePasEnvie />
          </Bouton>
          <Bouton variante="like" rond aria-label="J'en veux" onClick={() => press(true)}>
            <IconeJenVeux />
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

      {/* Au-dessus de tout (la scène isole ses calques) : rendu directement dans <body>. */}
      {monte &&
        createPortal(
          <AnimatePresence>{match && <EcranMatch recipe={match.recipe} avec={match.avec} auMenu={match.auMenu} onClose={() => setMatch(null)} />}</AnimatePresence>,
          document.body,
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
        pastille={recipe.hier ? "Mangé hier" : recipe.voix ? "Ta voix fait le match" : recipe.pastille}
        infos={
          recipe.hier
            ? "C'était bon ? Miam : on le refait"
            : [recipe.voix && `Envie de ${recipe.voix}`, recipe.total_minutes && `${recipe.total_minutes} min`, !recipe.voix && recipe.source_url && "Recette Marmiton"]
                .filter(Boolean)
                .join(" · ") || undefined
        }
      />
    </CarteGeste>
  );
}

function PileVide({ toutCache }: { toutCache: boolean }) {
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
  return (
    <div className="kd-carte h-full justify-center gap-4 p-6 text-center">
      <p className="kd-titre-2 text-aubergine">De nouvelles recettes arrivent…</p>
      <p className="text-encre-douce">Kaddie va en chercher sur Marmiton. Reviens dans une minute.</p>
      <Link href="/recettes/nouvelle" className="kd-btn kd-btn--large">
        Ajouter une recette
      </Link>
    </div>
  );
}

/** « C'est un match » : monogramme qui éclot, puis la carte qui monte (120 ms après). */
function EcranMatch({ recipe, avec, auMenu, onClose }: { recipe: Recipe; avec: string[]; auMenu: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      role="dialog"
      aria-modal="true"
      aria-label="C'est un match"
    >
      <Scene
        duo="aubergine"
        seed={31}
        className="pb-safe mx-auto flex h-full max-w-xl flex-col justify-between gap-5 px-6 pt-[max(env(safe-area-inset-top),2.5rem)] text-center"
      >
        <div className="flex flex-col items-center gap-4 pt-6">
          <div className="kd-pop text-accent">
            <Logo variante="monogramme" width={96} title="" />
          </div>
          <h2 className="kd-display text-[56px]!">C&apos;est un match&nbsp;!</h2>
          <p className="kd-titre-3">{avec.length ? `${listeDeNoms(avec)} et toi en avez envie.` : "Vous êtes plusieurs à en avoir envie."}</p>
          {auMenu && <p className="font-semibold">Au Menu : les ingrédients sont sur la liste.</p>}
        </div>
        {/* La carte du plat, à hauteur fixe : le nom reste visible et tout tient sur l'écran. */}
        <div className="kd-carte kd-monte shrink-0 text-left [animation-delay:120ms]">
          <RecipeVisual recipe={recipe} className="h-[22dvh] w-full" />
          <p className="kd-titre-2 p-5 text-aubergine">{recipe.title}</p>
        </div>
        <div className="pb-4">
          <Bouton variante="like" large onClick={onClose} autoFocus>
            Continuer
          </Bouton>
        </div>
      </Scene>
    </motion.div>
  );
}
