"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/*
 * « Annuler » pendant 5 secondes après une action qu'on peut regretter
 * (un swipe, un article retiré de la liste) : un bandeau au-dessus des onglets.
 */

type Proposition = { id: number; message: string; annuler: () => void };
const Ctx = createContext<(message: string, annuler: () => void) => void>(() => {});

export const useAnnuler = () => useContext(Ctx);

const DUREE = 5000;

export function AnnulerProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Proposition | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proposer = useCallback((message: string, annuler: () => void) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    const id = Date.now();
    setP({ id, message, annuler });
    minuteur.current = setTimeout(() => setP((cur) => (cur?.id === id ? null : cur)), DUREE);
  }, []);
  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), []);

  return (
    <Ctx.Provider value={proposer}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--onglets)+0.75rem)] z-40 px-4">
        <AnimatePresence>
          {p && (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-bouton bg-aubergine py-2 pr-2 pl-4 text-blanc"
            >
              <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug">{p.message}</span>
              <button
                type="button"
                onClick={() => {
                  p.annuler();
                  setP(null);
                }}
                className="min-h-12 shrink-0 rounded-pastille bg-accent px-4 font-display text-bouton text-on-accent active:scale-95"
              >
                Annuler
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
