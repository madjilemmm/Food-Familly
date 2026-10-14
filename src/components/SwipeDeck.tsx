"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import { swipe } from "@/app/actions/swipes";
import { Bouton, CarteRecette, IconeJenVeux, IconePasEnvie, Logo, Scene } from "@/design-system/components/Kaddie";
import type { Recipe } from "@/lib/data";

/*
 * Le swipe Kaddie (DESIGN.md §7) : la carte suit le doigt, rotation = déplacement / 20
 * plafonnée à 15°, tampons « Miam » / « Bof » en fondu. Au-delà de 30 % de la largeur
 * ou d'un geste rapide, la carte part en 240 ms ; sinon elle revient en rebondissant.
 */
const SEUIL = 0.3;
const VITESSE = 600;
const SORTIE = 0.24;
const REBOND = [0.34, 1.56, 0.64, 1] as const;

/** Les cartes du dessous, décalées et légèrement tournées. */
const PILE = [
  { rotate: 0, y: 0, scale: 1 },
  { rotate: -2, y: 8, scale: 0.96 },
  { rotate: 5, y: 16, scale: 0.92 },
];

export function SwipeDeck({ initialDeck }: { initialDeck: Recipe[] }) {
  // L'état local n'est pas réinitialisé par les rafraîchissements de la page :
  // le paquet reste stable pendant qu'on swipe.
  const [deck, setDeck] = useState(initialDeck);
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
      {/* Jamais moins de 17rem, même sur iPhone SE : la page défile alors un peu. */}
      <div ref={pileRef} className="relative mx-auto min-h-[17rem] w-full flex-1 sm:max-h-[36rem] sm:max-w-sm">
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
  const calme = useReducedMotion();
  const x = useMotionValue(0);
  const rotateDrag = useTransform(x, (v) => (calme ? 0 : Math.max(-15, Math.min(15, v / 20))));
  const largeur = () => pileRef.current?.offsetWidth ?? 360;
  const miam = useTransform(x, (v) => Math.min(1, Math.max(0, v / (largeur() * SEUIL))));
  const bof = useTransform(x, (v) => Math.min(1, Math.max(0, -v / (largeur() * SEUIL))));
  const isTop = rang === 0;
  const pos = PILE[rang];

  const parti = useRef(false);
  const partir = (liked: boolean) => {
    if (parti.current) return; // un double appui ne doit pas sauter une carte
    parti.current = true;
    const cible = (liked ? 1 : -1) * largeur() * 1.6;
    if (calme) {
      onDecide(liked);
      return;
    }
    animate(x, cible, { duration: SORTIE, ease: [0.22, 1, 0.36, 1] }).then(() => onDecide(liked));
  };

  useEffect(() => {
    register?.(partir);
  });

  function onDragEnd(_: unknown, info: PanInfo) {
    const loin = Math.abs(info.offset.x) > largeur() * SEUIL;
    const vite = Math.abs(info.velocity.x) > VITESSE;
    if (loin || vite) partir((loin ? info.offset.x : info.velocity.x) > 0);
    else animate(x, 0, { duration: 0.42, ease: REBOND });
  }

  return (
    <motion.div
      className="absolute inset-0 touch-none select-none"
      style={{ x, rotate: isTop ? rotateDrag : pos.rotate, zIndex: PILE.length - rang }}
      drag={isTop ? "x" : false}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      initial={false}
      animate={{ y: pos.y, scale: pos.scale, rotate: isTop ? undefined : calme ? 0 : pos.rotate }}
      exit={{ opacity: 0, transition: { duration: calme ? 0.12 : 0 } }}
      transition={{ duration: calme ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <CarteRecette className="kd-carte--pleine" titre={recipe.title} photo={recipe.photo_url} />
      {isTop && (
        <>
          <motion.span style={{ opacity: miam }} className="kd-tampon kd-tampon--like" aria-hidden>
            Miam
          </motion.span>
          <motion.span style={{ opacity: bof }} className="kd-tampon kd-tampon--nope" aria-hidden>
            Bof
          </motion.span>
        </>
      )}
    </motion.div>
  );
}

function PileVide() {
  return (
    <div className="kd-carte h-full justify-center gap-4 p-6 text-center">
      <p className="kd-titre-2 text-aubergine">Plus de recettes pour l&apos;instant.</p>
      <p className="text-encre-douce">Les plats reviennent 14 jours après ton swipe.</p>
      <Link href="/recettes/nouvelle" className="kd-btn kd-btn--large">
        Ajouter une recette
      </Link>
    </div>
  );
}

/** « C'est un match » : monogramme qui éclot, puis la carte qui monte (120 ms après). */
function EcranMatch({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
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
