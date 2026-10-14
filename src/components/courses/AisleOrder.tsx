"use client";

import { useCallback, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { AISLE_IDS, aisleInfo, normalizeAisleOrder, type AisleId } from "@/lib/domain/aisles";

/*
 * L'ordre des rayons de « mon » magasin, gardé sur ce téléphone :
 * chacun a son magasin habituel, et la liste se range dans son ordre à lui.
 */

const KEY = "atable-aisle-order";
const listeners = new Set<() => void>();
let cached: { raw: string | null; order: AisleId[] } | null = null;

function read(): AisleId[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (cached?.raw !== raw) {
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {}
    cached = { raw, order: normalizeAisleOrder(parsed) };
  }
  return cached.order;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useAisleOrder() {
  const order = useSyncExternalStore(subscribe, read, () => AISLE_IDS);
  const save = useCallback((next: AisleId[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    cached = { raw: JSON.stringify(next), order: next };
    listeners.forEach((l) => l());
  }, []);
  return [order, save] as const;
}

export function AisleOrderEditor({ order, onChange, onClose }: {
  order: AisleId[];
  onChange: (order: AisleId[]) => void;
  onClose: () => void;
}) {
  const move = (index: number, delta: -1 | 1) => {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="mb-6 rounded-3xl bg-white p-4 shadow-sm"
    >
      <h2 className="text-xl font-bold">L&apos;ordre de mon magasin</h2>
      <p className="mb-3 text-base text-stone-500">Mettez les rayons dans l&apos;ordre où vous les croisez, de l&apos;entrée à la caisse.</p>
      <ol className="space-y-2">
        {order.map((id, i) => {
          const aisle = aisleInfo(id);
          return (
            <motion.li
              key={id}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="flex items-center gap-2 rounded-2xl bg-stone-50 py-1 pr-1 pl-3"
            >
              <span className="w-6 text-center text-base font-bold text-stone-400">{i + 1}</span>
              <span className="text-2xl">{aisle.emoji}</span>
              <span className="min-w-0 flex-1 text-lg font-semibold">{aisle.label}</span>
              <button
                type="button"
                aria-label={`Monter ${aisle.label}`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex size-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm active:scale-90 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Descendre ${aisle.label}`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
                className="flex size-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm active:scale-90 disabled:opacity-30"
              >
                ↓
              </button>
            </motion.li>
          );
        })}
      </ol>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChange([...AISLE_IDS])}
          className="min-h-12 flex-1 rounded-2xl text-lg text-stone-500 underline"
        >
          Ordre classique
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 flex-1 rounded-2xl bg-basil-500 text-lg font-bold text-white active:scale-[0.98]"
        >
          C&apos;est bon
        </button>
      </div>
    </motion.section>
  );
}
