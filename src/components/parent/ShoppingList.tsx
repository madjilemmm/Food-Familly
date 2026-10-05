"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { addItem, deleteItem, setItemChecked } from "@/app/actions/list";
import { finishTrip } from "@/app/actions/trips";
import { groupByAisle } from "@/lib/domain/aisles";
import { formatQuantity } from "@/lib/domain/shopping-list";
import type { ListItem } from "@/lib/data";
import { ConfirmButton } from "./ConfirmButton";

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
          aisle: "autre",
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
  // Dans chaque rayon, ce qui reste à prendre en haut, ce qui est pris en bas.
  const groups = groupByAisle(list).map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => Number(a.checked) - Number(b.checked)),
  }));

  return (
    <div>
      {list.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-lg font-semibold text-stone-600">
            {done === list.length ? "Tout est pris ! 🎉" : `${done} sur ${list.length} dans le chariot`}
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-basil-500 transition-all" style={{ width: `${(done / list.length) * 100}%` }} />
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <section className="mb-6 rounded-3xl bg-amber-50 p-4">
          <h2 className="mb-2 text-xl font-bold">Ce que vos fils ont demandé</h2>
          <ul className="space-y-2">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="flex-1 text-lg">
                  <strong>{r.from}</strong> : « {r.text} »
                </span>
                <button
                  onClick={() => add(r.text, "request")}
                  className="shrink-0 rounded-2xl bg-amber-400 px-4 py-3 text-lg font-bold text-amber-950 active:scale-95"
                >
                  + Ajouter
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
          if (inputRef.current) inputRef.current.value = "";
        }}
      >
        <input
          ref={inputRef}
          name="name"
          placeholder="Ajouter un article…"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-2xl border-2 border-stone-200 bg-white px-4 py-4 text-xl outline-none focus:border-tomato-500"
        />
        <button type="submit" aria-label="Ajouter" className="w-16 shrink-0 rounded-2xl bg-tomato-500 text-3xl font-bold text-white active:scale-95">
          +
        </button>
      </form>

      {list.length === 0 && (
        <p className="rounded-3xl bg-white p-6 text-center text-xl text-stone-500">La liste est vide.</p>
      )}

      {groups.map((group) => (
        <section key={group.id} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-stone-700">
            <span className="text-2xl">{group.emoji}</span> {group.label}
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-white">
            {group.items.map((item) => (
              <li key={item.id} className="flex items-center border-b border-stone-100 last:border-0">
                <button
                  type="button"
                  aria-pressed={item.checked}
                  onClick={() =>
                    startTransition(async () => {
                      apply({ type: "check", id: item.id, checked: !item.checked });
                      if (!item.id.startsWith("tmp-")) await setItemChecked(item.id, !item.checked);
                    })
                  }
                  className="flex min-h-16 flex-1 items-center gap-4 px-4 py-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${
                      item.checked ? "bg-basil-500 text-white" : "border-4 border-stone-300"
                    }`}
                  >
                    {item.checked ? "✓" : ""}
                  </span>
                  <span className={`flex-1 ${item.checked ? "text-stone-400 line-through" : ""}`}>
                    <span className="text-xl font-semibold">{item.name}</span>
                    {item.quantity != null || item.unit ? (
                      <span className="ml-2 text-xl text-stone-500">{formatQuantity(item.quantity, item.unit)}</span>
                    ) : null}
                    {item.for_recipes && <span className="block text-sm text-stone-400">pour {item.for_recipes}</span>}
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
                      })
                    }
                    className="px-4 py-3 text-2xl text-stone-300"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.length > 0 && (
        <div className="mt-8 text-center">
          <ConfirmButton
            action={finishTrip}
            question="Les courses sont terminées ? La liste sera effacée."
            className="w-full rounded-[2rem] bg-stone-800 py-5 text-xl font-bold text-white active:scale-[0.98]"
          >
            🏁 J&apos;ai fini les courses
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
