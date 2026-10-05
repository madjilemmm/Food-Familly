"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { swipe } from "@/app/actions/swipes";
import { RecipeVisual } from "@/components/RecipeVisual";
import type { Recipe } from "@/lib/data";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const EXIT_X = 700;

export function SwipeDeck({ initialDeck }: { initialDeck: Recipe[] }) {
  // L'état local n'est pas réinitialisé par les rafraîchissements de la page :
  // le paquet reste stable pendant qu'on swipe.
  const [deck, setDeck] = useState(initialDeck);
  const [exitX, setExitX] = useState(0);
  const [match, setMatch] = useState<Recipe | null>(null);
  const [error, setError] = useState(false);

  const top = deck[0];

  function decide(liked: boolean) {
    if (!top) return;
    setExitX(liked ? EXIT_X : -EXIT_X);
    setDeck((d) => d.slice(1));
    swipe(top.id, liked)
      .then((res) => res.match && setMatch(top))
      .catch(() => setError(true));
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 w-full flex-1">
        {deck.length === 0 ? (
          <EmptyDeck />
        ) : (
          <AnimatePresence custom={exitX}>
            {deck
              .slice(0, 2)
              .reverse()
              .map((recipe) => (
                <SwipeCard key={recipe.id} recipe={recipe} isTop={recipe.id === top.id} onDecide={decide} />
              ))}
          </AnimatePresence>
        )}
      </div>

      {deck.length > 0 && (
        <div className="flex items-center justify-center gap-8 py-4">
          <button
            onClick={() => decide(false)}
            aria-label="Non merci"
            className="flex size-16 items-center justify-center rounded-full bg-white text-3xl shadow-lg transition-transform active:scale-90"
          >
            ✕
          </button>
          <button
            onClick={() => decide(true)}
            aria-label="J'aime"
            className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-4xl text-white shadow-xl shadow-pink-500/30 transition-transform active:scale-90"
          >
            ♥
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-100 px-4 py-2 text-center text-red-700">
          Oups, un swipe n&apos;est pas passé. Vérifie ta connexion.
        </p>
      )}

      <AnimatePresence>{match && <MatchOverlay recipe={match} onClose={() => setMatch(null)} />}</AnimatePresence>
    </div>
  );
}

function SwipeCard({
  recipe,
  isTop,
  onDecide,
}: {
  recipe: Recipe;
  isTop: boolean;
  onDecide: (liked: boolean) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onDecide(true);
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onDecide(false);
  }

  return (
    <motion.div
      className="absolute inset-0 touch-none overflow-hidden rounded-[2rem] bg-white shadow-2xl select-none"
      style={{ x, rotate, zIndex: isTop ? 2 : 1 }}
      drag={isTop ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.92, y: 16, opacity: 0.8 }}
      animate={{ scale: isTop ? 1 : 0.94, y: isTop ? 0 : 14, opacity: 1 }}
      exit="exit"
      variants={{
        exit: (exitX: number) => ({ x: exitX, rotate: exitX / 25, opacity: 0, transition: { duration: 0.35 } }),
      }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <RecipeVisual recipe={recipe} className="pointer-events-none h-full w-full" emojiClassName="text-[9rem]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 pt-20 pb-6">
        <h2 className="text-3xl leading-tight font-extrabold text-white drop-shadow">{recipe.title}</h2>
      </div>
      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute top-8 left-6 -rotate-12 rounded-xl border-4 border-emerald-400 px-3 py-1 text-3xl font-black text-emerald-400"
      >
        MIAM
      </motion.span>
      <motion.span
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute top-8 right-6 rotate-12 rounded-xl border-4 border-rose-500 px-3 py-1 text-3xl font-black text-rose-500"
      >
        BOF
      </motion.span>
    </motion.div>
  );
}

function EmptyDeck() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border-4 border-dashed border-fuchsia-200 bg-white/60 p-8 text-center">
      <p className="text-6xl">🍽️</p>
      <p className="mt-4 text-2xl font-bold">Tu as tout swipé !</p>
      <p className="mt-2 text-stone-500">Les recettes reviennent 14 jours après ton swipe.</p>
      <Link href="/recettes/nouvelle" className="mt-6 rounded-full bg-fuchsia-500 px-6 py-3 font-bold text-white">
        + Ajouter une recette
      </Link>
    </div>
  );
}

function MatchOverlay({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-fuchsia-600/95 via-pink-500/95 to-orange-400/95 px-8 text-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.p
        className="text-5xl font-black italic drop-shadow-lg"
        initial={{ scale: 0.3, rotate: -10 }}
        animate={{ scale: 1, rotate: -4 }}
        transition={{ type: "spring", stiffness: 260, damping: 12 }}
      >
        C&apos;est un match !
      </motion.p>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <RecipeVisual recipe={recipe} className="mx-auto mt-8 size-48 rounded-[2rem] shadow-2xl ring-4 ring-white" emojiClassName="text-8xl" />
        <p className="mt-6 text-2xl font-bold">{recipe.title}</p>
        <p className="mt-2 text-lg opacity-90">Vous aimez tous les deux. Maman le verra ! 💞</p>
      </motion.div>
      <button onClick={onClose} className="mt-10 rounded-full bg-white px-10 py-4 text-xl font-bold text-pink-600 shadow-lg">
        Continuer à swiper
      </button>
    </motion.div>
  );
}
