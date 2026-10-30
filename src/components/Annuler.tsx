"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

/*
 * « Annuler » pendant 5 secondes après une action qu'on peut regretter
 * (un swipe, un article retiré de la liste) : un bandeau au-dessus des onglets.
 */

/**
 * « detail » : une seconde ligne, plus discrète (ce que l'action a fait).
 * « accord » : un accord de la famille (le bandeau est pistache) ; « voir » mène au plat sans fermer ce qu'on faisait.
 */
type Accord = { href: string; libelle: string };
type Proposition = { id: number; message: string; detail?: string; accord?: Accord; annuler: () => void };
const Ctx = createContext<(message: string, annuler: () => void, detail?: string, accord?: Accord) => void>(() => {});

export const useAnnuler = () => useContext(Ctx);

const DUREE = 5000;

/** La proposition en cours, qui s'efface seule au bout de 5 secondes. */
export function useProposition() {
  const [p, setP] = useState<Proposition | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proposer = useCallback((message: string, annuler: () => void, detail?: string, accord?: Accord) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    const id = Date.now();
    setP({ id, message, detail, accord, annuler });
    minuteur.current = setTimeout(() => setP((cur) => (cur?.id === id ? null : cur)), DUREE);
  }, []);
  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), []);
  return { p, proposer, effacer: () => setP(null) };
}

/** Le bandeau lui-même : le message et « Annuler ». À placer dans un <AnimatePresence>. */
export function BandeauAnnuler({ p, effacer }: { p: Proposition; effacer: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-bouton py-2 pr-2 pl-4 ${p.accord ? "bg-pistache text-aubergine" : "bg-aubergine text-blanc"}`}
    >
      <span className="min-w-0 flex-1 leading-snug">
        <span className="line-clamp-2 block font-semibold">{p.message}</span>
        {p.detail && <span className="block text-petit">{p.detail}</span>}
      </span>
      {p.accord && (
        <Link href={p.accord.href} onClick={effacer} className="flex min-h-12 shrink-0 items-center px-2 font-semibold underline underline-offset-4">
          {p.accord.libelle}
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          p.annuler();
          effacer();
        }}
        className={`min-h-12 shrink-0 rounded-pastille px-4 font-display text-bouton active:scale-95 ${p.accord ? "bg-aubergine text-blanc" : "bg-accent text-on-accent"}`}
      >
        Annuler
      </button>
    </motion.div>
  );
}

export function AnnulerProvider({ children }: { children: React.ReactNode }) {
  const { p, proposer, effacer } = useProposition();
  return (
    <Ctx.Provider value={proposer}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--onglets)+0.75rem)] z-40 px-4">
        <AnimatePresence>{p && <BandeauAnnuler key={p.id} p={p} effacer={effacer} />}</AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
