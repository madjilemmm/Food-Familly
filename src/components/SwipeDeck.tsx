"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { swipe } from "@/app/actions/swipes";
import { Bouton, CarteRecette, IconeJenVeux, IconePasEnvie, Logo, Scene } from "@/design-system/components/Kaddie";
import type { Recipe } from "@/lib/data";
import { CarteGeste, PILE } from "./CarteGeste";

/*
 * Le swipe des recettes : à droite « Miam », à gauche « Bof ».
 * Le geste lui-même (DESIGN.md §7) est dans CarteGeste.
 */

export function SwipeDeck({ initialDeck }: { initialDeck: Recipe[] }) {
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
  const [match, setMatch] = useState<Recipe | null>(null);
  const [error, setError] = useState(false);
  const pileRef = useRef<HTMLDivElement>(null);
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const top = deck[0];

  function decide(liked: boolean) {
    if (!top) return;
    setDeck((d) => d.slice(1));
    swipe(top.id, liked)
      .then((res) => res.match && setMatch(top))
      .catch(() => setError(true));
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
          <PileVide />
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

      {error && (
        <p role="alert" className="kd-carte p-4 text-center">
          Pas de réseau, un choix n&apos;est pas passé. Réessaie quand ça revient.
        </p>
      )}

      {/* Au-dessus de tout (la scène isole ses calques) : rendu directement dans <body>. */}
      {monte &&
        createPortal(
          <AnimatePresence>{match && <EcranMatch recipe={match} onClose={() => setMatch(null)} />}</AnimatePresence>,
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
  recipe: Recipe;
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
        droite: <span className="kd-tampon kd-tampon--like">Miam</span>,
        gauche: <span className="kd-tampon kd-tampon--nope">Bof</span>,
      }}
    >
      <CarteRecette
        className="kd-carte--pleine"
        titre={recipe.title}
        photo={recipe.photo_url}
        pastille={recipe.pastille}
        infos={recipe.source_url ? "Recette Marmiton" : undefined}
      />
    </CarteGeste>
  );
}

function PileVide() {
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
function EcranMatch({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
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
          <p className="kd-titre-3">La majorité de la famille en veut.</p>
        </div>
        <CarteRecette
          className="kd-monte min-h-0 text-left [animation-delay:120ms] [&_.kd-carte__photo]:max-h-[30dvh]"
          titre={recipe.title}
          photo={recipe.photo_url}
        />
        <div className="pb-4">
          <Bouton variante="like" large onClick={onClose} autoFocus>
            Continuer
          </Bouton>
        </div>
      </Scene>
    </motion.div>
  );
}
