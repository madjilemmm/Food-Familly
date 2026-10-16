"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addItem, deleteItem, setItemChecked } from "@/app/actions/list";
import { finishTrip } from "@/app/actions/trips";
import { groupByAisle } from "@/lib/domain/aisles";
import { guessAisle } from "@/lib/domain/recipe-import";
import { formatQuantity } from "@/lib/domain/shopping-list";
import type { ListItem } from "@/lib/data";
import { IconeCroix, IconePlus } from "@/components/ui";
import { ConfirmButton } from "./ConfirmButton";
import { useAnnuler } from "@/components/Annuler";

type Action =
  | { type: "check"; id: string; checked: boolean }
  | { type: "add"; item: ListItem }
  | { type: "delete"; id: string };

export function ShoppingList({
  items,
  requests,
}: {
  items: ListItem[];
  requests: { id: string; from: string; text: string }[];
}) {
  const [, startTransition] = useTransition();
  const proposer = useAnnuler();
  const inputRef = useRef<HTMLInputElement>(null);
  const [list, apply] = useOptimistic(items, (state, action: Action) => {
    switch (action.type) {
      case "check":
        return state.map((i) => (i.id === action.id ? { ...i, checked: action.checked } : i));
      case "add":
        return [...state, action.item];
      case "delete":
        return state.filter((i) => i.id !== action.id);
    }
  });

  const add = (name: string, source: "manual" | "request") => {
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      apply({
        type: "add",
        item: {
          id: `tmp-${Date.now()}`,
          name: clean,
          quantity: null,
          unit: "",
          aisle: guessAisle(clean),
          source,
          for_recipes: null,
          checked: false,
          created_at: new Date().toISOString(),
        },
      });
      await addItem(clean, source);
    });
  };

  const alreadyAdded = new Set(list.filter((i) => i.source === "request").map((i) => i.name.trim().toLowerCase()));
  const pendingRequests = requests.filter((r) => !alreadyAdded.has(r.text.trim().toLowerCase()));
  const done = list.filter((i) => i.checked).length;
  // Les rayons dans l'ordre du parcours en magasin ; un rayon terminé passe en bas.
  // Dans chaque rayon, ce qui reste à prendre en haut, ce qui est pris en bas.
  const groups = groupByAisle(list)
    .map((g) => ({
      ...g,
      done: g.items.every((i) => i.checked),
      items: [...g.items].sort((a, b) => Number(a.checked) - Number(b.checked)),
    }))
    .sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div>
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
        <section className="kd-carte mb-6 gap-3 p-4">
          <h2 className="kd-titre-3 text-aubergine">Ce que la famille a demandé</h2>
          <ul className="flex flex-col gap-3">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="flex-1">
                  <strong>{r.from}</strong>&nbsp;: « {r.text} »
                </span>
                <button onClick={() => add(r.text, "request")} className="kd-btn kd-btn--like shrink-0 px-4">
                  Ajouter
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
          add(inputRef.current?.value ?? "", "manual");
          // Le clavier reste ouvert pour enchaîner les articles.
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.focus();
          }
        }}
      >
        <input ref={inputRef} name="name" placeholder="Ajouter un article…" enterKeyHint="done" className="kd-champ min-w-0 flex-1" />
        <button type="submit" aria-label="Ajouter l'article" className="kd-btn kd-btn--secondaire w-14 shrink-0 px-0">
          <IconePlus />
        </button>
      </form>

      {list.length === 0 && <p className="text-center text-encre-douce">La liste est vide.</p>}

      {groups.map((group) => (
        <motion.section key={group.id} layout="position" transition={{ type: "spring", stiffness: 400, damping: 40 }} className="mb-6">
          <h2 className="kd-etiquette flex items-center gap-2">
            {group.label}
            {group.done && <span className="kd-pastille kd-pastille--match ml-auto">Fini</span>}
          </h2>
          <ul className="kd-liste">
            <AnimatePresence initial={false}>
              {group.items.map((item) => (
                // Un article coché glisse en bas de son rayon ; ajout et retrait en douceur.
                <motion.li
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40, opacity: { duration: 0.15 } }}
                  className="kd-liste__article overflow-hidden"
                >
                  <button
                    type="button"
                    aria-pressed={item.checked}
                    onClick={() =>
                      startTransition(async () => {
                        apply({ type: "check", id: item.id, checked: !item.checked });
                        if (!item.id.startsWith("tmp-")) await setItemChecked(item.id, !item.checked);
                      })
                    }
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
                  </button>
                  {item.source !== "recipe" && (
                    <button
                      type="button"
                      aria-label={`Retirer ${item.name}`}
                      onClick={() =>
                        startTransition(async () => {
                          apply({ type: "delete", id: item.id });
                          if (!item.id.startsWith("tmp-")) await deleteItem(item.id);
                          // Retiré par erreur ? Il revient d'un geste.
                          if (item.source !== "recipe") proposer(`${item.name} retiré`, () => add(item.name, item.source as "manual" | "request"));
                        })
                      }
                      className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                    >
                      <IconeCroix className="size-6" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      ))}

      {list.length > 0 && (
        <div className="mt-8">
          <ConfirmButton
            action={finishTrip}
            question="Les courses sont finies ?"
            detail="La liste sera effacée pour toute la famille."
            confirmLabel="Oui, c'est fini"
            className="kd-btn kd-btn--large"
          >
            J&apos;ai fini les courses
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
